# The engine — Plan JSON → frames

`packages/engine` turns a **Plan** (typed JSON, `packages/schema`) plus assets and a word-level
transcript into DOM state for any time `t`. The same code runs in two places:

| Mode     | Where                     | Frame source                                        |
| -------- | ------------------------- | --------------------------------------------------- |
| `video`  | browser (`/dev/engine`, the editor) | a `<video>` element; while playing it is the clock, while paused the engine seeks it |
| `frames` | headless Chromium (worker) | pre-extracted JPEGs `frames/f%05d.jpg`, decoded before capture → frame-exact, deterministic |

Everything else — layers, modes, elements, captions, grain — is identical.

```ts
import { createEngine, fitStage } from "@rasika/engine";
const engine = createEngine(rootEl, {
  plan, // a parsed Plan (run it through `Plan.parse` / `validatePlan` first — defaults matter)
  transcript: words, // [{ w, t }]
  assets: { images: { i1: "/img/i1.jpg" }, video: "/clip.mp4" },
  assetMode: "video",
  fontBaseUrl: "/engine/fonts",
});
await engine.ready; // every font + every image, or rejects
await engine.renderFrame(12.5); // → DOM for t = 12.5 s
```

## Layers (z-order, from the mikku template)

`pattern` (gold jaali dots, drifting) · `bleed` z 0 `isolation: isolate` (full-frame plates) ·
`vw` z 1 (the video wrapper: transform, gold border, radii, arch clip) · `fx` z 2 (every element) ·
captions z 3 · grain canvas z 4.

## Video modes

`full | zoom | card | pip | arch` — the `M` table from the reference. `zoom` is computed from
`zoomPoint`: `x = (540 − px)·s, y = (960 − py)·s`. Transitions are 0.5 s outExpo, 0.6 s inOutCubic
into/out of zoom; `full` breathes (±1.2 %), framed modes do not.

## Elements

Sixteen builders, one per `type`, each a port of a hand-written block of the Baisa Bling
composition: `posterText` (rise or pop) · `counter` · `lockCard` · `propPunchIn` · `feedPhone` ·
`stamp` · `chapterCard` · `imageCard` · `splitCards` · `bleedPlate` (image or pattern) ·
`filmStrip` · `patternCard` · `equation` · `reveal` (with the particle burst) · `strikeLine` ·
`chips`. Plus the `endCard`. Items out of range are `display:none` (never `visibility`).

Colours are **tokens** (`mar ter gold goldd iv stage ink`); the style's palette supplies the hex.
A line without a `color` auto-flips by context: light wall → `mar/ter/goldd`, dark stage/plate →
`iv/gold`.

## Captions

Five formats, chosen by the style's `captionStyle`:

| Style      | Behaviour                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------ |
| `one-word` | the mikku pop: one word at a time, hold until the next word or 0.85 s, scale .72→1 outBack; `captions.gold` words → accent serif italic, `captions.accent` → poster face in terracotta; Devanagari switches to Mukta |
| `phrase`   | up to three words, no highlight                                                             |
| `karaoke`  | 2–3 words set together; the spoken word is lit in `captionAccent` and scaled 1.08           |
| `box`      | as karaoke, but the spoken word sits on a solid rounded box in `captionAccent`              |
| `clean`    | full sentences (≤ 7 words, split at punctuation) in the lower third, no animation, soft shadow |
| `off`      | none                                                                                       |

## Fonts

Every style names real families (`style.fonts.poster / accent / ui / devanagari / caption`) from
the bundled OFL set in `packages/engine/fonts`: Anton, Inter, Instrument Serif, Tiro Devanagari
Hindi, Mukta, Montserrat, Bebas Neue, Playfair Display (italic), Archivo Black, Caveat, Bangers,
Poppins, DM Serif Display, Kalam (Latin + Devanagari hand, for the board styles) and Permanent
Marker (Apache-2.0). `css.ts` maps names to files, emits only the needed `@font-face` rules and
waits for exactly those families in `engine.ready`. Poster weight/tracking adapt to the family
(Montserrat/Poppins/Inter 800, Kalam 700, Bebas +.03em); the mixed-case families (kinetic,
whiteboard, chalk, launch) do not uppercase poster type.

## Motion (`style.motion`)

A preset is a look *and* a way of moving. `StyleTokens.motion` (schema `style.ts`) holds:

