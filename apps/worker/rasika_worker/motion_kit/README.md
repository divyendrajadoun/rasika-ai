# motion_kit

The engines and templates behind Rasika's "3D and motion animations", taken from
[claude-animation-skills](https://github.com/artemnovitckii/claude-animation-skills) by Artem
Novitckii (MIT, see `LICENSE`). The worker runs them itself instead of a person running the skills
by hand: `motion.py` drives the four quick templates, `whatif.py` the two engines.

| Folder | From | Changes made for Rasika |
|---|---|---|
| `templates/` | `skills/{graph,map-route,breakdown,minimalistic-graphics}/template.html` | none |
| `whatif3d/` | `skills/zach-d-films/engine` | `main.js` reads `CAPTIONS`/`DURATION` from `timing.js` (written from the voice) and exposes `SHOT_SPANS`; `index.html` loads three.js and the caption font from `vendor/` and `fonts/`; `human.js` gains a `'plain'` outfit and `{shirt, pants}` colours; the example short is kept as `example_shots.js`, the animator's reference |
| `stick/` | `skills/stick-figure/engine/template/web` | `words.js` is written from the voice; the time warp is dropped; the example reel is kept as `example_shots.js` |
| `fonts/` | `kit/fonts` and `@fontsource/montserrat` | none (SIL Open Font License, licences alongside) |

three.js (MIT) and GSAP are installed in the worker image, not kept here. The 3D what-if engine is
named after a style of short; it is not affiliated with Zack D. Films.
