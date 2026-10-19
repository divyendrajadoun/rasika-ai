# Phase 5 report — Planner, plus the industry-agnostic landing (2026-10-18)

## What changed in positioning

Rasika is for **anyone who talks to camera** — realtors, doctors, coaches, founders, chefs,
lawyers, agencies — not for one jewellery brand. The Baisa Bling reel stays as the *proof* (the
real before/after and the few-shot example of craft), but every word of product copy, the wizard
placeholders, the OG image and the planner prompt are now industry-neutral. Renaming the product
itself is still one file (`apps/web/src/config/brand.ts`).

## Built

### Landing page (`/`)

- New hero: **"TALK TO YOUR PHONE. POST LIKE A STUDIO."** with an industry-neutral sub line and
  trust row ("Any industry · English + Hindi · 1080 × 1920 · No timeline, ever").
- New **Industries** section right under the hero: an editorial index (01 · REAL ESTATE … 08 ·
  AGENCIES) and a live mini stage that re-plays the beat for the chosen industry — poster lines
  rising, a counter rolling in (₹ lakhs, reasons, orders, minutes…), a chapter stamp, a polaroid
  landing on the word, a one-word caption. Each item links to `/dashboard/new?industry=<id>`,
  which seeds the wizard's style wish with an industry-specific brief. Keyboard-navigable tabs,
  reduced-motion respected, pure CSS loops plus one counter effect.
- Before/after keeps the real footage, labelled honestly as a jewellery brand's take.
- Feature, how-it-works, FAQ and SEO copy rewritten for any industry (say "balcony", the balcony
  lands; prices become counters; "first, second, third" become chapters).
- Removed the jewellery-specific "Who it's for" block; brand footer says "Made in India".

### Worker — SPEC §7.2 / §7.4 (Phase 5)

- **Transcript correction** (`transcript_fix.py`, prompt `prompts/transcript-fixes.md`, Haiku):
  same-length word list with safe fixes (casing, proper nouns, brand, British spellings,
  numerals, punctuation) applied as a new transcript version; uncertain changes stored as
  suggestions in `audit_log`; every applied change must still be recognisably the same token, so a
  bad answer cannot corrupt the transcript. Timings are never touched.
- **Face detection** (`face.py`): OpenCV Haar cascade (bundled XML) on the six keyframes → median
  face box widened for hair/chin, the free zone above the head, a prop point below the chin; a
  centred default when no face is found (synthetic reels).
- **Planner** (`planner.py`, prompt `prompts/planner.md`): Claude Opus gets the transcript as
  `index|start|word`, the six keyframes, the subject, the user's images with labels and
  "show when I say" hints, the style tokens + free-text wish + brand, and the Plan JSON Schema as
  a tool (`emit_plan`). The prompt + reference style guide + the Baisa few-shot are one cached
  system block (prompt caching confirmed: 22.5 K tokens cached, read back on the repair call).
  `tool_choice` is `auto` because Opus 5.5 rejects forced tool use; a JSON-in-text fallback exists.
  Pinned fields (`version`, `meta`, `style`) are normalised after the call.
- **Validation in Chromium** (`ChromiumValidator`): the same `validatePlan` the editor will use,
  run inside headless Chromium from the engine bundle with real canvas font metrics
  (`measureTextCanvas`). Hard errors trigger **one repair round** with the error list; the better
  of the two answers is kept. The validator now also *fixes* colour context (light-wall tokens on
  the dark stage are swapped to ivory/gold) instead of only warning.
- **Plan versioning**: every plan is an `edit_plans` row with the validator report; the render
  picks the latest or `plan_version`.
- **Chain**: `transcribe → (fix) → plan → render_preview → render_final`, all on one `jobs` row,
  behind `AUTO_PLAN` / `AUTO_RENDER` (both on). The 540p preview lands first; the project page
  shows it while the 1080p render follows.
