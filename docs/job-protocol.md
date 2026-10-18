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
  "type": "probe | transcribe | plan | render_preview | render_final | cleanup",
  "attempt": 1,
  "payload": {},
  "enqueued_at": "2026-10-18T00:00:00Z"
}
```

`payload` per type:

| type             | payload                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `probe`          | `{ source_key, language_hint: "auto"\|"en"\|"hi"\|"hinglish", max_duration_sec? }` |
| `transcribe`     | `{ source_key, language_hint }` (enqueued by `probe` with the same `job_id`); applies safe transcript fixes, then enqueues `plan` when `AUTO_PLAN` |
| `plan`           | `{ transcript_version }` → Claude plan, validated in Chromium, saved as `edit_plans` version; enqueues `render_preview` with `then_final` when `AUTO_RENDER` |
| `render_preview` | `{ plan_version?, then_final? }` → 540×960, ultrafast, no grain → asset `preview_540`; with `then_final` it enqueues `render_final` |
| `render_final`   | `{ plan_version?, watermark?: bool }` → `output_1080`, `output_720`, `thumbnail` |
| `cleanup`        | `{ keep_outputs: bool }`                                                |

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
