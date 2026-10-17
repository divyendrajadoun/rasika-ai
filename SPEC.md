# BUILD SPEC — "Rasika": AI motion-designed reel editor (SaaS)

> **How to use this file with Claude Code**
> 1. Create an empty folder, put this file in it as `SPEC.md`.
> 2. Unzip `mikku.skill` (it is a zip) into `./reference/mikku/` — it contains the working pipeline this product is built from.
> 3. Start Claude Code in the folder and say:
>    *"Read SPEC.md fully, then read everything in ./reference/mikku/. Build Phase 0 and Phase 1. Stop after each phase, run the acceptance checks, commit, and give me a short report before continuing."*
> 4. Continue phase by phase ("Build Phase 2", …). Don't ask it to build everything in one go.

---

## 0. Role and ground rules for Claude Code

You are the lead engineer and product designer building a production SaaS. Work in phases (Section 12). After every phase:
- run lint, type-check, tests, and the phase's acceptance checks;
- commit with a clear message;
- write a short report: what was built, what's mocked, what's next, and any decision you made that I should review.

Rules:
- **Never fake a feature.** If something is mocked (payments, email), label it `// MOCK:` in code and list it in the report.
- Keep secrets in `.env` only; ship `.env.example` with every key documented.
- TypeScript strict everywhere on the web side; Python 3.11 with type hints in the worker.
- Prefer boring, proven libraries. No experimental frameworks.
- The **render engine must be deterministic**: the same plan JSON + same inputs → the same MP4, frame for frame.
- Ask me before adding any paid third-party service not listed here.

Working product name: **Rasika** (Sanskrit: one who truly *feels* beauty, not just sees it). Put the name, tagline and brand colours in one config file (`apps/web/src/config/brand.ts`) so I can rename it in one place.

---

## 1. What the product does (one paragraph)

A creator or brand uploads a raw vertical talking-head reel (selfie video, 15 s–3 min). Optionally they add photos they want shown ("show this when I say *payal*"), pick a style preset or describe a style in a text box, and add a brand name/handle for the end card. Rasika transcribes the speech with word-level timestamps, lets them fix the transcript, uses Claude to plan a beat-by-beat motion edit (poster typography above the head, one-word captions, image cards landing on exact words, punch-ins, framed-card and picture-in-picture modes, chapter cards, a teased-then-revealed payoff word, an end card, sound effects), shows a **live in-browser preview they can tweak**, then renders a final 1080×1920 MP4 on the server. The default style is exactly the "Mikku" edit in `reference/mikku/references/example_baisa_bling.html`.

---

## 2. Reference material you must study first

`reference/mikku/` contains a working, proven pipeline (built and validated on a real 90 s reel):

| File | What it is | How you use it |
|---|---|---|
| `SKILL.md` | The end-to-end workflow | The pipeline stages map 1:1 to the job stages in Section 7 |
| `references/style-guide.md` | Beat structure, layout zones, palette, captions, SFX map, known bugs | The design system for the default preset **and** the rules for the planner prompt |
| `references/example_baisa_bling.html` | The finished 90 s composition the client loved | **Golden reference.** The new engine must reproduce it from a plan JSON (Section 6.4) |
| `assets/template.html` | Generic version: toolkit, builders, video modes, captions, grain, render contract | Port its logic into the TypeScript engine |
| `scripts/render.py` | Playwright frame-by-frame renderer (`window.renderFrame(t)`, `window.__ready`) | Port into the worker; add chunked parallel rendering |
| `scripts/sfx.py` | Procedural SFX (whoosh, pop, tick, impact, riser, sub, glitch) | Use in the worker as-is (wrap as a module) |
| `scripts/transcribe.py`, `align.py` | VAD + Whisper + word alignment | Replace with a better server transcriber (Section 7.2), but keep the alignment idea for transcript corrections |
| `assets/fonts/` | Anton, Instrument Serif Italic, Inter, Mukta, Tiro Devanagari (all OFL) | Ship with the engine; also use on the landing page |

Read `style-guide.md` section 7, "Bugs already fixed". Those bugs must not come back.

---

## 3. Tech stack (use exactly this unless you have a strong reason; tell me if you deviate)