- **CLI**: `plan-local` (words + video + images → plan, raw answer, validator report, token usage).
- **Test reels**: `tools/testreels/make_testreels.py` builds two synthetic talking-head reels with
  Windows TTS (a Pune realtor listing, a doctor's sleep explainer) so the planner is exercised
  outside the few-shot's industry. `docs/planner-eval.md` holds the rubric and scores.
- Docker image carries the schema, presets, few-shot plan and style guide; `anthropic` and
  `opencv-python-headless` join the `ml` extra.

## Acceptance

| Check                                                                                  | Result |
| -------------------------------------------------------------------------------------- | ------ |
| Plans pass validation on 3 test reels                                                  | ✅ Baisa (2 attempts, 0 errors), realtor (1 attempt, 0 errors), doctor (1 attempt, 0 errors) |
| Every on-screen phrase complete, fragment-free                                         | ✅ Baisa 5/5 and realtor 4/5; doctor 3/5 (two borderline lines, prompt rule added) — `docs/planner-eval.md` |
| `docs/planner-eval.md` with rubric + scores                                            | ✅     |
| Full chain through the queue on the uploaded project (probe → transcribe → fix → plan → preview → final) | ✅ transcript v4 (289 words), plan v4 (47 elements, 2 attempts, 0 errors), 540p preview then 1080p + 720p + thumbnail; plan 181 s, render 113 s |
| Landing renders at 390 / 1440 with no console errors, no horizontal overflow          | ✅ (one overflow found and fixed: `min-w-0` on the industries grid) |
| Worker: ruff · mypy strict · 18 tests; web: lint · typecheck · 12 tests · build; schema 10 · engine 14 tests | ✅ |

Token use per plan (Opus): ≈ 10–17 K input (≈ 22 K more from cache on repairs), 8–14 K output,
73–176 s. See `docs/costs.md`.

### Two silent failures found by the queue run, and their guards

1. The planner hit the 16 K output cap on the 90 s reel; the SDK handed back an *empty* tool input,
   which validated as a plan with zero elements and rendered a reel with no graphics. Now:
   32 K output budget via **streaming** (the SDK refuses large non-streamed calls), a retry asking
   for a tighter answer when `stop_reason == max_tokens`, and a hard floor of one element per 8 s
   (min 3) — below it the job fails loudly instead of rendering nothing. Covered by three unit
   tests with a fake client.
2. The Haiku fix pass overflowed its 4 K budget on 289 words and returned unusable JSON (it fell
   back to the raw transcript, so nothing broke). Budget is now 8 K with a compact-output
   instruction.

## Follow-up (same day): 14 styles, real demos, premium landing

- **Ten new presets** (Creator Yellow, Editorial Ivory, Clinic Clean, Brutalist Acid, Cinema Bebas,
  Paper Collage, Neon Pop, Sage Wellness, Boardroom Navy, Festive Bandhani) next to the four from
  the spec, informed by the caption styles short-form editors use in 2026 (word-by-word karaoke
  with one lit accent word, boxed active word, clean lower-third sentences) and the "editing
  aesthetics" lists; nine new OFL fonts bundled.
- **Engine**: per-style fonts (real family names, only the needed `@font-face` rules, loaded in
  `ready`), three new caption formats (`karaoke`, `box`, `clean`) plus `captionAccent`; the golden
  test is unchanged (Mikku Royal renders pixel-identical).
- **Landing**: the Styles section is now a real compare — the same 12 s of the owner's take rendered
  in all 14 styles by the engine (`tools/styledemos`), with a draggable raw-vs-style phone and
  hover-to-play cards; the Industries phone plays the real render in the style suggested for that
  industry; glass nav, glow behind the hero phone, honest "real take · rendered by Rasika" labels.
- **Real images**: every image-generation provider reachable from this machine was out of credit
  (Gemini quota, OpenAI, fal, Replicate, Higgsfield 1.2 credits), so the "real" imagery is the
  owner's real footage rendered by the engine rather than generated portraits. A one-command
  generator (`scratchpad/genimg.py`, Gemini → OpenAI fallback) is ready for per-industry portraits
  once a key has credit.
- The awesome-claude-video-skills list the owner sent is a catalogue of code-video *tools* (HyperFrames,
  Remotion, collage/explainer skills), not of caption/motion presets; the useful signal from it was
  the kinetic-caption and collage looks, which fed Paper Collage and the karaoke/box formats.

### Follow-up 2: wizard bug, community looks, Higgsfield key

- **Bug fixed**: the wizard's submission schema still hard-coded the four original preset ids, so
  picking any new style failed with "Invalid option". It now validates against `presetIds` from
  `@rasika/schema`, so new presets work everywhere automatically (checked both ways).
- **Community looks section**: twelve preview clips from the owner's
  `awesome-claude-video-skills` list (kinetic captions, Apple-style motion, whiteboard, 3Blue1Brown
  explainers, launch kits…), converted from the list's GIF previews to ~20 KB MP4 loops, shown
  with owner/repo credit and a link to each repo, labelled honestly as other tools' renders and
  "styles we're adding next" — never presented as Rasika output.
- **Higgsfield platform key** stored in `.env` (`HIGGSFIELD_API_KEY/SECRET`, never committed). The
  SOUL v2 text-to-image call is wired (`scratchpad/hf.py`) but the account answered
  `not_enough_credits`; the eight per-industry portraits generate in about a minute once it is
  topped up.
- Lighthouse mobile after the section: perf 82 · a11y 100 · seo 100 · best practices 100.
- **Industry portraits generated** once the Higgsfield platform account had credit: eight
  selfie-style photorealistic portraits (SOUL v2, one per industry, Indian subjects in their own
  settings), cropped to 4:5 and optimised to 50–110 KB (`tools/portraits/prepare_portraits.py`),
  shown as avatars in the industry index and as a polaroid beside each beat. They are labelled
  as the kind of person each beat is for — the phone next to them still plays a real render.

### Follow-up 3: the Docker worker on a real user clip, and "it hangs"

Running a user's own Hindi clip through the compose worker exposed container-only gaps that the dev
venv never hit — all fixed and committed: PyAV 19 vs faster-whisper (pinned <19), a blank
`ENGINE_DIR=` from `.env.example` overriding the image path, secrets not loaded from `.env`, the
Playwright base image (v1.49) not matching the package (now both 1.63), Python 3.12's
`communicate()` after a manual `stdin.close()`, and fork-started chunk processes on Linux (now spawn).
Full tracebacks are now logged and kept under `work/_failures/`.

"Hangs": CPU transcription at ~5× real time with progress only per 30 s window. Fixes: the worker
transcribes on the host GPU (CUDA libs in the image, `deploy.resources` GPU reservation, automatic
CPU fallback), every stage publishes a heartbeat every 15 s with elapsed time, and the project page
shows a **Retry** button when a run fails or reports nothing for 2 minutes. A dark-wall check from
the keyframes now switches poster text to ivory/gold when the speaker's wall is dark.

## Mocked / deferred

- The transcript **review UI** (SPEC §7.3) is Phase 6 with the editor; suggestions are stored,
  not yet shown. Safe fixes are applied automatically so captions already carry casing.
- Watermark on the free tier, credits deduction/refund: Phase 7.
- Transcription moved to Deepgram Nova-3 (`DeepgramTranscriber`, `language=multi` so Hinglish keeps English words in Latin script; language inferred from the Devanagari share). `TRANSCRIBER=auto` uses it whenever `DEEPGRAM_API_KEY` is set and falls back to faster-whisper on any API error (`FallbackTranscriber`, reason recorded in the transcript notes). Measured on the owner's 42 s clip inside the container: 3.1 s vs 72 s (GPU, cold) / 179 s (CPU).

## Decisions to review

1. **Auto-chain by default.** After transcription the worker plans and renders without a review
   stop, because "working prototype first". Set `AUTO_PLAN=false` to stop at the transcript, or
   `AUTO_RENDER=false` to stop at the plan, once the review UIs exist.
2. **Opus for planning, Haiku for fixes**, as the spec asks. A full reel costs roughly ₹… — see
   `docs/costs.md` for the token numbers; switching the planner to Sonnet is one env var.
3. **The few-shot is still the jewellery plan.** It teaches craft, and the prompt tells the model
   not to borrow its vocabulary; the realtor and doctor plans show it does not. A second few-shot
   from another industry would make this more robust once a real reel exists.
4. **Synthetic test reels** stand in for the three reels you said you would provide. They go
   through real transcription and planning, but a drawn head gives no face detection and TTS has no
   emphasis, so the planner's choices on real footage will be richer.
5. **Colour-context auto-fix** is new behaviour in `validatePlan`: it now changes tokens rather
   than warning. If you prefer warnings only, it is one block in `validate.ts`.

## Next

Phase 6: the editor — live preview with the engine, timeline, properties panel, retime-to-word,
regenerate a beat, undo/redo, style switcher, transcript review with the stored suggestions,
render final from the editor, export page.

## Follow-up (19 Oct): motion styles — every preset moves and sounds differently

**The problem.** A preset was palette + fonts + caption format. Motion was the same for all of
them (one beat structure, one worked example, one synthesised sound bank), so the 14 landing demos
were literally one hand plan re-skinned, and a dashboard edit in "Paper Collage" was the Mikku
edit in beige. The community looks section showed other tools' videos and linked out to GitHub.

**What changed.**

- `StyleTokens.motion` (`packages/schema/src/style.ts`): family · enter · exit · easing · speed ·
  camera · sfxKit · texture · direction · avoidElements, all defaulted to the house editorial motion
  so old plans render identically (golden stills: 0 failures).
- Engine: per-family stage class + CSS for cards/locks/stamps and six stage textures; seven
  typography entrances and five exits; four camera behaviours (`modes.ts`); per-family card
  choreography (`elements.ts updateItem`); mixed-case families don't uppercase type; two new fonts
  (Kalam for Devanagari + Latin hand, Permanent Marker). The cue sheet carries the kit.
- Worker: `sfx.py` renders seven kits (pop · click · marker · chalk · hype · cinematic · none) —
  eleven new generators (air, swell, click, thud, scribble, tap, chalk, drop, zap, shimmer, boom).
  The planner receives a **Motion direction** section per style (direction text, prefer / never
  lists, entrance / camera / kit), the system prompt explains the seven families and that the
  direction overrides the editorial beat table; banned elements are dropped in `_normalise`;
  shouted lines are sentence-cased for the mixed-case families.
- Presets: the 14 existing ones each got a motion block; five new looks built from the
  awesome-claude-video-skills list run entirely inside Rasika — **Kinetic Mono** (Apple-recap
  kinetic type: blur in, dive out, hard cuts, clicks), **Whiteboard Marker** (draw-on, wipes,
  marker scribbles, paper), **Chalkboard Maths** (dim-and-reveal, chalk ticks, board), **Hype
  Cut** (slams, whip camera, zaps and drops, boxed captions), **Launch Spotlight** (slides, glide,
  cinematic swells, vignette).
- Web: the GitHub community section, its JSON and third-party clips are removed — no redirection.
  The styles section shows 19 and explains the families. The wizard's style step plays the real
  demo render of each preset on hover with family + sound chips.
- Demos: `tools/styledemos` now renders each preset from **its own plan**, written by the real
  planner for that style's direction (`tools/styledemos/plans/*.json`, committed).

**Verified.**

| check | result |
| --- | --- |
| schema / engine / web / worker suites | 10 · 14 · 12 · 23 passing; mypy clean; web build clean |
| golden stills (house style) | 54 / 54 ≥ 0.92, unchanged |
| planner obeys direction | whiteboard: equations ×2, strikeLine ×2, counters, 0 stamps / bleed plates / locks; kinetic: 27 poster lines, 0 lock / reveal / stamp; hype: 6 stamps, 4 split cards; chalk: 0 lock / stamp / punch-in |
| 19 plans on the reference take | 35–50 elements each, 98–226 s per plan, all validated |
| 19 demos (12 s, 540p) | 0.6–1.5 MB each, ≈ 11 s per render |
| sound kits | all seven synthesise; `none` is silent |

**Still to do.** The 19 plans share the opening beats the speech dictates (hook → "2000 years"
counter → tease) so the first seconds of some demos rhyme; the families diverge after. A per-family
worked example in the planner prefix would widen that further. The `/dashboard/new?style=` deep
link and the industry hints still work for the new ids.

## Follow-up (19 Oct, later): the twelve community looks, from their own rule files

The owner wanted the styles from the awesome-claude-video-skills list in the dashboard, built
from the skills themselves, and pointed out that edits still shared one pattern.

- **Research.** All twelve repos were shallow-cloned and read (SKILL.md, references, templates);
  four read-only agents extracted typography, colour, motion numbers, transitions, structure, sound
  and bans per repo. The numbers are in `docs/engine.md` → Presets and in each preset's
  `motion.direction`.
- **Nine families, 26 presets.** Two new families — `blocks` (flat colour-block graphics: Showreel,
  Shenghua-adjacent) and `beat` (beat-synced kinetic type) — plus `letters` / `mask` entrances, a
  `push` camera, `solid` / `blocks` plate patterns and JetBrains Mono. Seven new presets (Slam Neon,
  Spotlight Promo, Showreel Blocks, Brand Bar, Beat Type, Motionmaxxed, Sky Cards); the five earlier
  community presets re-tuned to the measured values.
- **Why edits looked alike:** every family was shown the same jewellery worked example, so the
  planner reproduced its hook → counter → lock → reveal spine. The planner now carries **one worked
  example per family** (`apps/worker/prompts/examples/*.json`, a 24 s realtor clip planned seven
  ways, each validated) and caches one system prefix per family.
- **Light stages were broken:** framed modes always took the dark-stage tokens, so a light-stage
  style put ivory type on cream in `card` mode. Engine, validator and planner now read the stage
  luma.
- Dashboard: the style step lists all 26 with their real demo renders; the landing says 26.

Verified: schema 10 · engine 14 · web 12 · worker 23 tests; golden 0 failures; all seven family
examples validate; 26 per-style plans regenerated with the family prefixes and rendered as demos.

## Follow-up (19 Oct, night): every look in the list, and two new ways in

The owner asked for every skill in awesome-claude-video-skills as a dashboard style, and for the
workflow repos (lemo-opuscar, reelmimic, lanshu) to become product options.

- **Research.** 113 candidate repos (all 40 Shorts & social, plus every editing / motion / story /
  explainer / promo / toolkit repo that could define a look) shallow-cloned; six read-only agents
  extracted rules per repo (`extract/group1–6.md` in the session scratchpad). 67 looks became presets
  (93 total); non-commercial / unlicensed repos were read but not copied. The C: drive hit 0 bytes free
  mid-clone — clones moved to `F:/a_openai/1_aa_new/_scratch_rasika`, `.git` and media stripped.
- **Engine.** `steps` easing, `type` entrance, four print textures with light-stage variants,
  `caseStyle`, eight fonts. Light stages now get dark texture lines (`.rk.light`).
- **Script only.** Wizard Source step → StepScript (script, 12 Deepgram Aura-2 voices, length and credit
  estimate) → `createDraftProject` / `createScriptEdit` → worker `synth` (tts.py → narration.wav →
  stage-coloured 1080×1920 source clip → probe chain). Planner gets a "no speaker on screen" brief
  (`style_options.faceless`). English only: Aura has no Hindi voice.
- **Match a reference.** Second drop zone uploads a `reference_video`; fidelity pace / +camera / +look;
  worker `analyse_reference` (ffmpeg scene cuts, 8 stills, Pillow colour stats → one planner-model
  vision call → validated StyleTokens merged by fidelity → `style_options.referenceStyle`) runs between
  transcribe and plan. Smoke-tested on the Slam Neon demo: 2 cuts found, a valid style in 18 s.
- **AI presenter.** Shown in the Source step, disabled with the reason: it needs an avatar + lip-sync
  provider (paid, unapproved).
- **Dashboard.** Family filter chips + search in the wizard and on the landing; each community card says
  which repo it was measured from (text, no link).

Verified: schema 10 · engine 14 · web 12 · worker 37 tests; mypy and ruff clean; all 93 presets parse;
tsc clean. Demo plans and renders for the 67 new presets: see the tail of this report.

**End to end (real worker container, 19 Oct night):** `tools/e2e/script_reel.py` — a 20 s Paper
Manuscript reel from a 66-word script in 152 s (first run showed ivory captions on the cream plate and
empty framed modes; fixed with `plan.meta.faceless` → ink captions, full mode pinned, centred 150–260 px
lines). `tools/e2e/reference_reel.py` — a 12 s take matched to the Slam Neon demo at fidelity `look` in
116 s: 2 cuts measured, the written style "Coral Hook" took the coral `#ff3d5a` accent, kinetic / pop /
cut, and the render shows coral slam words, a pip tease card and coral karaoke.

**Demos (19 Oct, late):** all 67 new presets planned on the reference take (66 first pass; Nativo's
minimal direction tripped the planner's element floor and was re-planned with one small poster line
per key sentence) and all 93 demos re-rendered with the final engine — the material layer, 12 fps
stop-motion for `steps`, linear SFX gain. 0 render errors, 10–16 s each at 540p.

**Two bugs the owner hit while testing, both fixed:** (1) a preset missing from a stale worker image
fell back silently to the house tokens — now a job error naming the style; (2) the SFX slider had a
40 % floor (`0.4 + 0.6·intensity`) — now linear. And the honest reason paper looks did not read even
with the right tokens: the texture only sat behind framed shots; the material now rides the footage.
