# Cost & performance notes

Kept up to date per phase. Numbers marked _(est.)_ are estimates until the admin page
(Phase 8) reports real averages from `jobs.timings`.

## Per-reel cost drivers (SPEC §14)

| Driver                       | Where                      | Note                                                         |
| ---------------------------- | -------------------------- | ------------------------------------------------------------ |
| Planner call (Claude Opus)   | worker `plan`              | measured: 10–17 K input + 22.5 K cached prefix, 8–14 K output per attempt; a repair round doubles output |
| Cheap Claude pass (Haiku)    | transcript fixes           | ≈ 2–3 K in / 1–2 K out for a 90 s reel                       |
| Transcription                | worker `transcribe`        | Deepgram Nova-3 ≈ $0.0043 / audio-minute (3 s for a 42 s reel); faster-whisper fallback (GPU 72 s cold / CPU 179 s) |
| Stock B-roll                 | worker `plan` + `render`   | Pexels API is free (200 requests / hour, 20 000 / month; clips under the Pexels licence, photographer credited in the plan `source`); one search + one download per cutaway, cached by query and clip id |
| AI presenter (HeyGen)        | worker `presenter`         | PAID from the HeyGen wallet (wallet billing on this account); the job records the wallet before and after each render as `heygen_cost_usd`. Plus the normal plan + render |
| Narration (script-only reels) | worker `synth`            | Deepgram Aura-2 TTS on the same key, billed per character (list price ≈ $0.030 / 1 000 chars → a 60 s script of ~900 chars ≈ $0.03); English voices only — Hindi narration needs a second provider (not approved) |
| Reference matching           | worker `analyse_reference` | one planner-model vision call with 8 stills: measured 18 s, 4.2 k input + 1.7 k output tokens (≈ $0.15 at Opus list price); the ffmpeg/Pillow analysis is free (8 s for a 90 s clip) |
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
≈ 2 min of render plus ≈ 1 min of ffmpeg work. Transcription is Deepgram Nova-3 by default (`TRANSCRIBER=auto` with a key: 3.1 s for the 42 s Hindi test clip, language and Devanagari correct); without a key, or if Deepgram errors, faster-whisper large-v3 runs locally — CPU int8 is ≈ 5× real-time (measured on 24 threads); `medium` halves
it; a GPU (`WHISPER_DEVICE=cuda`, `float16`) brings it under 15 s _(est.)_.

## Measured — Phase 5 planner (Opus 5.5, 2026-10-18)

| Reel         | Attempts | Input tokens | Cache read | Output tokens | Seconds |
| ------------ | -------- | ------------ | ---------- | ------------- | ------- |
| baisa_bling  | 2        | 42 205       | 22 546     | 22 342        | 176     |
| realtor_3bhk | 1        | 10 282       | 0 (cold)   | 10 035        | 94      |
| doctor_sleep | 1        | 10 309       | 0 (cold)   | 7 922         | 73      |

The 22.5 K-token prefix (prompt + style guide + schema + few-shot) is cached for 5 minutes, so
back-to-back jobs on a busy worker pay for it once.

## Measured — Docker worker with the host GPU (2026-10-18, RTX 3060, 44.8 s Hindi clip)

| Stage                                   | Seconds |
| --------------------------------------- | ------- |
| probe + audio + proxy + keyframes       | 12.3    |
| transcribe (large-v3 float16 on CUDA, incl. cold model load + en/hi probes) | 71.9 (CPU int8 on the same clip: 179) |
| transcript fixes (Haiku)                | 5.9     |
| plan (Opus, cold cache)                 | 85.0    |
| preview + final render (8 chunks)       | 85.0 + 8.9 derivatives |
| **total, upload → final MP4**           | **≈ 4.5 min** |

Warm transcription (model already resident) is ≈ 10 s for a minute of speech; the cold load of the
3 GB model from the volume is most of the 72 s above.

## Measured — script-only and reference reels (2026-10-19, Docker worker, host GPU)

| Mode | Reel | Chain | Wall time |
|---|---|---|---|
| Script only (Paper Manuscript, Athena voice, 66 words) | 20 s | synth 12 s TTS → probe → Deepgram 2 s → plan 35–43 s (6.3 k in / 4.5 k out, 24 k cached) → preview + final 68 s | **152 s** |
| Script only + stock B-roll (Cinema Navy, Orion voice, Pexels) | 23 s | as above + Pexels search + download 2.0 s in `plan`, window frames 0.4 s in `render` | **172 s** |
| Match a reference (12 s take, Slam Neon demo as reference, fidelity look) | 12 s | probe → transcribe → analyse 1.6 s + style call 17 s (4.2 k in / 1.8 k out) → plan 36 s → render 33 s | **116 s** |

The script reel's narration costs ≈ 500 characters of Aura-2 (≈ $0.015); the reference style call is one
planner-model vision request (≈ $0.15 at list price) on top of a normal plan.

## Levers

- Chunk count = min(vCPUs, ceil(duration / 12 s)); more vCPUs → near-linear speed-up up to 8.
- JPEG capture quality 95 (final) / 80 (preview); `-preset medium` crf 20 final, `ultrafast` crf 28 preview.
- Frames are extracted only for a render and deleted right after (SPEC §7.7).
