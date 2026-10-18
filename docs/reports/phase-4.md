# Phase 4 report — Worker: probe, transcribe, render (2026-10-18)

## Built

- **Probe & prep** (`pipeline.probe`): ffprobe → duration, size, rotation, fps, codec, audio;
  rejects clips over the plan limit (`max_duration_sec` from the web); non-vertical sources are
  auto-cropped to 9:16 by every ffmpeg pass. Produces `voice.wav` (48 kHz) + `audio16k.wav`, a
  normalised H.264 1080×1920 30 fps **proxy** (asset `proxy`), and 6 **keyframes** (asset
  `keyframe`) for the planner. Source asset meta gets the probe data; the project gets its
  duration. Then it enqueues `transcribe` on the same job.
- **Transcription** (`transcribe.py`): `Transcriber` interface; `FasterWhisperTranscriber`
  (large-v3, `word_timestamps`, VAD filter, brand name + photo labels as the initial prompt) and
  the `HostedTranscriber` adapter stub (`// MOCK`, raises until a vendor is chosen). Language is
  auto-detected on the first 30 s and **verified** by decoding 12 s in both `en` and `hi`; a
  confidence × script × variety score picks the winner (the reference lesson: Hindi forced on
  English speech gives garbage). `hinglish` → `hi` so Hindi words land in Devanagari. Words are
  stored as a new `transcripts` version; the job stops at `awaiting_transcript_review` with an
  honest message (planning is Phase 5). `align.realign` ports mikku's difflib re-timing for
  transcript edits.
- **Render** (`render.py`): frames extracted at render time only (`fps=30`, crop 9:16, `-q:v 3`;
  540×960 for previews), the engine harness built per job (bundle + `config.js`), cues pulled
  from the engine (`window.__cues`), the timeline split into ≤ N chunks of ~12 s on frame
  boundaries, **one headless Chromium per chunk in its own process**, JPEG frames piped into
  ffmpeg with identical settings (libx264 crf 20 medium, yuv420p, fixed GOP 30, no scene cut),
  concat demuxer without re-encode, `sfx.py` → `sfx.wav`, mix voice 1.0 + sfx 0.45 (+ optional
  licensed music bed ducked with `sidechaincompress`, behind `ENABLE_MUSIC_BED`), `alimiter`,
  mux with `+faststart`, a 720p share copy, a thumbnail from the reveal moment. Frames and
  segments are deleted right after. Preview renders use `ultrafast`, crf 28, no grain.
- **Outputs → S3 + DB**: `output_1080`, `output_720`, `thumbnail` (project thumbnail) or
  `preview_540`; `jobs.timings` carries every stage; `audit_log` records the render.
- **Cleanup** job (`keep_outputs`), per SPEC §7.7.
- **CLI** (`python -m rasika_worker.cli`): `render-local` (plan + words + images + video → MP4, no
  DB), `transcribe-local`, `run-plan` (seed images/transcript/plan on a project and enqueue a
  render), `enqueue` (re-run from `probe`).
- **Web**: project page shows the timed transcript, the final MP4 player with 1080p / 720p
  downloads and render metadata, the 540p preview when that is all there is, and a link to the
  engine dev player; progress view understands the waiting states; `createEdit` passes the plan's
  length limit to the worker; new asset kinds `keyframe`, `preview_540`.
- **Docker**: multi-stage image builds the engine bundle with Node, installs faster-whisper (CPU),
  caches the model in a compose volume; `.dockerignore` keeps the context small.

## Acceptance — the hand-written plan over the original video

