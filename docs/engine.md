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
Poppins, DM Serif Display, Kalam (Latin + Devanagari hand, for the board styles), Permanent
Marker (Apache-2.0) and JetBrains Mono (the 3Blue1Brown lesson). `css.ts` maps names to files, emits only the needed `@font-face` rules and
waits for exactly those families in `engine.ready`. Poster weight/tracking adapt to the family
(Montserrat/Poppins/Inter 800, Kalam 700, Bebas +.03em); the mixed-case families (kinetic,
whiteboard, chalk, launch) do not uppercase poster type.

## Motion (`style.motion`)

A preset is a look *and* a way of moving. `StyleTokens.motion` (schema `style.ts`) holds:

| field           | values                                                        | engine effect |
| --------------- | ------------------------------------------------------------- | ------------- |
| `family`        | editorial · kinetic · whiteboard · chalk · hype · launch · collage · blocks · beat | stage class `fam-*` (per-family CSS for cards, locks, stamps), card choreography, planner vocabulary **and which worked example the planner sees** (`apps/worker/prompts/examples/<family>.json`) |
| `enter`         | rise · pop · slam · slide · fade · draw · blur · letters · mask | typography entrance (`rise` = house word-by-word for lines, pop for blocks; `letters` pops each letter, `mask` lifts the whole line under its mask) |
| `exit`          | lift · dive · cut · wipe · fade                                | how typography leaves (editorial/collage cards keep the house sideways fling) |
| `easing`        | spring · snap · smooth · soft                                  | outBack · outExpo · outCubic · outQuint |
| `speed`         | 0.5–1.6                                                        | multiplies every entrance/exit duration |
| `camera`        | glide · cut · whip · still · push                              | mode-change duration (0.5 s / hard / 0.22 s / 0.6 s / hard) and whether the frame breathes; `push` adds a slow 7 % push-in on every unframed shot |
| `sfxKit`        | pop · click · marker · chalk · hype · cinematic · none         | which synthesised palette renders the cue types (worker `sfx.py`) |
| `texture`       | none · paper · board · grid · dots · vignette · gradient      | static backdrop behind the framed video (replaces the drifting dot pattern) |
| `direction`     | markdown                                                       | the planner's beat structure + vocabulary for this style |
| `avoidElements` | element types                                                  | hard ban; the planner prompt states it and `_normalise` drops them |

Everything defaults to the house editorial motion, so plans written before this field existed
render exactly as before (the golden test guards it). `motionOf(style)` fills partial blocks.

**Materials on the footage.** The texture no longer lives only on the stage behind framed shots:
a `.rk-mat` overlay rides the video wrapper in every mode (halftone screen, paper fibre + warm vignette,
grain, scanlines, vignette, gradient foot), and a `.rk-frame` layer gives the paper families their
frame — torn kraft/cream strata with tape (`collage`), a taped white border (`whiteboard`), an ink
border (`chalk`). `steps` easing also quantises the footage to 12 fps and boils it ±2 px / ±0.3° per
pose, so cut-paper and comic styles move like stop-motion instead of video with a caption on top.

**Light stages.** `card` / `pip` / `arch` modes used to be treated as a dark context everywhere.
Now the engine (`stageDark` in `BuildCtx`), the validator's colour-context swap and the planner's
Motion direction all read the stage luma: on a light stage (Whiteboard Marker, Brand Bar, Sky
Cards, Beat Type, Launch Spotlight, Paper Collage, Editorial Ivory …) framed modes take the
light-wall tokens (`mar` / `ter` / `goldd`), chapter cards and reveals included.

## Presets

Ninety-three presets live in `packages/schema/presets`. The original fourteen — Mikku Royal (default),
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

