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

## Mocked / deferred

- The transcript **review UI** (SPEC §7.3) is Phase 6 with the editor; suggestions are stored,
  not yet shown. Safe fixes are applied automatically so captions already carry casing.
- Watermark on the free tier, credits deduction/refund: Phase 7.
- `HostedTranscriber` remains a labelled stub.

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
