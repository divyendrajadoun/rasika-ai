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

One word at a time from the transcript: strip `. , ? !`, hold until the next word or 0.85 s,
pop in (scale .72→1, outBack, 0.19 s). `captions.gold` words → gold serif italic, `captions.accent`
→ terracotta Anton; Devanagari switches to Mukta. `captionStyle: "phrase"` groups up to three
words; `"off"` hides them.

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
within 0.11 s (unit-tested).

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
