# Job protocol (web ⇄ worker)

Version `1`. Transport: Redis. Producer: Next.js (BullMQ-compatible plain list push).
Consumer: `apps/worker` (`BLPOP`). Status of record: Postgres `jobs` table (Phase 2);
live updates: Redis pub/sub channel `rasika:progress:<job_id>` → Next.js SSE route.

## Queue message (`LPUSH rasika:jobs <json>`)

```json
{
  "v": 1,
  "job_id": "uuid",
  "project_id": "uuid",
  "user_id": "uuid",
  "type": "synth | probe | transcribe | analyse_reference | plan | render_preview | render_final | recut | export | cleanup",
  "attempt": 1,
  "payload": {},
  "enqueued_at": "2026-10-18T00:00:00Z"
}
```

`payload` per type:

| type             | payload                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `synth`          | `{ script, voice, language_hint: "en", max_duration_sec? }` — script-only reels: Deepgram Aura narrates the script (`tts.py`), ffmpeg builds a stage-coloured 1080×1920 clip carrying it, uploaded as the project's `source_video` (`meta.synthetic = true`); then enqueues `probe`. The project's `style_options.faceless = true` makes the planner treat the whole stage as free |
| `presenter`      | `{ script, voice_id, look_id?, language_hint, max_duration_sec? }` — AI presenter (PAID, HeyGen v3): uploads the project's `presenter_image` asset to HeyGen (`POST /v3/assets`) or uses the stock look `look_id`, creates a 9:16 1080p video (`POST /v3/videos`, type `image` or `avatar`), polls `GET /v3/videos/{id}` to `completed`, downloads it as the project's `source_video` (`meta.heygenVideoId`) and enqueues `probe`. Timings carry `heygen_wallet_before/after` and `heygen_cost_usd` |
| `probe`          | `{ source_key, language_hint: "auto"\|"en"\|"hi"\|"hinglish", max_duration_sec? }` |
| `transcribe`     | `{ source_key, language_hint }` (enqueued by `probe` with the same `job_id`); applies safe transcript fixes, then enqueues `plan` when `AUTO_PLAN` |
| `plan`           | `{ transcript_version }` → Claude plan, validated in Chromium, saved as `edit_plans` version; enqueues `render_preview` with `then_final` when `AUTO_RENDER` |
| `render_preview` | `{ plan_version?, then_final? }` → 540×960, ultrafast, no grain → asset `preview_540`; with `then_final` it enqueues `render_final` |
| `render_final`   | `{ plan_version?, watermark?: bool }` → `output_1080`, `output_720`, `thumbnail` |
| `analyse_reference` | `{ transcript_version }` — reference matching: enqueued by `transcribe` instead of `plan` when `style_options.source = "reference"` and no `referenceStyle` exists yet. Measures the `reference_video` asset (ffmpeg scene cuts, 8 stills, Pillow colour stats), asks the planner model for a matched `StyleTokens` within the project's `fidelity` (`pace` → direction only · `camera` → + enter/exit/easing/camera/sfx · `look` → + palette/fonts/texture), stores it in `style_options.referenceStyle` (+ `referenceReport`) and enqueues `plan`, which reads the override instead of the preset |
| (inside `plan` / `render`) | stock B-roll: when `style_options.broll` is true, `plan` resolves every `broll` element's `query` on Pexels and stores `source`; `render` prepares that window's frames and passes `broll` to the harness. No key → the plan job fails with a clear message |
| `recut`          | `{ transcript_version, removed: number[] }` — the editor (project page → Edit): cuts the ORIGINAL take (the first `source_video` without `meta.cleanCut`) to every word of `transcript_version` not in `removed` (`cleancut.plan_kept`: same padding and pause rules as Clean cut), replaces any earlier cut with `source_edit_*.mp4` (`meta: cleanCut, userEdit, cleanCutOf, removedIdx, transcriptOf, keep`) and enqueues `probe` on it. `transcribe` records `meta.transcriptVersion` on each take and, on an uncut take, `meta.suggestedCuts` (fillers, repeats, earlier takes of a line) for the editor |
| `export`         | `{ format: "1:1" \| "4:5" \| "16:9" }` — the latest `output_1080` fitted whole on a blurred, darkened copy of itself (`media.export_shape`), asset `export` with `meta.format` (one per format). A failure ends the job `done` with the reason in its message: the reel itself is untouched |
| `cleanup`        | `{ keep_outputs: bool }`                                                |

Every mix is levelled to -14 LUFS (true peak -1.5 dB, then a limiter at -2 dBFS for AAC headroom);
`style_options.studioSound` also cleans the voice first (high-pass 80 Hz, `afftdn`, a gentle compressor).

One `jobs` row follows a pipeline run through its stages; the worker re-enqueues the next stage with
the same `job_id` (and updates `jobs.type`). `plan_version` defaults to the latest `edit_plans` row.

## Progress message (`PUBLISH rasika:progress:<job_id> <json>`)

```json
{
  "v": 1,
  "job_id": "uuid",
  "status": "probing",
  "progress": 42,
  "message": "Timing every word…",
  "timings": { "elapsed_sec": 12.3, "probe_sec": 1.1 },
  "error": null,
  "at": "2026-10-18T00:00:12Z"
}
```

`status` follows the `edit_jobs.status` state machine from the spec:

```
uploaded → probing → transcribing → awaiting_transcript_review → planning
  → awaiting_plan_review → rendering_preview → ready_preview → rendering_final → done
  (any) → failed | canceled
```

## Guarantees

- Every handler is **idempotent**: re-running a job with the same `job_id` and `attempt`
  overwrites its own outputs and never double-charges credits.
- A job stuck past `WORKER_JOB_TTL_SEC` is re-queued with `attempt + 1`; after 3 attempts it is
  marked `failed` and credits are refunded (Phase 7).
- Per-stage timings are always written into `timings` so `docs/costs.md` can be kept honest.
