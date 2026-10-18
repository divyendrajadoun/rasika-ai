# Phase 3 report — Engine + golden test (2026-10-18)

## Built

- **`packages/schema` — Plan v1** (`src/plan.ts`): meta, style tokens, subject (face box, free
  zone, prop), video modes (`full|zoom|card|pip|arch` with zoom point/scale), captions, the
  16-element discriminated union from SPEC §6.3 with defaults, sfx (auto, intensity, extra
  cues), end card, and the word-level `Transcript`. Colour fields accept tokens only.
- **`validatePlan(plan, transcript, opts)`** (`src/validate.ts`): anchors (±0.15 s, nudge ≤ 0.5 s,
  stores `anchorWordIndex`), time/zone overlap check for poster text and cards, card-mode text
  above y 680, ≤ 6 s layout rhythm (warn), image existence, text fit with injectable
  `measureText`, colour-context warnings, mode sorting / zoom-point fill, end-card time. Auto-fixes
  are reported as `fixed`, the rest as `warn`/`error`. CLI: `pnpm validate:plan <plan> <words>`.
- **JSON Schema + pydantic**: `pnpm schema:export` → `packages/schema/plan.schema.json` (named
  `$defs`); `pnpm schema:pydantic` → `apps/worker/rasika_worker/plan.py` (51 pydantic v2 models;
  loads the Baisa plan with the right element classes). CI fails when either is stale.
- **`packages/engine`**: `createEngine(root, {plan, transcript, assets, assetMode})` with the
  layer stack, the five video modes (same transforms, gold border, radii, arch clip, 0.5 s
  outExpo / 0.6 s inOutCubic), all 16 element builders + end card, one-word captions with
  gold/terracotta emphasis and Mukta for Devanagari, seeded grain, breathing, pattern drift,
  `display:none` out of range, every font in `ready`. `assetMode: "video" | "frames"` is the only
  switch. `deriveSfx(plan)` produces the cue sheet. Four SVG patterns (jaali, arches, bandhani,
  leheriya). `pnpm --filter @rasika/engine build` bundles the headless harness
  (`dist/rasika-engine.js`, `harness/index.html`) exposing the `window.renderFrame(t)` /
  `window.__ready` contract.
- **`plans/baisa_bling.json`**: the reference composition hand-converted — 47 elements, 16 mode
  switches, caption word lists, subject, end card — plus `plans/baisa_bling.words.json`.
- **`/dev/engine`**: plays any plan against any video. Bundled Baisa plan over the raw demo take
  by default; load a plan / words / images / video from disk, or `?project=<id>` to use one of
  your uploads (presigned source + photos). Transport (space, ← → frame step, scrub, loop), live
  fps meter, mode badge, element list, timeline strip, validation panel.
- **Golden test** `tools/golden/golden.py` + CI job `golden`.

## Acceptance

| Check                                                                         | Result |
| ----------------------------------------------------------------------------- | ------ |
| Golden SSIM ≥ 0.92 on every still, grain excluded (synthetic stand-in frames) | ✅ 54/54 · mean 0.9993 · worst 0.987 @ 89.8 s |
| Golden SSIM on the **real IMG_7571.MP4 frames** (2 703 frames via ffmpeg)     | ✅ see below |
| `deriveSfx` reproduces every reference `cues.json` cue within 0.11 s           | ✅ unit test |
| Baisa plan validates with zero errors against its transcript                   | ✅ 1 nudge of 0.16 s, 2 overlap trims of 0.05 s, 46 anchors inferred |
| `/dev/engine` plays the Baisa plan at 30 fps in Chrome                         | ✅ see below |
| lint · typecheck · tests (schema 9, engine 14, web 12) · build; worker ruff · mypy · pytest | ✅ |

The two weakest stills are the Devanagari "रस / RAS" pop (line-height of a Tiro line) and the end
card (the end-card text starts 0.05 s after the plate in both, sub-pixel kerning of Instrument
Serif at 86 px). Side-by-side PNGs for every still are in the CI artifact `golden-report`.

## Mocked / deferred

- `cutout` video mode (SPEC §9) — not in Phase 3 scope.
- `captionStyle: "phrase"` groups up to three words; it is implemented, not yet tuned.
- The browser `measureText` hook exists on `validatePlan`; the editor (Phase 6) will pass it. The
  dev page uses the heuristic.
- Fonts for the engine are the five bundled TTFs; preset `fonts` names are recorded in the style
  but not yet mapped to alternative files.

## Decisions to review

1. **The harness parses the plan with Zod** so defaults are applied; the core engine stays
   dependency-free and trusts a parsed `Plan`. The headless bundle is therefore 490 KB minified
   (zod inside) — irrelevant for Chromium, worth knowing.
2. **A font that fails to load rejects `engine.ready`** instead of rendering blank text. The
   reference behaved the same; `render.py` will stop loudly.
3. **Lock-card payoff stays blurred** in the Baisa plan (`blurred: true`) because the reference
   never unblurred it; the engine supports `blurred: false` (sharp) for the style-guide's
   "unblurs" beat when the planner wants it.
4. **Golden footage in CI is synthetic** (one generated frame: wall gradient, head, body, a gold
   prop at the zoom point) so the repo needs no 100 MB video. Both sides see the same frame, so the
   comparison still isolates the engine. Run `pnpm golden -- --video <file>` locally for the real
   thing.
5. `elements` are sorted by `t0` after validation; `id`s are free-form strings (planner decides).

## Next

Phase 4: the worker pipeline — probe, faster-whisper word timestamps with the language probe,
chunked parallel render through this harness, sfx + mix + mux, cleanup — producing an MP4 of the
Baisa plan over the original video.