**Monorepo** (pnpm workspaces + Turborepo):
```
apps/web        Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Framer Motion
apps/worker     Python 3.11 render/transcribe worker (Docker), Playwright + Chromium, ffmpeg
packages/engine The motion engine (TypeScript, zero deps) — plan JSON → frames. Runs in browser (preview) AND headless (render)
packages/schema Zod schemas for the plan JSON + generated JSON Schema for Python (pydantic models generated from it)
packages/ui     Shared UI components (optional)
```

- **Auth:** Supabase Auth (email magic link + Google). Mobile-first.
- **DB:** Supabase Postgres + Drizzle ORM with migrations.
- **Storage:** S3-compatible (Cloudflare R2 by default) with presigned **multipart** uploads. Phone videos are often 100–500 MB HEVC.
- **Queue:** Redis + BullMQ on the web side. The Python worker consumes jobs over Redis; use a simple JSON job protocol, documented in `docs/job-protocol.md`.
- **Realtime progress:** Server-Sent Events from a Next.js route that reads job status from Postgres, or use Supabase Realtime.
- **LLM:** Anthropic Claude API (`@anthropic-ai/sdk`). Planning model `claude-opus-5-5`; cheap tasks (transcript cleanup suggestions, style-text parsing) on `claude-haiku-5-5`. Keep the model IDs in env vars.
- **Payments:** Razorpay (India-first: UPI and cards) behind a `PaymentProvider` interface, with a Stripe adapter stubbed for international users.
- **Email:** Resend ("your reel is ready").
- **Observability:** Sentry (web + worker), structured logs.
- **Deploy:** web on Vercel; worker as a Docker image on any container host with CPU autoscaling (Fly.io / Railway / a VPS). Redis on Upstash or self-hosted. Write a `docker-compose.yml` that runs everything locally.

---

## 4. Brand and design direction (landing page + app)

The product should *look like the edits it makes*: Rajasthani editorial, warm and premium, not a generic purple-gradient AI SaaS.