Seven more were built from the *measured* rules of the other repos in the community list (each
repo was cloned and its SKILL.md, references and templates read; numbers below are theirs):
**Slam Neon** (Shenghua: #0f0f17 stage, one neon accent, slam 2.4→1 with blur over 0.22 s, cut every
1–4 s, captions on an accent pill), **Spotlight Promo** (Spotlight: footage first, ≤ 5-word captions
low over a scrim, gold #E4B53B accent, 0.4 s fades with a 24 px rise, slow push), **Showreel
Blocks** (Showreel: flat primary blocks, counters 1.2–1.8 s outQuart, entries 0.35–0.7 s, never the
same transition thrice), **Brand Bar** (html-animation: bone #f5f5f2 ground, 700-weight sans at
−0.035 em, pop 0.4→1.08→1, accent bar under the key word, 1.03→1.007 push), **Beat Type**
(kinetic-typography-skills: Anton + italic serif on #f4f1ea paper, red / amber / blue bands, letter
stagger 20–40 ms, expo.out), **Motionmaxxed** (motionmaxxing: near-black #110f14, sentence case,
headline 9 % of the frame, arrivals from oversize, cuts every 0.3–2.3 s, no kickers or HUD) and
**Sky Cards** (claude-motion-design: #f7f7f5 ground, white rounded cards, sky #38bdf8, 55 ms word
rise, 0.3 s ease-in exits, something new every 2–4 s). The first five were re-tuned to the same
sources: Kinetic Mono now uses Apple's measured black / #f5f5f7, 8-frame cut-on entries and 1.1 s
holds; Whiteboard Marker uses the skill's Caveat 700 on #fbfbf8 with its ink / blue / gold / red /
green; Chalkboard Maths is 3Blue1Brown's #1a1a2e with mono labels and one colour per meaning; Hype
Cut uses the TikTok skill's Montserrat 800 karaoke captions with the #FFE45E active word; Launch
Spotlight is the launch-kit's warm #faf7f2 ground with hero words punching in from 2.4× and glass
clicks instead of whooshes.

**The third wave (2026-10-19): 67 more community looks.** Every repo in the
awesome-claude-video-skills list that defines a *look* (not a pipeline, MCP server, avatar tool or
image-model workflow) was shallow-cloned and read; read-only research agents extracted typography,
hex values, motion numbers, caption rules, structure, sound and bans per repo, and each preset below
carries those numbers in its `motion.direction`. Repos under non-commercial or missing licences
(SeeCut, onetake, MotionTalk, eian-riso, jc-remotion, doudou-whiteboard, Samin, krusemediallc,
misbahsy, santmun) were read for context only and nothing was taken from them; the proprietary
Motion-graphics-skill was excluded. The wizard shows the source as plain text ("measured from …"),
no links. New engine vocabulary for this wave: `steps` easing (stop-motion poses), `type` entrance
(typewriter with cursor), textures `halftone` / `scan` / `lines` / `grain` with light-stage variants,
`motion.caseStyle` (auto / upper / sentence), and the fonts Space Grotesk, Oswald, Playfair Display
Roman, Jost, Press Start 2P, Fraunces, IBM Plex Sans and IBM Plex Mono.

- **beat** — Podcast On Air (pycodebr/heditor · podcast); High Energy (Barty-Bart/motion-graphics · explainer-high-energy); Swiss Poster (crawfordxx/xiaoma-studio · swiss + HRuiCcc/RuiC-motion-reel · swiss-editorial)
- **blocks** — Impacto Board (pycodebr/heditor · impacto); Halftone Collage (pyang5166/gbro-collage-info); Pixel RPG (yammaku/typewriter-video · pixel-art + heditor · game); Paper Blue (adunext/adu-motion-video · default route); Morph Canvas (Barty-Bart/motion-graphics · motion-broll); Fun Pop (Neelshah1810/Claude-Video-Skills · Fun); Brew Cards (Finderchangchang/promo-video-skill · cards / warm-emotion); Paper Grid (alisadiq-ai/favstash-ai-video-editing-skills · paper-grid)
- **collage** — Zine Collage (RahmanBuildsAI/ravyn-reel-kit · collage); Papercut (0xS4N4TG/papercut-explainer); Comic Pop (Changroro/code-video · comic); Guofeng Paper (AllenAI2014/remotion-guofeng-starter); Kolase Paper (bangtutorial/bang-motion · kartun kolase); Vox Doc (charlie947/motion-graphics-skills · vox-explainer); Vox Paper (jaredcassoutt/vox-editorial · vox-skill)
- **editorial** — Revista (pycodebr/heditor · revista); Tabloid Headline (RahmanBuildsAI/ravyn-reel-kit · headline); Viewfinder (RahmanBuildsAI/ravyn-reel-kit · camera); Vibe Life (adriiita/vertical-video-editing-skill · vibe-life); Craft Kraft (mcdenil-skills/AutoMontage-Agent · craft); Paper Manuscript (TryWorld2026/paper-algorithm (skill: MIT)); Oneshot Paper (kvrancic/oneshot-video · paper); Premium Serif (Neelshah1810/Claude-Video-Skills · Premium); Warm Paper (ahmdd4vd/MotionCraft · warm-paper); Visual Journalism (bangtutorial/bang-motion · jurnalisme visual); Vintage Sketch (bangtutorial/bang-motion · sketsa vintage); Ligne Paper (cblain100-prog/motion-design-claude-code · ligne du temps v8); Museum Doc (crawfordxx/xiaoma-studio · museum); Ghost Clean (kurbaitaev/ghost-editor · clean); Ghost Editorial (kurbaitaev/ghost-editor · editorial); Ghost Cinematic (kurbaitaev/ghost-editor · cinematic); Palavra (nomicsadmin/editor-video-ia · rosto e ideia); Kurgu Ink (onuryildriim/claude-kurgu-atolyesi)
- **hype** — Cinema Navy (pycodebr/heditor · cinema); Cyber Lime (mcdenil-skills/AutoMontage-Agent · cyber); Navy Foil (generalizingai/shadowcast · demo brand); INEMA Amber (inematds/skill-video-plan-editor (values measured; no licence file)); Bold Ad (Neelshah1810/Claude-Video-Skills · Bold); Neon HUD (HRuiCcc/RuiC-motion-reel · neon-hud + chuspeeism/dashi · 霓虹赛博); Multiverse Comic (bestagentkits/motion-video-skill · comic multiverse); Neon Cyber (chuspeeism/dashi-animationstyle · 霓虹赛博); Ghost Pop (kurbaitaev/ghost-editor · pop)
- **kinetic** — Nativo (pycodebr/heditor · nativo); Thriller CCTV (pycodebr/heditor · thriller); Kinetic Editorial (ouerf-man/kinetic-editorial-skill); Retro Terminal (yammaku/typewriter-video · retro-terminal); Ohneis (Maartenlouis/remotion-ads · ohneis); Memo Pop (Kimeur/motion-launch-videos · motion-captions (acme-memo)); Pi Light (ahmdd4vd/MotionCraft · pi-v2); Ghost Kinetic (kurbaitaev/ghost-editor · kinetic)
- **launch** — Missão Sunset (pycodebr/heditor · missao); Window (RahmanBuildsAI/ravyn-reel-kit · window); Paper Explainer (RahmanBuildsAI/ravyn-reel-kit · paper); Porcelain Keynote (isaachang/motion-video-workflow); AI Studio (hassancs91/claude-youtube-editor · brand.md); Dark iOS (Barty-Bart/motion-graphics · explainer-engaging); Dark Stat (marketcalls/story-telling · reel template); Glass Violet (alisadiq-ai/favstash-ai-video-editing-skills · adaptive-glass (soft-violet)); Breakout Card (alisadiq-ai/favstash-ai-video-editing-skills · breakout-card); Glass Keynote (bestagentkits/motion-video-skill · glass keynote); Black-Gold Brief (jackjls/jtxvideo-skill + chuspeeism/dashi · 黑底科技); Ghost Launch (kurbaitaev/ghost-editor · launch)
- **whiteboard** — Hand-drawn Notes (Changroro/code-video · handdrawn); Pencil Notes (chuspeeism/dashi-animationstyle · 手绘笔记)


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
