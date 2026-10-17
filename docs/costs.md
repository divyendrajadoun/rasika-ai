# Cost & performance notes

Kept up to date per phase. Numbers marked _(est.)_ are estimates until the admin page
(Phase 8) reports real averages from `jobs.timings`.

## Per-reel cost drivers (90 s reel)

| Driver                              | Model / resource    | Est. per reel    | Notes                                              |
| ----------------------------------- | ------------------- | ---------------- | -------------------------------------------------- |
| Planner call (vision + ~20K in/8K out) | `claude-opus-5-5`  | _(est.)_ ₹25–40  | Style guide + schema + few-shot prefix cached      |
| Transcript fixes, style-text parse  | `claude-haiku-5-5`  | _(est.)_ < ₹1    | 1–2 small calls                                    |
| Transcription                       | faster-whisper CPU  | _(est.)_ 1–3 min | int8 large-v3; GPU optional                        |
| Render (chunked, 8 vCPU)            | Playwright + ffmpeg | _(est.)_ < 4 min | ≈9 s compute per second of video, parallelised     |
| Storage (30-day retention)          | R2                  | negligible       | source 100–500 MB + outputs; frames deleted post-render |

## Caching plan

- Prompt caching for the style guide + JSON schema + golden few-shot: identical across jobs.
- Proxy video + keyframes are reused across re-plans; frames are extracted only at final render.

## Measured (fill in from Phase 4)

| Stage        | p50 | p95 | Notes |
| ------------ | --- | --- | ----- |
| probe        |     |     |       |
| transcribe   |     |     |       |
| plan         |     |     |       |
| render_final |     |     |       |