- **Palette** (from the default preset): stage maroon `#3a0a11`, maroon `#5a0f1a`, terracotta `#c8452f`, gold `#e6b450`, dark gold `#9a6a14`, ivory `#f6ecd8`, ink `#1a0a0c`. Light sections use an ivory background; hero and footer use maroon with a subtle gold-dot **jaali** pattern (copy the `#pattern` CSS from the template).
- **Type:** Anton for big poster headlines (uppercase), Instrument Serif Italic for emotional accent words, Inter for UI/body, Tiro Devanagari for Hindi accents.
- **Motifs:** palace-arch masks (the end card's `arch` shape) for video frames and cards; polaroid image cards with slight tilt; a thin gold rule; film grain overlay at about 5% opacity.
- **Motion:** Framer Motion. Words rise from masks (like the engine's `rise`), cards fly in with outBack, scroll-linked reveals. Respect `prefers-reduced-motion`.
- **Dark mode:** maroon-based dark theme as the default; ivory light theme available. Use CSS variables on `:root`.
- Accessibility: WCAG AA contrast, keyboard navigable, visible focus rings, alt text everywhere.

---

## 5. Landing page (`/`) — section by section

Build it beautifully and responsively (360 px mobile → 1440 px desktop). All copy goes in `apps/web/src/content/landing.ts` so I can edit it.

1. **Nav:** logo wordmark "Rasika" (Instrument Serif Italic, gold), links (How it works, Styles, Pricing, FAQ), and a primary **"Get started"** button (terracotta). The button routes to `/dashboard` and goes through auth first if the user is logged out.
2. **Hero** (maroon jaali background):
   - Headline in Anton: **"YOUR REEL. EDITED LIKE A STUDIO DID IT."** Rising-word animation. "STUDIO" in gold.
   - Sub line in Instrument Serif Italic: *"Upload a talking video. Get poster type, captions, images on the exact word, and sound — in minutes."*
   - Primary CTA **"Get started — it's free"** → `/dashboard`. Secondary CTA **"See an example"** scrolls to the before/after.
   - Right side, or below on mobile: a phone mockup with an **arch-masked** looping demo video (`/public/demo/after.mp4`; use a placeholder until I supply mine).
   - A small trust row: "Hindi + English captions · 1080p · Your photos, your story".
3. **Before / After:** two phone frames side by side with a draggable split slider between the raw clip and the edited clip (placeholders `/public/demo/before.mp4`, `/public/demo/after.mp4`), with synced playback.
4. **How it works:** three numbered chapter cards styled like the edit's "01 / 02 / 03": *Upload your reel* → *Add photos & pick a style* → *Preview, tweak, download.*
5. **What the edit does:** a feature grid with a tiny looping animation in each card: poster typography, one-word captions, images on the exact word, prop punch-in, picture-in-picture plates, mystery-word reveal, sound effects, Hindi in Devanagari.
6. **Style gallery:** cards for each preset (Section 8) with a looping preview. Clicking one opens `/dashboard/new?style=<id>`.
7. **Who it's for:** jewellery & fashion brands, D2C founders, educators, creators, agencies.
8. **Pricing** (INR first, USD toggle). Placeholder plans; keep them in config:
   - Free: 1 reel/month, 720p, watermark, up to 60 s.
   - Creator ₹999/mo: 10 reels, 1080p, no watermark, up to 3 min.
   - Pro ₹2,999/mo: 40 reels, brand kit (logo, colours, fonts, end card), priority render.
   - Agency: contact.
   - Also sell credit packs (1 credit = 1 reel ≤ 90 s; longer reels cost more credits).
9. **FAQ:** languages, how long it takes, do you keep my videos (retention policy), can I edit the result, commercial use, image rights.
10. **Final CTA band:** "Feel your reel. Don't just post it." plus a **Get started** button.
11. **Footer:** links, Terms, Privacy, contact, "Made in Rajasthan".

SEO: metadata, OG image (generate one in the brand style), sitemap, robots, JSON-LD for SoftwareApplication. Lighthouse ≥ 90 on mobile for performance, accessibility and SEO.

---

## 6. The engine (`packages/engine`) — the heart of the product

### 6.1 Principle
Convert the hand-written composition (`example_baisa_bling.html`) into a **data-driven engine**: a typed **Plan JSON** describes the edit; the engine turns `(plan, assets, t)` into the DOM state for time `t`. The same code powers:
- **browser preview** in the editor, using a `<video>` element synced to `t` (scrubbable, real-time);
- **headless render** in the worker, using pre-extracted JPEG frames (frame-exact, deterministic) and the existing `window.renderFrame(t)` / `window.__ready` contract.

Expose an `assetMode: 'video' | 'frames'` switch; everything else is identical.

### 6.2 Port these from `template.html` / the example
- Toolkit: easings, `prog`, `lerp`, seeded `rng`, `set()`.
- Layers: `#pattern` stage, `#bleed` (z 0, isolation isolate), `#vw` video wrapper (z 1), `#fx` (z 2), captions (z 3), grain (z 4).
- **Video modes** `full | zoom | card | pip | arch` with the same transforms, gold border, radii and arch clip, the 0.5 s outExpo transitions, and 0.6 s inOutCubic into/out of zoom. Add a `cutout` mode later (Section 9).
- **Captions:** one word at a time, pop-in, emphasis classes gold-serif / terracotta-Anton, auto Mukta for Devanagari, max hold 0.85 s.
- Grain, breathing, pattern drift.
- Items hidden with `display:none` when out of range, never `visibility`. Every font goes into `__ready`.

### 6.3 Plan JSON (define in `packages/schema` with Zod; version it: `"version": 1`)

```ts
Plan = {
  version: 1,
  meta: { durationSec, fps: 30, width: 1080, height: 1920, language: 'en'|'hi'|'hinglish'|string },
  style: StyleTokens,                      // palette, fonts, grain, captionStyle, pace — from preset + user text
  subject: { faceBox: Rect, freeZone: Rect, prop?: { label: string, point: {x,y} } },
  videoModes: Array<{ t: number, mode: 'full'|'zoom'|'card'|'pip'|'arch', zoomPoint?: {x,y}, zoomScale?: number }>,
  captions: { enabled: boolean, y: number, gold: string[], accent: string[] },
  elements: Element[],                     // discriminated union on `type`, each has t0, t1
  sfx: { auto: boolean, intensity: 0..1, extra?: Cue[] },
  endCard?: { brand: string, line1: string, line2?: string, handle?: string, bgImageId?: string }
}
```

Element types (each maps to a builder in the example; implement all of them):
`posterText` (lines: text, font 'anton'|'serif'|'kicker'|'devanagari', size, colorToken, top, align) ·
`counter` (from, to, label) · `lockCard` (word, kicker, sub) · `propPunchIn` (ring ellipse + label; pairs with a `zoom` video mode) ·
`feedPhone` (imageId, posts, dayFrom, dayTo) · `stamp` (text) · `chapterCard` (number, line, italicLine) ·
`imageCard` (imageId, label, x, y, w, h, tilt, objectPosition) · `splitCards` (two imageCards) ·
`bleedPlate` (imageId | patternId, kicker, title, objectPosition; pairs with `pip` mode) ·
`filmStrip` (imageIds[], kicker, title, focusRing?) · `patternCard` (pattern: 'jaali'|'arches'|'bandhani'|'leheriya', label) ·
`equation` (left, right) · `reveal` (word, devanagari?, definition?) with particle burst ·
`strikeLine` (text) · `chips` (items with appear times).

Colour tokens only (`mar`, `ter`, `gold`, `goldd`, `iv`), never raw hex inside elements; the style decides the hex values. Text colour auto-flips by context: light wall → `mar/ter/goldd`; stage, plate or dark → `iv/gold`.

**Validation layer** (`validatePlan(plan, transcript)`), run after the LLM and after every user edit:
- every element's `t0` is within ±0.15 s of a word in the transcript it is anchored to (store `anchorWordIndex`);
- no two `posterText`/`imageCard` elements overlap in time *and* zone;
- in `card` mode, poster text must end above y ≈ 680;
- no single layout lasts longer than about 6 s (warn, don't fail);
- imageIds exist; text fits its box (measure with canvas `measureText` in the browser, and the same font metrics in headless);
- auto-fix what can be fixed (nudge times, shrink font) and report the rest.

**SFX auto-derivation:** from elements and mode switches, per style-guide section 6 (whoosh on every mode switch and plate, pop on cards/chips, ticks under counters, riser → impact + sub on `reveal`, sub on the end card), scaled by `intensity`.

### 6.4 Golden test
Write `plans/baisa_bling.json` by hand-converting `example_baisa_bling.html` into Plan JSON. Render it with the engine (frames mode) and compare against the reference composition at 40 timestamps (stills): perceptual diff (SSIM ≥ 0.92 on each still, excluding grain). This test runs in CI. It proves the engine didn't lose the look.

---

## 7. Job pipeline (worker) — stages and statuses

`edit_jobs.status`: `uploaded → probing → transcribing → awaiting_transcript_review → planning → awaiting_plan_review → rendering_preview → ready_preview → rendering_final → done | failed | canceled`. Each stage writes `progress` (0–100) and a human message ("Timing every word…", "Designing your edit…"). Every stage is retry-safe and idempotent.

### 7.1 Probe & prep
ffprobe the file → duration, rotation, fps, codec. Reject anything over 3 min (by plan) or not vertical-ish; offer auto crop-to-9:16. Transcode to a normalized H.264 1080×1920 30 fps proxy for preview. Extract `voice.wav` (48 kHz) and `audio16k.wav`. Extract JPEG frames (`-q:v 3`) **only at final render time**, to save storage. Extract 6 keyframes for the planner (vision).

### 7.2 Transcription (word-level timestamps are mandatory)
Use a `Transcriber` interface with two implementations:
- **Default:** `faster-whisper` large-v3 with `word_timestamps=True` and VAD filter, running in the worker (CPU int8 is acceptable; GPU if available).
- **Optional:** a hosted speech-to-text API with word timestamps and Hindi support (adapter stub; I'll choose the vendor).

Language: auto-detect on the first 30 s, but **verify**. Run a short probe in both `en` and `hi`; if one output is mostly non-words, pick the other. Lesson from the reference: Whisper forced to Hindi on English speech produced garbage. Support Hinglish, with captions in the script that was spoken. Hindi words on screen always appear in **Devanagari**.

Then run a cheap Claude pass that **suggests** corrections: brand names (the user's brand from the form), Indian craft words (jaali, polki, jhumka, payal, nani, rasa/rasika…), and homophones (feet → feed). These are suggestions only; the user accepts them. On edit, keep word timings: re-align edited words to the old timings with difflib-style matching and interpolate the rest (see `align.py`).

### 7.3 Transcript review (UI, optional step, skippable)
Show the transcript as editable words with timestamps, the suggested fixes highlighted, and "Accept all". The user can also mark words: "show image X here", "emphasise this", "this is the payoff word". This step is the single biggest quality lever. Make it fast and pleasant on mobile.

### 7.4 Planning (Claude)
Input to Claude (`claude-opus-5-5`, use a system prompt stored in `apps/worker/prompts/planner.md`):
- the full style guide (`style-guide.md`) and the Plan JSON schema (as JSON Schema);
- the words with timestamps (compact format `i|t|word`);
- 6 keyframes (images) plus detected `faceBox`/`freeZone` (compute these with a face detector, e.g. MediaPipe; don't make the LLM guess pixels);
- the user's images (thumbnails) with their optional labels and "show when I say…" hints;
- the style preset tokens + the user's free-text style request + brand/end-card info;
- 1 few-shot example: the golden `baisa_bling.json` with its transcript excerpt.

Rules for the planner prompt:
- Follow the beat structure, but adapt it to what the person actually says; don't force chapters if there are none.
- Every element is anchored to a word index.
- **Every on-screen phrase must be complete and meaningful on its own, never a fragment.** This is the client's top rule.
- Use real user images for what they actually show; never label an image as something it isn't. If a beat has no image, use a `patternCard` or typography.
- Vary layouts: change layout at least every 6 s; rotate full → card → pip → punch-in.
- Output **only** JSON matching the schema. Use structured output/tool-use with the schema so the result always parses.

Then: `validatePlan` → auto-fix → if hard errors remain, one repair call to Claude with the error list → validate again → save `plan_v1`.

Store every plan version (`edit_plans` table) so users can undo.

### 7.5 Preview render
Fast server render at 540×960, `--preset ultrafast`, no grain, so users get a shareable preview even before opening the editor. The editor itself previews live in the browser.

### 7.6 Final render — chunked and parallel
- Extract frames → split the timeline into N chunks (N = vCPUs, about 10–15 s each, cut on frame boundaries).
- Launch N Playwright pages/processes, each running `render.py`-style `--start/--end` into its own segment with **identical encoder settings** (libx264, crf 20, `-pix_fmt yuv420p`, fixed GOP).
- Concat with the ffmpeg concat demuxer, no re-encode.
- Build `sfx.wav` with `sfx.py` from the derived cues, then mix: voice 1.0, sfx 0.45 × intensity, optional music bed (licensed library only, ducked under the voice with sidechain compression), then alimiter.
- Mux with `-movflags +faststart`. Make a 1080p download plus a 720p share copy. Generate a thumbnail from the reveal moment.
- **Target:** a 90 s reel in under 4 minutes on an 8-vCPU worker. Log per-stage timings to the job.

### 7.7 Cleanup and retention
Delete frames right after render. Keep the source + outputs for 30 days (configurable per plan), then delete. Users can delete a project instantly.

---

## 8. Style presets (`packages/schema/presets/*.json`)

Each preset is a `StyleTokens` object (palette, fonts, caption style, grain, pace, which element types are preferred, end-card shape).

1. **Mikku Royal** — *default*. Exactly the Baisa Bling look: maroon stage, terracotta/gold, Anton + Instrument Serif, arch end card, jaali pattern.
2. **Katana Pop** — playful pink illustrated look (from the Katana reference): pink paper, cobalt `#2A5CC4`, red `#D02A2A`, yellow highlight box `#F5C518`, wobbly condensed type, doodle accents (arrows, sparkles), maroon `#2B0303` card stage.
3. **Noir Minimal** — black/white/one accent, Inter + serif italic, no grain, slow pace, for founders and educators.
4. **Bold Creator** — high-energy, big captions, more punch-ins, faster layout changes.

**Free-text style box:** "make it feel like a vintage Bollywood poster, more yellow, fewer images" → a `claude-haiku-5-5` call maps the text to a **bounded** set of token overrides (palette from an allowed set or derived from a brand colour, font pairing from the shipped list, pace 0–1, grain 0–1, caption size, element preferences). Never let free text inject CSS or HTML. Show the resolved tokens to the user as chips ("Palette: warm yellow · Pace: fast").

**Brand kit (Pro):** logo upload, brand colours (the palette is derived automatically and contrast-checked), custom font upload (OFL/licensed checkbox), default end card, default handle.

---

## 9. Optional features (behind flags; build after the core works)

- **Speaker cutout mode** (the client loves moving cutouts of the speaker): run person segmentation (Robust Video Matting or MediaPipe Selfie Segmentation) in the worker to produce an alpha matte. A new `cutout` video mode places her **in front of** poster type or an illustrated background (the Katana "paint-reveal" hook). Feature flag: `ENABLE_CUTOUT`.
- **Auto image finder:** for nouns the speaker names with no user image, search **openly licensed** sources only (Wikimedia Commons API, Openverse API; Pexels/Unsplash APIs if keys are present). Store license + attribution, show a credits line in the export notes, and let the user approve each image. **Off by default.** Never use celebrity photos or copyrighted film stills from the web. For mythology/history topics, prefer public-domain archival art (miniature paintings, museum collections).
- **Music bed:** a small licensed library with mood tags; auto-duck under the voice.
- **Aspect variants:** 4:5 and 1:1 re-layouts from the same plan (zones scale).
- **Hindi UI** toggle for the dashboard (all strings in i18n files; Hindi in Devanagari).
- **Agency workspaces:** teams, shared brand kits, per-seat billing.

---

## 10. Dashboard and app UX

Routes (all under auth):
- `/dashboard` — project grid with thumbnail, status pill with live progress, duration, style, created date, and actions (open, duplicate, download, delete). Empty state: an illustrated arch plus a big **"Create your first edit"** button.
- `/dashboard/new` — a 4-step wizard, mobile-first:
  1. **Upload reel:** drag-drop or tap. Resumable multipart upload with a progress bar. Accept MP4/MOV/HEVC. Show the duration and a first-frame thumbnail instantly (client-side).
  2. **Your photos (optional):** upload up to 15 images. Each gets an optional label and an optional **"show when I say…"** text field. Built-in crop tool (users often upload phone screenshots with UI buttons, so offer "auto-trim screenshot UI" plus manual crop).
  3. **Style:** preset cards with live mini-previews; the **free-text style box** ("Describe your style (optional)"); toggles for captions on/off, sound effects intensity slider, music on/off, language (auto / English / Hindi / Hinglish).
  4. **Brand & ending (optional):** brand name, handle/website, end-card line (default: the speaker's last sentence), CTA ("Comment KATANA", "DM to order"…).
  → **"Create my edit"** (shows the credit cost first).
- `/dashboard/p/[id]` — project page:
  - **Progress view** while processing: the stage list with friendly copy and live percentage, and a "We'll email you" note.
  - **Transcript review** (Section 7.3) when that stage is reached (or "Skip, auto-fix").
  - **Editor** once the plan is ready (next section).
  - **Export:** render final → download 1080p, copy share link, "post caption" suggestions generated by Claude (hook + hashtags, in the reel's language).
- `/dashboard/brand` (Pro), `/dashboard/billing`, `/dashboard/settings`.

### Editor (the "wow" screen)
- Center: phone-sized **live preview** (the engine in `video` mode), with play/pause, scrubber, and frame-step buttons.
- Bottom: a **timeline** with tracks for video modes, text elements, images, captions, and SFX. Drag element edges to retime; positions snap to word boundaries (show words on a ruler).
- Right panel: properties of the selected element (text, colour token, size, image, label), plus "Regenerate this beat" (sends only that time window to Claude with the user's instruction, e.g. "make this punchier").
- Top: undo/redo (plan versions), style switcher (re-applies tokens without re-planning), and a **"Render final"** button.
- Every edit runs `validatePlan` live and shows warnings inline.
- It must work on a tablet; on a phone, a simplified editor is enough (edit texts and swap images; no timeline dragging).

---

## 11. Data model (Drizzle, Postgres)

`users` (from Supabase auth) · `profiles` (plan, credits, locale) · `brand_kits` · `projects` (owner, title, style_preset, style_text, brand fields, status) · `assets` (project, kind: source_video | image | proxy | frame_bundle | output_1080 | output_720 | thumbnail, storage_key, meta JSON, license JSON) · `transcripts` (project, language, words JSON, version) · `edit_plans` (project, version, plan JSON, validator_report JSON, created_by: llm | user) · `jobs` (project, type, status, progress, message, timings JSON, error) · `credit_ledger` (user, delta, reason, job_id) · `payments` · `audit_log`.

Row-level security: users only see their own rows (Supabase RLS policies included in the migrations).

---

## 12. Build phases and acceptance checks

**Phase 0 — Repo & foundations.** Monorepo, lint/format/type-check, CI (GitHub Actions), docker-compose (web, worker, redis, postgres via Supabase local or plain Postgres, minio as S3), `.env.example`, brand config.
✅ `pnpm dev` + `docker compose up` brings everything up; CI is green.

**Phase 1 — Landing page.** Everything in Section 5, with placeholders for the demo videos and real animations.
✅ Lighthouse mobile ≥ 90 (perf/a11y/SEO); looks right at 360 / 768 / 1440; "Get started" routes to auth → `/dashboard`.

**Phase 2 — Auth, dashboard shell, uploads.** Supabase auth, the project grid, the wizard with resumable multipart upload to R2/minio, image upload + crop, DB schema + RLS.
✅ Upload a 300 MB HEVC file from a phone browser, resume after a network drop, and see the project appear.

**Phase 3 — Engine + golden test.** `packages/schema` (Zod + JSON Schema + pydantic generation), `packages/engine` with all element types and modes, hand-written `baisa_bling.json`, and a Storybook-style dev page `/dev/engine` that plays any plan against any video.
✅ Golden SSIM test passes in CI; the dev page plays the Baisa plan smoothly at 30 fps in Chrome.

**Phase 4 — Worker: probe, transcribe, render.** The Python worker with job protocol, prep, faster-whisper word timestamps with the language probe, chunked parallel render, sfx + mix + mux, cleanup.
✅ Given the hand-written plan and my original video, the worker outputs an MP4 matching the reference edit. A 90 s reel renders in under 4 min on 8 vCPU. Per-stage timings are logged.

**Phase 5 — Planner.** Transcript-correction suggestions, the planner prompt, structured output, validator + auto-fix + repair loop, plan versioning.
✅ On 3 test reels (I'll provide them; meanwhile use any vertical talking clip), plans pass validation and every on-screen phrase is a complete sentence fragment-free. Write `docs/planner-eval.md` with a rubric (anchor accuracy, layout variety, text completeness, image-label honesty) and the scores.

**Phase 6 — Editor.** Live preview, timeline, properties panel, regenerate-beat, undo/redo, style switcher, render final, export page with caption suggestions.
✅ I can change a text, retime an image to a different word, switch style, and get a final render that matches the preview.

**Phase 7 — Billing & limits.** Credits, plans, Razorpay checkout + webhooks, watermark on the free tier (a small gold "Rasika" mark at the end card), length limits, a usage page.
✅ Test-mode purchase adds credits; a render deducts credits atomically; a failed render refunds automatically.

**Phase 8 — Polish & launch.** Emails, Sentry, rate limits, abuse checks (Section 13), Terms/Privacy pages (draft text marked for legal review), analytics (PostHog), production deploy scripts, `docs/RUNBOOK.md`.
✅ An end-to-end smoke test in production with a real reel.

**Phase 9+ — Optional features** from Section 9, one at a time behind flags.

---

## 13. Safety, rights and abuse

- Upload consent checkbox: "I own this video or have permission, and I have rights to the images I upload."
- No face swapping, voice cloning or generated likenesses in this product. It only edits the user's own footage.
- Block obvious misuse: run a lightweight moderation pass on transcripts and images (sexual content, hate, minors) before planning. If flagged, stop the job and refund.
- Auto image finder (if enabled): only openly licensed sources, with attribution stored and shown.
- Rate-limit uploads and renders per user and per IP.
- Delete-my-data endpoint; honour the retention settings.

---

## 14. Cost and performance notes (put these in `docs/costs.md` and keep them updated)

- Per reel the cost drivers are: one planner call (vision + ~15–25K input tokens, ~5–10K output), a small Haiku call or two, transcription compute, and render compute (the biggest one). Log real token usage and worker seconds per job into `jobs.timings` and show me an admin page with averages per reel minute.
- Cache the style guide + schema + few-shot prefix with prompt caching. They are identical across jobs.
- Render compute: chunked parallel rendering on CPU is enough; no GPU required except optionally for faster-whisper and cutout.

---

## 15. Definition of done (MVP = Phases 0–8)

A new user on a phone can: land on the page → tap Get started → sign in → upload a 90 s Hinglish talking reel and 5 photos → pick Mikku Royal (or type a style) → fix two transcript words → preview the edit in the browser → change one headline → render → download a 1080p MP4 with captions, poster type, their photos on the right words, sound effects and an end card with their brand — **in under 10 minutes total, without reading any docs.**