`render-local` with the Baisa plan on IMG_7571.MP4 (90.1 s HEVC, 2 703 frames), 8 parallel chunks
(the spec's 8-vCPU target, on a 24-thread desktop):

| Stage                                    | Seconds |
| ---------------------------------------- | ------- |
| voice + 16 k audio extraction            | 3.2     |
| frame extraction                         | 6.4     |
| harness load + cue derivation            | 1.1     |
| render (8 × Chromium, 2 703 frames)      | 121.0 — 22.3 frames/s aggregate |
| concat                                   | 0.5     |
| sfx + mix + mux                          | ≈ 4     |
| 720p copy + thumbnail                    | 13.0    |
| **total**                                | **148 s** (target: < 240 s) |

Through the queue on the uploaded project (`jobs.timings`): probe 0.5 s, audio 0.3 s, proxy
17.5 s, keyframes 1.3 s, **transcribe 455 s** (large-v3 int8 on CPU incl. model load, detection and
the two verification probes — slow; see decision 5), frames 6.2 s, render 133 s, derivatives 12.8 s,
upload 1.2 s → the render job finished in 160 s wall-clock.

Output: 1080×1920 H.264 30 fps, AAC, 90.10 s, 189 MB (16.5 Mb/s at crf 20 — grain costs bits);
720p copy 32 MB. Stills at 13.3 s, 52 s and 75.6 s match the golden reference frames (same
engine, same plan, now with the real voice and the derived SFX underneath).

| Check                                                                    | Result |
| ------------------------------------------------------------------------ | ------ |
| MP4 matches the reference edit (engine already golden-tested; outputs eyeballed at 3 stills) | ✅ |
| 90 s reel renders in under 4 min with 8 chunks                           | ✅ 148 s |
| Per-stage timings logged (`jobs.timings` / CLI JSON)                     | ✅     |
| Transcription of the raw take (large-v3, CPU int8), language verified    | ✅ 289 words, `en` (detector p=0.99; probes en 0.91 vs hi 0.57), 269/284 words match the hand alignment with median drift 0.12 s (p90 0.38 s), mean word confidence 0.94 |
| Queue path: probe → transcribe → (run-plan) → render_final → dashboard download | ✅ one `jobs` row through the stages; project page shows transcript, 1080p player, 720p copy, thumbnail on the card |
| Worker: ruff · mypy strict · 13 tests; web: lint · typecheck · tests · build | ✅ |
| Golden SSIM test still green after the harness `scale` option            | ✅ 54/54 |
| Docker image builds (engine stage + worker stage)                        | ✅ 3.2 GB; bundle, fonts, faster-whisper and ffmpeg verified inside the container |

## Mocked / deferred

- `HostedTranscriber` is a stub (`// MOCK`) until you pick the vendor.
- Claude transcript-correction suggestions, the planner and face detection (`faceBox`/`freeZone`)
  are Phase 5; after `transcribe` the job waits at `awaiting_transcript_review`.
- `watermark` is accepted in the payload and ignored until Phase 7.
- Music bed: wired (`MUSIC_BED_PATH`, sidechain ducking) but off by default; no library yet.
- Retry/re-queue on TTL (`WORKER_JOB_TTL_SEC`) and credit refunds are Phase 7.

## Decisions to review

1. **SFX gain**: `deriveSfx` already scales every cue by `intensity`; the mix adds a flat 0.45.
   Multiplying by intensity again (a literal reading of §7.6) would make low intensities nearly
   silent.
2. **crf 20 with film grain ≈ 16 Mb/s**. Instagram re-encodes anyway; if upload size matters,
   add `-maxrate 12M -bufsize 24M` (one line in `media.py`).
3. **One `jobs` row per pipeline run**: `probe` re-enqueues `transcribe` with the same `job_id`
   and the row's `type` follows the stage, so the dashboard's SSE stream keeps one timeline.
4. **ffmpeg compatibility**: the mix uses `amix … ,volume=n` instead of `normalize=0`, which this
   machine's ffmpeg build rejects; identical result.
5. **Transcription speed**: large-v3 int8 on CPU ran at ~5× real-time here (455 s for 90 s,
   beam 5, plus two 12 s verification decodes). The 8-vCPU render budget is fine, but transcription
   dominates the pipeline on CPU. Options: `WHISPER_MODEL=medium` (≈ 2× faster, slightly worse
   Hindi), `beam_size=1`, or a GPU worker (`WHISPER_DEVICE=cuda`, `float16`: seconds). The model
   (~3 GB) downloads on first use into `WHISPER_CACHE_DIR` (a compose volume).
6. **Whisper output is lower-case with no punctuation** when an `initial_prompt` of vocabulary is
   given (and spells "jewelry"); the Phase 5 correction pass should restore casing and British
   spellings before captions use it.

## Next

Phase 5: transcript-correction suggestions (Haiku), the planner prompt + structured output with
the schema, validator + auto-fix + one repair loop, plan versioning; face detection for the subject
box; `docs/planner-eval.md`.