| field           | values                                                        | engine effect |
| --------------- | ------------------------------------------------------------- | ------------- |
| `family`        | editorial · kinetic · whiteboard · chalk · hype · launch · collage | stage class `fam-*` (per-family CSS for cards, locks, stamps), card choreography, planner vocabulary |
| `enter`         | rise · pop · slam · slide · fade · draw · blur                 | typography entrance (`rise` = house word-by-word for lines, pop for blocks) |
| `exit`          | lift · dive · cut · wipe · fade                                | how typography leaves (editorial/collage cards keep the house sideways fling) |
| `easing`        | spring · snap · smooth · soft                                  | outBack · outExpo · outCubic · outQuint |
| `speed`         | 0.5–1.6                                                        | multiplies every entrance/exit duration |
| `camera`        | glide · cut · whip · still                                     | mode-change duration (0.5 s / hard / 0.22 s / 0.6 s) and whether the frame breathes |
| `sfxKit`        | pop · click · marker · chalk · hype · cinematic · none         | which synthesised palette renders the cue types (worker `sfx.py`) |
| `texture`       | none · paper · board · grid · dots · vignette · gradient      | static backdrop behind the framed video (replaces the drifting dot pattern) |
| `direction`     | markdown                                                       | the planner's beat structure + vocabulary for this style |
| `avoidElements` | element types                                                  | hard ban; the planner prompt states it and `_normalise` drops them |

Everything defaults to the house editorial motion, so plans written before this field existed
render exactly as before (the golden test guards it). `motionOf(style)` fills partial blocks.

## Presets

Nineteen presets live in `packages/schema/presets`. The original fourteen — Mikku Royal (default),
Katana Pop, Noir Minimal, Bold Creator, Creator Yellow, Editorial Ivory, Clinic Clean, Brutalist
Acid, Cinema Bebas, Paper Collage, Neon Pop, Sage Wellness, Boardroom Navy, Festive Bandhani — now
each carry a motion block (hype cuts slam and whip, Noir blurs in and cuts, Ivory fades on a still
camera, Collage wipes with marker sounds …). Five were built from the looks the open video-skills
community shares: **Kinetic Mono** (Apple-recap kinetic type), **Whiteboard Marker** (a marker
draws each thought), **Chalkboard Maths** (dim-and-reveal lesson), **Hype Cut** (the TikTok
retention cut) and **Launch Spotlight** (a product launch film). The landing page and the wizard
show each one rendered by the engine on the same real 12 s take, from a plan the real planner
wrote for that style (`tools/styledemos/make_styledemos.py`, plans in `tools/styledemos/plans`
→ `apps/web/public/demo/styles`).

## Validation (`validatePlan`)

Runs after the planner and after every user edit. Repairs: sorts modes, inserts `full` at 0,
fills a missing `zoomPoint` from the prop/face, snaps `t0` onto the nearest word (±0.15 s, nudges
up to 0.5 s), shrinks text that will not fit, scales card-mode poster text to end above y 680,
trims ≤ 0.3 s overlaps. Reports: missing images, far anchors, zone overlaps, text that cannot fit,
light tokens on the dark stage, stretches longer than 6 s with nothing new.

Text width uses an injected `measureText` (canvas in the browser; the same metrics headless) or a
per-font advance heuristic.

## SFX (`deriveSfx`)

From elements and mode switches, per style-guide §6: whoosh 0.05 s before every mode switch and
plate, pop on cards / chips / pop text / the locked card, ticks under counters and the feed
day-counter, impact on stamps, riser → impact + sub on `reveal`, riser + sub on the end card,
`accent: "glitch" | "sub"` hints on poster text. Gains scale with `sfx.intensity`; `sfx.extra`
is appended verbatim. On the Baisa plan this reproduces every cue of the reference `cues.json`
within 0.11 s (unit-tested). The cue sheet carries `kit` (= `style.motion.sfxKit`); the worker's
`sfx.py` maps each cue type to that kit's generator and gain — the same `pop` cue is a pitched pop
in the house kit, a sine click in `click`, a scribble in `marker`, a chalk tick in `chalk`, a
bright pop in `hype` and a breath of air in `cinematic`. `none` renders silence.

## Headless contract

`pnpm --filter @rasika/engine build` → `dist/rasika-engine.js` (IIFE). `harness/index.html` loads
`config.js` (`window.HARNESS = { plan, words, images, frames: { pattern, count }, fontBaseUrl,
grain }`) and the bundle, then exposes `window.COMP`, `window.renderFrame(t)`, `window.__ready`
and `window.__cues` — exactly what the mikku `render.py` drives.

## Golden test

`python tools/golden/golden.py` (CI: the `golden` job) renders `plans/baisa_bling.json` with the
engine and the hand-written `reference/baisa_bling/comp.html` in the same Chromium, over the same
frames, fonts and images, and compares 54 stills with SSIM (grayscale, ¼ scale, grain off on both
sides). Threshold 0.92 per still. Without `--video` a synthetic stand-in frame is used so CI needs
no footage; `--video IMG_7571.MP4` extracts the real frames with ffmpeg. `--report dir` writes
side-by-side PNGs and `report.json`.

## Schema → Python

`pnpm schema:export` writes `packages/schema/plan.schema.json` (Zod → JSON Schema 2020-12, named
`$defs`); `pnpm schema:pydantic` generates `apps/worker/rasika_worker/plan.py`. CI fails if
either is stale, so the TypeScript and Python contracts cannot drift.
