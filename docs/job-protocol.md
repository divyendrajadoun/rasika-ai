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

`payload` per type (filled in from Phase 4 onward):

| type             | payload                                                       |
| ---------------- | ------------------------------------------------------------- |
| `probe`          | `{ source_key }`                                              |
| `transcribe`     | `{ audio_key, language_hint: "auto"\|"en"\|"hi"\|"hinglish" }` |
| `plan`           | `{ transcript_version, style, brand, images[] }`              |
| `render_preview` | `{ plan_version }` (540×960, ultrafast, no grain)             |
| `render_final`   | `{ plan_version, watermark: bool }`                           |
| `cleanup`        | `{ keep_outputs: bool }`                                      |

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
