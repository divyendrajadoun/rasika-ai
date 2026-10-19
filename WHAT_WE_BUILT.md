# Rasika: what we have built (as of 19 Oct 2026)

Rasika is an AI reel editor. You upload a talking video (or a script, a reference reel, or a
one-line brief) and it returns a finished vertical 1080×1920 MP4. The output has poster type,
word-timed captions, your photos placed on the exact word, motion graphics and sound design.

## How to open it

Double-click **`rasika.bat`** in the project folder. It:
1. starts Docker Desktop if it is not running, then waits for it (up to 10 min);
2. runs `docker compose up -d` (Postgres, Redis, RustFS storage, the render worker);
3. starts the web app on http://localhost:3000 (building it first on a first run) and opens the browser.

Close the "Rasika web" window to stop the web app. The containers keep running until you stop
Docker or run `docker compose down`.

## The parts

| Part | Where | What it does |
| --- | --- | --- |
| Web app | `apps/web` (Next 15, React 19, Tailwind v4) | landing page, login (Supabase), dashboard, the new-reel wizard, results; liquid-glass UI |
| Worker | `apps/worker` (Python 3.12, in Docker) | probe → transcribe (Deepgram Nova-3, faster-whisper fallback) → Claude planner → Chromium render → sound mix |
| Engine | `packages/engine` | deterministic motion engine: a plan JSON becomes frames |
| Schema | `packages/schema` | the plan format (Zod), the validator and **100 style presets** |
| Storage / queue | Docker: RustFS (S3), Redis, Postgres | uploads, jobs, renders |

## What a user can make (wizard → Source)

1. **My video**: upload a talking take, pick one of the styles, and add photos and brand details.
2. **Script only**: type a script and get a captioned reel with the voice generated.
3. **AI presenter**: a script plus a photo or stock look, and an avatar speaks it (the provider is not named in the UI).
4. **Match a reference**: upload your take and a reel whose style you like. Rasika reads the
   reference (type, colours, pace, framing, motion) and copies the look. No preset is needed.
5. **From a brief** (new, no footage needed). See `docs/briefs.md`:

| Film | What you give | What you get |
| --- | --- | --- |
| SaaS launch film | the product's website link | 25–30 s with real screenshots in moving browser windows |
| 15 s motion showreel | a website link | kinetic type on the beat, the site's screens flying through |
| Apple-style app film | the app's website link | 30 s keynote-style, one idea per shot |
| Recipe explainer | the recipe with measures | a glass fills layer by layer, each measure labelled |
| Versus: comic fight | two contenders (+ winner) | 1 min arcade fight with an announcer; names only, no likenesses |
| Music machine | one line + closing words | 20 s: the line becomes a machine and the ball plays notes |
| Storybook journey | what the story is about | 30 s Grand Budapest-style window through the seasons |
| Animated explainer | a topic or question | 40–60 s Kurzgesagt-style: illustrated world, flying bee host, numbers as little figures, narrated |
| Editorial explainer | a topic or story | 40–60 s Vox-style: paper clippings with a red marker, narrated |
| Tier list | what to rank | 25–40 s: S–D board, each pick flies into its tier on the word, narrated |

Website links are captured safely: the worker refuses private, internal and loopback addresses.

## Styles

There are 106 presets. These cover the house looks, the 14 originals, the community looks measured
from the awesome-claude-video-skills repos, and the brief and film looks (saas-launch,
showreel-kinetic, recipe-explainer, versus-arcade, music-machine, grand-budapest, punchy-fun). Every
style has its own fonts, motion, caption format and sound kit, plus a real rendered demo on the landing page.

## Looks from the six linked repos (19 Oct)

| Look | From | How to get it |
| --- | --- | --- |
| **AI Studio** (extended) | hassancs91/claude-youtube-editor | My video → record yourself explaining; add product screenshots on the photos step (they scroll in browser windows); turn on Clean cut |
| **Kurz Explainer** | BusyBee3333/animated-explainer-skills | From a brief → Animated explainer → type a topic |
| **Clean Cut Mono** + the **Clean cut** option | Agentchengfeng/chengfeng-videocut-skills | My video → record yourself talking → Clean cut on (style step) → this style |
| **Vox Paper** (extended) | jaredcassoutt/vox-editorial (vox-skill) | My video (narrate the story) or From a brief → Editorial explainer |
| **Cut-Paper Vivid** | jaredcassoutt/vox-editorial (vox-editorial) | My video → add 4–8 photos; they become sticker cut-outs |
| **Paper-Cut Red** | crawfordxx/paper-cut-video-skill | My video → record a tutorial, add photos of each step; Clean cut on |
| **Tier List** | hypit-ai/hypit (ranking) | From a brief → Tier list → the topic; or My video ranking things aloud |
| **Podcast Glow** | hypit-ai/hypit (podcast) | My video → upload a podcast clip; Clean cut on |

The style step shows these steps under the grid when the look is picked ("How to get this look").

**Clean cut** (all four cutting repos do this): the worker takes ums/uhs, words said twice and pauses
longer than 0.6 s out of a recorded take (each word keeps 80 ms before and 150 ms after; a long pause
closes to 0.35 s), then measures the cut again so captions land exactly. What it removed is kept in the
project's audit log.

What these repos do that Rasika does not (honest): Hypit's generated hosts and voices (Seedance, Fish
Audio), the Kurzgesagt MorphSVG "fuse" morphs, real-photo cut-outs lifted by macOS Vision, and 16:9.

## Extras

- Stock B-roll from Pexels, with photographer credit under the reel.
- A synthesised music bed, ducked under the voice.
- An SFX kit per style, with an intensity slider.
- A GPU worker in Docker (transcription in seconds), plus stale-job detection and Retry on the dashboard.

## Commit history (short)

Phase 0 foundations → Phase 1 landing → Phase 2 auth, dashboard, uploads → Phase 3 engine and
schema → Phase 4 worker pipeline → Phase 5 Claude planner → styles (14 → 93 → 100) → script-only
and reference modes → B-roll → AI presenter → UI redesign (taste-skill) → liquid glass UI →
reference with no preset → films from a brief. See `git log` for every step.

## Known limits (honest)

- Vertical 9:16 only.
- No generated video, characters or lip-sync in brief films. Everything is drawn by the engine or is
  a real screenshot. (A brief like the "Claude Pop" music video needs generative video plus lip-sync
  services, which Rasika does not use.)
- The fight shows names and colours only, never a real person's likeness.

## Docker note (19 Oct)

Docker Desktop's engine got stuck in "stopped" or "starting". It recovered on its own after about
7 minutes (engine 28.0.4). If it happens again: quit Docker Desktop, run `wsl --shutdown` in a
terminal, then start Docker Desktop again (or just double-click `rasika.bat` and wait).

## Housekeeping

- Secrets live only in `.env` (gitignored).
- **Rotate the API keys that were pasted in chat**: Anthropic, Higgsfield, Deepgram, Pexels and the avatar provider.
