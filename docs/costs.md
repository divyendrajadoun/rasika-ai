# Cost & performance notes

Kept up to date per phase. Numbers marked _(est.)_ are estimates until the admin page
(Phase 8) reports real averages from `jobs.timings`.

## Per-reel cost drivers (SPEC §14)

| Driver                       | Where                      | Note                                                         |
| ---------------------------- | -------------------------- | ------------------------------------------------------------ |
| Planner call (Claude Opus)   | worker `plan` (Phase 5)    | vision + ~15–25K input / 5–10K output tokens _(est.)_; cache the style guide + schema + few-shot prefix |
| Cheap Claude pass (Haiku)    | transcript suggestions     | small _(est.)_                                               |
| Transcription compute        | worker `transcribe`        | faster-whisper large-v3, CPU int8 — see measurements         |
| Render compute               | worker `render_final`      | the biggest one: headless Chromium frame capture + x264      |
| Storage                      | R2                         | source + proxy + outputs for 30 days; frames never stored    |

## Measured — Phase 4 (2026-10-18, dev PC: 24-thread desktop CPU, local RustFS)

Baisa Bling, 90.1 s HEVC 1080×1920 source, 2 703 frames, hand-written plan (47 elements).

| Stage                                         | Seconds | Notes                                              |
| --------------------------------------------- | ------- | -------------------------------------------------- |
| probe + voice/16 k audio                      | 0.8     | ffprobe + two ffmpeg passes                        |
| proxy (H.264 1080×1920, veryfast)             | 17.5    |                                                    |
| transcribe (large-v3, CPU int8, 24 threads)   | 455     | incl. model load + en/hi verification probes; GPU → seconds |
| frame extraction (fps=30, crop 9:16, q 3)     | 6.4     |                                                    |
| render, 8 parallel Chromium chunks            | 125     | 21.6 frames/s aggregate; ≈ 2.7 frames/s per chunk |
| concat + sfx + mix + mux + 720p + thumbnail   | 17      |                                                    |

Rule of thumb: render time ≈ `frames / (2.7 × chunks)` seconds; with 8 vCPU a 90 s reel is
≈ 2 min of render plus ≈ 1 min of ffmpeg work. Transcription with large-v3 on CPU int8 is ≈ 5× real-time (measured on 24 threads); `medium` halves
it; a GPU (`WHISPER_DEVICE=cuda`, `float16`) brings it under 15 s _(est.)_.

## Levers

- Chunk count = min(vCPUs, ceil(duration / 12 s)); more vCPUs → near-linear speed-up up to 8.
- JPEG capture quality 95 (final) / 80 (preview); `-preset medium` crf 20 final, `ultrafast` crf 28 preview.
- Frames are extracted only for a render and deleted right after (SPEC §7.7).
