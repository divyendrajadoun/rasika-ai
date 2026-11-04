"""
Code-animated "what if" explainers: the two engines of claude-animation-skills (MIT,
(c) 2026 Artem Novitckii; motion_kit/LICENSE), run by the worker instead of by hand.

  whatif3d  a 3D cartoon short in three.js: procedural people and props on a blue studio sky,
            slow-motion impacts, a red force ripple, 1–3 word captions on the voice
  stick     a stick-figure reel on a 2D canvas: a bright cartoon world drawn in code, stick
            people with big faces, whip transitions, 1–2 word lowercase captions

  write_script()  the topic → the voiceover in the format: a hook, the common belief, a turn on
                  "But", examples that build, the mechanism, a payoff that answers the hook
  timing()        the voice's word timings → the engine's captions, words and sentence spans
  write_shots()   Claude writes the shot list as code against the engine's API, with the engine's
                  finished example short as the reference
  check()         every shot drawn at three moments in a page that can reach nothing but the
                  project: load errors, throws, blank frames, a still of each shot
  critique()      the stills go back to Claude with the rules; one loop, and a revision that
                  breaks a shot is never shipped
  render()        frames in parallel headless browsers → ffmpeg → one silent 1080×1920 picture

Every frame is a function of time only, so a render can start anywhere and the browsers can split
the reel between them.
"""

from __future__ import annotations

import base64
import contextlib
import difflib
import http.server
import json
import re
import shutil
import subprocess
import sys
import threading
import time
from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlsplit

from rasika_worker.reference import parse_json

KIT = Path(__file__).resolve().parent / "motion_kit"
FPS = 30
#: the ceiling for a call that writes a whole shots file (thinking included)
CODE_TOKENS = 100000


@dataclass(frozen=True)
class Engine:
    id: str
    folder: str
    #: the page size the engine draws at (the 3D one is upscaled to 1080×1920 with lanczos)
    size: tuple[int, int]
    #: the shot list the animator writes, relative to the project
    shots: str
    #: the files shown to the animator as the engine's API (relative to the engine folder)
    api: tuple[str, ...]
    sfx_kit: str
    #: what the voiceover is about, for the script writer
    style: str
    #: how many seconds the voiceover aims for
    seconds: tuple[int, int]


ENGINES: dict[str, Engine] = {
    "whatif3d": Engine(
        "whatif3d",
        "whatif3d",
        (720, 1280),
        "src/shots.js",
        ("src/anim.js", "src/human.js", "src/props.js", "src/materials.js", "src/textures.js"),
        "cinematic",
        "a 3D cartoon short: simple cartoon people with big expressive faces and props built from "
        "basic shapes, on a bright blue studio sky; things happen to things (impacts, slow motion, "
        "force spreading), so the script must be about physical, showable events",
        (28, 40),
    ),
    "stick": Engine(
        "stick",
        "stick",
        (1080, 1920),
        "shots.js",
        ("lib.js", "chars.js", "env.js"),
        "toon",
        "a stick-figure cartoon: a bright world drawn in code, stick people with big white heads and "
        "faces, props drawn with thick outlines; funny, quick, every sentence a picture",
        (34, 45),
    ),
}


class AnimationError(RuntimeError):
    """The animation could not be made; the message is shown to the user."""


# ───────────────────────────── the script ─────────────────────────────

SCRIPT_SYSTEM = """You write the voiceover of a short animated "what if" explainer reel (vertical, 9:16).
The picture is {style}.

The format, one idea per sentence:
1. The hook, the first sentence: "If you…" or "What if…", a vivid, concrete situation that is one picture.
2. The common belief: "Most people think…" / "Some people think…".
3. The turn, a sentence starting with "But": what really happens.
4. Two or three examples that build, each one visual (a thing happening to a thing, a person reacting).
5. The mechanism: why, in one plain sentence that can be shown.
6. The payoff: the last sentence answers the hook.

Rules:
- About {words} words in all (2.5 words a second for {seconds:.0f} seconds), short spoken sentences.
- Only facts that are well established; hedge what is a theory ("scientists think"). No numbers you are
  not sure of; describe instead of quantifying.
- Everything must be showable with cartoon people and simple props: no brands, no logos, no real
  people, no text on screen beyond the captions, nothing gory (an impact is a flash and a spark).
- No em dashes, no emojis, no hashtags, no "in this video".

Return ONE JSON object, nothing else:
{{"title": "a short title", "lines": ["sentence 1", "sentence 2", …], "why": "one line on why the facts hold"}}"""


def seconds_for(engine: Engine, max_dur: float) -> float:
    lo, hi = engine.seconds
    return max(12.0, min(float(hi), max_dur - 2.0, max(float(lo), (lo + hi) / 2)))


def _call(
    client: Any, model: str, system: str, content: Any, max_tokens: int
) -> tuple[str, dict[str, int]]:
    # thinking is always on for the planner model and shares max_tokens with the answer, so the
    # code-writing calls get a large ceiling (streamed) and a cut-off answer is an error, not code
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": content}],
        output_config={"effort": "medium"},
    ) as stream:
        msg = stream.get_final_message()
    text = "".join(getattr(b, "text", "") for b in msg.content)
    if msg.stop_reason == "refusal":
        raise AnimationError("The writer declined this topic; try another question.")
    if msg.stop_reason == "max_tokens" or not text.strip():
        raise RuntimeError(f"the writer ran out of room ({msg.usage.output_tokens} tokens)")
    usage = {
        "input_tokens": int(getattr(msg.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(msg.usage, "output_tokens", 0) or 0),
    }
    return text, usage


def write_script(
    client: Any, model: str, engine: Engine, topic: str, seconds: float
) -> tuple[dict[str, Any], dict[str, int]]:
    system = SCRIPT_SYSTEM.format(style=engine.style, words=round(seconds * 2.5), seconds=seconds)
    text, usage = _call(
        client, model, system, f"The question or topic:\n\n{topic.strip()[:1500]}", 16000
    )
    out = parse_json(text)
    lines = [re.sub(r"\s+", " ", str(x)).strip() for x in out.get("lines") or []]
    lines = [x.replace("—", ", ").replace("–", ", ") for x in lines if x]
    if len(lines) < 3:
        raise AnimationError("Could not write a script for that; try asking it as a question.")
    return {
        "title": str(out.get("title") or topic)[:80],
        "lines": lines,
        "narration": " ".join(lines),
        "why": str(out.get("why") or "")[:400],
    }, usage


# ───────────────────────────── timing ─────────────────────────────

_SMALL = {"a", "an", "the", "at", "to", "of", "in", "on", "and", "or", "but", "for", "with", "by",
          "it", "is", "like", "as", "so"}  # fmt: skip


def _norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def timing(words: list[dict[str, Any]], lines: list[str]) -> dict[str, Any]:
    """The transcript's words (what was said, with times) matched to the script's sentences:
    `words` [{w, s, e, line}], `lines` [{text, s, e}], `captions` [[s, text, e?]] in 1–3 word
    chunks broken at punctuation (the 3D engine's), and `end` (the last word's end)."""
    said = [w for w in words if str(w.get("w") or "").strip()]
    if not said:
        raise AnimationError("The narration came back silent.")
    script = [(tok, li) for li, ln in enumerate(lines) for tok in ln.split()]
    a = [_norm(t) for t, _ in script]
    b = [_norm(str(w["w"])) for w in said]
    line_of: list[int | None] = [None] * len(said)
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            line_of[blk.b + k] = script[blk.a + k][1]
    last = 0
    out: list[dict[str, Any]] = []
    for w, li in zip(said, line_of, strict=True):
        last = li if li is not None else last
        out.append({"w": str(w["w"]).strip(), "s": round(float(w["t"]), 3),
                    "e": round(float(w["end"]), 3), "line": last})  # fmt: skip
    spans = []
    for li, text in enumerate(lines):
        ws = [w for w in out if w["line"] == li]
        if ws:
            spans.append({"text": text, "s": ws[0]["s"], "e": ws[-1]["e"]})
    caps: list[list[Any]] = []
    cur: list[dict[str, Any]] = []
    for i, w in enumerate(out):
        cur.append(w)
        text = " ".join(x["w"] for x in cur)
        stop = re.search(r"[.,?!;:]$", w["w"])
        dangling = w["w"].lower() in _SMALL and i + 1 < len(out) and len(cur) < 4
        if stop or ((len(cur) >= 3 or len(text) >= 18) and not dangling):
            caps.append([cur[0]["s"], re.sub(r"[.,;:]+$", "", text)])
            cur = []
    if cur:
        caps.append([cur[0]["s"], re.sub(r"[.,;:]+$", "", " ".join(x["w"] for x in cur))])
    end = out[-1]["e"]
    caps[-1].append(round(end + 0.3, 2))
    return {"words": out, "lines": spans, "captions": caps, "end": end}


def write_timing(engine: Engine, proj: Path, tm: dict[str, Any], duration: float) -> None:
    """The timing file the engine and the shots read."""
    if engine.id == "whatif3d":
        (proj / "src" / "timing.js").write_text(
            f"export const DURATION = {duration:.2f};\n"
            f"export const CAPTIONS = {json.dumps(tm['captions'], ensure_ascii=False)};\n"
            f"export const WORDS = {json.dumps(tm['words'], ensure_ascii=False)};\n"
            f"export const LINES = {json.dumps(tm['lines'], ensure_ascii=False)};\n",
            encoding="utf-8",
        )
    else:
        (proj / "words.js").write_text(
            f"const WORDS = {json.dumps(tm['words'], ensure_ascii=False)};\n"
            f"const LINES = {json.dumps(tm['lines'], ensure_ascii=False)};\n"
            f"const VO_END = {duration:.2f};\n",
            encoding="utf-8",
        )


def new_project(engine: Engine, dest: Path) -> Path:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(KIT / engine.folder, dest, ignore=shutil.ignore_patterns("example_shots.js"))
    if engine.id == "whatif3d":
        (dest / "fonts").mkdir(exist_ok=True)
        shutil.copyfile(
            KIT / "fonts" / "montserrat-latin-700-normal.woff2",
            dest / "fonts" / "montserrat-latin-700-normal.woff2",
        )
    return dest


# ───────────────────────────── the shots ─────────────────────────────

RULES_3D = """You write `src/shots.js` for a three.js engine that renders a 720×1280 (9:16) cartoon short.

The file is an ES module. Import only from 'three', 'three/addons/…', './human.js', './props.js',
'./materials.js', './anim.js', './textures.js' and './timing.js' (which exports DURATION, CAPTIONS,
WORDS [{w, s, e, line}] and LINES [{text, s, e}]: the voice's real timings). It must export:
- `FADES`: [[fadeInStart, fullStart, fullEnd, fadeOutEnd], …] dips to black: one short dip on the "But"
  turn (about 0.45 s in all), or [].
- `SHOTS`: [{start, end, build}, …] in seconds of the voice, covering 0 to DURATION with no gaps,
  cutting on caption beats. A new shot every 2 to 4 s, the mechanism shot the longest.
Do NOT export DURATION or CAPTIONS (the engine reads them from ./timing.js).

A shot's `build({makeStage})` returns `{scene, camera, update(t)}`. `makeStage({shadowSize, sunDir, sun})`
gives the scene with the blue sky, ground shadows and lights. `update(t)` gets the time inside the
shot and may return `{dof: {focus, aperture, maxblur}, bloom, exposure}`.

Hard rules:
- `update(t)` depends ONLY on t: set every position, rotation, pose, opacity and scale from t on every
  call. No state carried between frames (a render starts in the middle of a shot, and frames are drawn
  out of order by several browsers).
- Deterministic: no Math.random (use rng(seed) from textures.js), no Date, no performance.now, no
  timers, no requestAnimationFrame, no fetch, no import(), no eval, no DOM access except
  document.createElement('canvas') for a texture.
- Software rendering: keep it light (geometry segments 48 or fewer, at most a few hundred meshes per
  shot, no new lights in update, no shadow-map sizes above 2048).
- The frame is narrow (about 19 degrees wide at fov 34). Keep faces and key props out of the caption
  band (y about 950 to 1030 of 1280) and away from the frame edges; to keep a projectile in frame, ride
  behind it.
- Each shot SHOWS what its words say at that moment. Start the hook in action on frame 1.
- People: makeHuman(outfit, opts) with outfit 'vest' | 'chainmail' | 'plate' | 'knight' | 'archer' |
  'plain' (normal clothes; opts {shirt: 0x2f7cf6, pants: 0x333a44} colours them), setPose, setMouth
  (open the mouth when someone talks or screams), lerpPose. Keep people in proportion with the props.
- New props are small functions in this file that return a THREE.Group of simple shapes with the
  engine's materials (materials()) or MeshStandardMaterial / MeshPhysicalMaterial. Cartoon, bright,
  readable; metal reads as metal. sparks are glowing points, so dust or splinters need their own meshes.
  rippleOverlay needs one mesh to sit on (for a target made of parts, give it an invisible disc).
- Style: bright blue studio sky, soft daylight; slow motion on the impact, a short camera shake,
  sparks, bloom on hot things; the red ripple shows force spreading.
- No text in the 3D scene (the captions are drawn by the engine)."""

RULES_STICK = """You write `shots.js` for a canvas-2D engine that renders a 1080×1920 (9:16) stick-figure reel.

The file is a classic script loaded after lib.js, chars.js, env.js and words.js (which defines WORDS
[{w, s, e, line}], LINES [{text, s, e}] and VO_END: the voice's real timings). It must declare
`const SHOTS = [];` and push each shot: `SHOTS.push({start, end, tr, draw(ctx, lt, t) {…}})`, in seconds
of the voice, covering 0 to at least VO_END + 0.6 with no gaps; `lt` is the time inside the shot, `t` the
reel time; `tr` is the transition out, 'whip' or 'cut'. About 10 to 12 setups, most 2 to 4 s, the
explainer shot longer. A new idea gets a new setup.

Hard rules:
- `draw` depends ONLY on its arguments: every value computed from lt and t on every call. Frames are
  drawn out of order by several browsers.
- Deterministic: no Math.random (use rng(seed) from lib.js), no Date, no performance.now, no timers,
  no requestAnimationFrame, no fetch, no import(), no eval, no DOM access.
- Each draw fills the whole frame (a sky or a background first): no transparent or black frames.
- Keep faces and key props out of the caption band (y about 1250 to 1420) and inside the safe area
  (x 100 to 980, y 220 to 1500). Start the hook in action on frame 1.
- Keep it fast: a frame well under 60 ms (no huge loops, no per-pixel work).
- People: drawStick(ctx, {x, y, s, cols, hat, face: {eyes, look, mouth, …}, arms, legs, …}) as in the
  example; props drawn with thick ink outlines (INK, fillStroke), soft contact shadows. The env.js props
  are the pirate world of the example; draw the props THIS story needs as new functions in this file.
- Style: bright saturated palette, ink outlines, slow push-ins with handheld drift (applyCam + shake),
  whip transitions, an impact is a burst, a shake and a flash. No text on screen (the engine draws the
  captions), no em dashes."""

WRITE_PROMPT = """## The voiceover, sentence by sentence (seconds of the voice)

{lines}

## The captions as they will appear

{captions}

## The length

The voice ends at {end:.2f} s; the reel runs {duration:.2f} s.

## The engine's API

{api}

## The finished example short (a different story: follow its craft, not its content)

{example}

Write the whole shots file for THIS voiceover now. Return only the JavaScript, no fences, no notes."""


def _api_text(engine: Engine) -> str:
    parts = []
    for rel in engine.api:
        src = (KIT / engine.folder / rel).read_text(encoding="utf-8")
        parts.append(f"### {rel}\n\n{src}")
    if engine.id == "whatif3d":
        main = (KIT / engine.folder / "src" / "main.js").read_text(encoding="utf-8")
        cut = main.find("// ---------- post ----------")
        parts.append("### src/main.js (the part that makes the stage)\n\n" + main[: max(0, cut)])
    return "\n\n".join(parts)


def _code(text: str) -> str:
    text = text.strip()
    m = re.search(r"```(?:js|javascript)?\s*\n(.*?)```", text, re.S)
    return (m.group(1) if m else text).strip() + "\n"


BANNED = [
    r"\bfetch\s*\(",
    r"XMLHttpRequest",
    r"WebSocket",
    r"EventSource",
    r"\bimport\s*\(",
    r"\beval\s*\(",
    r"\bnew\s+Function\b",
    r"Math\.random",
    r"\bDate\b",
    r"performance\.now",
    r"requestAnimationFrame",
    r"setTimeout|setInterval",
    r"localStorage|sessionStorage|indexedDB|cookie",
    r"\blocation\b|window\.open|navigator\.",
    r"document\.(?!createElement\(\s*['\"]canvas['\"]\s*\))",
    r"postMessage|\bWorker\s*\(",
]
_IMPORT_OK = re.compile(
    r"""^\s*import\s[^'"]*['"](three|three/addons/[\w./-]+|\./(human|props|materials|anim|textures|timing)\.js)['"]"""
)


def unsafe(engine: Engine, code: str) -> list[str]:
    bad = [b for b in BANNED if re.search(b, code)]
    for ln in code.splitlines():
        if re.match(r"^\s*import\b", ln) and not (engine.id == "whatif3d" and _IMPORT_OK.match(ln)):
            bad.append("import " + ln.strip()[:60])
    if engine.id == "whatif3d" and re.search(r"export\s+const\s+(DURATION|CAPTIONS)\b", code):
        bad.append("exports DURATION or CAPTIONS (they come from ./timing.js)")
    return bad


def _lines_text(tm: dict[str, Any]) -> str:
    return "\n".join(f"{x['s']:6.2f}–{x['e']:6.2f}  {x['text']}" for x in tm["lines"])


def _caps_text(tm: dict[str, Any]) -> str:
    return "  ".join(f"[{c[0]:.2f} {c[1]}]" for c in tm["captions"])


def write_shots(
    client: Any, model: str, engine: Engine, tm: dict[str, Any], duration: float
) -> tuple[str, dict[str, int]]:
    rules = RULES_3D if engine.id == "whatif3d" else RULES_STICK
    prompt = WRITE_PROMPT.format(
        lines=_lines_text(tm),
        captions=_caps_text(tm),
        end=tm["end"],
        duration=duration,
        api=_api_text(engine),
        example=(KIT / engine.folder / "example_shots.js").read_text(encoding="utf-8"),
    )
    text, usage = _call(client, model, rules, prompt, CODE_TOKENS)
    return _code(text), usage


def install_shots(engine: Engine, proj: Path, code: str, duration: float) -> None:
    """The shots file, with the last shot held to the end of the reel."""
    tail = (
        f"\nif (SHOTS.length) {{ SHOTS[0].start = 0; "
        f"SHOTS[SHOTS.length - 1].end = Math.max(SHOTS[SHOTS.length - 1].end, {duration:.2f}); }}\n"
    )
    (proj / engine.shots).write_text(code + tail, encoding="utf-8")


# ───────────────────────────── the browser ─────────────────────────────


def _handler(root: Path, three: Path | None) -> type[http.server.SimpleHTTPRequestHandler]:
    class H(http.server.SimpleHTTPRequestHandler):
        def translate_path(self, path: str) -> str:
            p = unquote(urlsplit(path).path)
            base, rel = root, p.lstrip("/")
            if three is not None and p.startswith("/vendor/three/"):
                base, rel = three, p[len("/vendor/three/") :]
            target = (base / rel).resolve()
            if not target.is_relative_to(base.resolve()):
                return str(root / "__nope__")
            return str(target)

        def log_message(self, *a: Any) -> None:
            pass

    return H


@contextlib.contextmanager
def serve(root: Path, three: Path | None) -> Iterator[str]:
    """The project on a local port (ES modules can't load from file:), and nothing else."""
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _handler(root, three))
    th = threading.Thread(target=srv.serve_forever, daemon=True)
    th.start()
    try:
        yield f"http://127.0.0.1:{srv.server_address[1]}"
    finally:
        srv.shutdown()
        srv.server_close()


def chromium_args(gl: str) -> list[str]:
    if gl == "gpu":
        return ["--enable-gpu", "--ignore-gpu-blocklist"]
    return ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]


@contextlib.contextmanager
def page(
    engine: Engine, proj: Path, three: Path | None, gl: str
) -> Iterator[tuple[Any, list[str]]]:
    """A page with the project loaded; requests anywhere but the project are refused. Yields the page
    and the list its errors are collected in."""
    from playwright.sync_api import sync_playwright

    errors: list[str] = []
    with serve(proj, three) as base, sync_playwright() as p:
        browser = p.chromium.launch(args=chromium_args(gl))
        try:
            w, h = engine.size
            pg = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            pg.route(
                "**/*",
                lambda r: r.continue_() if r.request.url.startswith(base + "/") else r.abort(),
            )
            pg.on("pageerror", lambda e: errors.append(str(e)[:300]))
            pg.on(
                "console",
                lambda m: errors.append(m.text[:300]) if m.type == "error" else None,
            )
            pg.goto(f"{base}/index.html?render=1")
            if engine.id == "whatif3d":
                pg.wait_for_function("window.renderAt && window.ready", timeout=60000)
                pg.evaluate("window.ready")
            else:
                pg.wait_for_function("window.renderFrame && window.TOTAL_FRAMES", timeout=60000)
                pg.evaluate(
                    "async () => { await document.fonts.load('700 40px Poppins');"
                    " await document.fonts.load('700 40px Lora'); }"
                )
            yield pg, errors
        finally:
            browser.close()


def _frame(engine: Engine, pg: Any, t: float, quality: int = 90) -> bytes:
    if engine.id == "whatif3d":
        pg.evaluate("t => window.renderAt(t)", t)
        w, h = engine.size
        return bytes(
            pg.screenshot(
                type="jpeg", quality=quality, clip={"x": 0, "y": 0, "width": w, "height": h}
            )
        )
    data = pg.evaluate(
        "([f, q]) => { renderFrame(f); return grab(q); }", [round(t * FPS), quality / 100]
    )
    return base64.b64decode(str(data).split(",", 1)[1])


def _flat(jpg: bytes) -> bool:
    import io

    from PIL import Image, ImageStat

    im = Image.open(io.BytesIO(jpg)).convert("L").resize((90, 160))
    return max(ImageStat.Stat(im).stddev) < 3.0


def check(engine: Engine, proj: Path, three: Path | None, gl: str, out_dir: Path) -> dict[str, Any]:
    """Loads the reel and draws every shot at three moments. Returns {spans, shots: [{notes,
    still}], load: [errors]}; a reel that doesn't load has no shots."""
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        with page(engine, proj, three, gl) as (pg, errors):
            spans = pg.evaluate("window.SHOT_SPANS")
            shots = []
            for i, (s, e) in enumerate(spans):
                notes: list[str] = []
                still = None
                for k, t in enumerate((s + 0.05, (s + e) / 2, max(s, e - 0.05))):
                    before = len(errors)
                    try:
                        jpg = _frame(engine, pg, t, 80)
                    except Exception as exc:  # a throw inside the shot's code
                        notes.append(f"throws at t={t:.2f}: {str(exc)[:300]}")
                        break
                    notes += [f"at t={t:.2f}: {x}" for x in errors[before:]]
                    if _flat(jpg):
                        notes.append(f"the frame at t={t:.2f} is blank or one flat colour")
                    if k == 1:
                        still = out_dir / f"shot_{i + 1:02d}.jpg"
                        still.write_bytes(jpg)
                shots.append({"span": [s, e], "notes": notes, "still": still})
            return {"spans": spans, "shots": shots, "load": []}
    except Exception as exc:
        return {"spans": [], "shots": [], "load": [str(exc)[:600]]}


def problems(engine: Engine, code: str, result: dict[str, Any]) -> list[str]:
    out = [f"forbidden: {b}" for b in unsafe(engine, code)]
    out += [f"the reel does not load: {x}" for x in result["load"]]
    for i, s in enumerate(result["shots"]):
        out += [f"shot {i + 1} ({s['span'][0]:.2f}–{s['span'][1]:.2f}): {n}" for n in s["notes"]]
    return out


FIX_PROMPT = """The shots file below fails the checks. Fix every problem listed, keep everything that works,
and return the whole corrected file (only the JavaScript, no fences, no notes).

## Problems

{problems}

## The voiceover (seconds of the voice)

{lines}

## The file

{code}"""


def fix(
    client: Any,
    model: str,
    engine: Engine,
    tm: dict[str, Any],
    code: str,
    issues: list[str],
) -> tuple[str, dict[str, int]]:
    rules = RULES_3D if engine.id == "whatif3d" else RULES_STICK
    prompt = FIX_PROMPT.format(
        problems="\n".join(f"- {p}" for p in issues[:40]), lines=_lines_text(tm), code=code
    )
    text, usage = _call(client, model, rules + "\n\n## The engine's API\n\n" + _api_text(engine),
                        prompt, CODE_TOKENS)  # fmt: skip
    return _code(text), usage


CRITIQUE_PROMPT = """You are the director checking the animator's work. Below: the voiceover with its times, then
one still from the middle of every shot, then the shots file.

Look at every still and check:
- the shot shows what is being said at that moment (the caption under it names what is on screen);
- the subject is clear and big enough, not cut off by the frame edges, not hidden;
- faces and key props stay out of the caption band and inside the safe area;
- nothing is broken: floating or detached limbs, objects inside each other, a person facing away, a
  camera inside an object, an empty sky, a frame that is mostly one colour;
- the shots differ (a new idea gets a new setup) and the hook is in action.

If every shot is good, return exactly: NO CHANGES
Otherwise return the whole revised file with the fixes (only the JavaScript, no fences, no notes).

## The voiceover

{lines}"""


def critique(
    client: Any,
    model: str,
    engine: Engine,
    tm: dict[str, Any],
    code: str,
    result: dict[str, Any],
) -> tuple[str | None, dict[str, int]]:
    """None when the director is happy, else the revised file."""
    from rasika_worker.planner import _b64_image

    content: list[dict[str, Any]] = [
        {"type": "text", "text": CRITIQUE_PROMPT.format(lines=_lines_text(tm))}
    ]
    for i, s in enumerate(result["shots"]):
        if s["still"]:
            content.append(
                {"type": "text", "text": f"Shot {i + 1} ({s['span'][0]:.2f}–{s['span'][1]:.2f} s)"}
            )
            content.append(_b64_image(Path(s["still"])))
    content.append({"type": "text", "text": "## The shots file\n\n" + code})
    rules = RULES_3D if engine.id == "whatif3d" else RULES_STICK
    text, usage = _call(client, model, rules, content, CODE_TOKENS)
    if text.strip().upper().startswith("NO CHANGES"):
        return None, usage
    return _code(text), usage


# ───────────────────────────── the render ─────────────────────────────


def render_range(
    engine_id: str, proj: Path, three: Path | None, gl: str, f0: int, f1: int, dest: Path,
    ffmpeg: str,
) -> None:  # fmt: skip
    """Frames f0..f1-1 → an H.264 segment (run in its own process, one browser each)."""
    engine = ENGINES[engine_id]
    ff = subprocess.Popen(
        [ffmpeg, "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg",
         "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
         "-r", str(FPS), str(dest)],
        stdin=subprocess.PIPE,
    )  # fmt: skip
    assert ff.stdin is not None
    with page(engine, proj, three, gl) as (pg, _errors):
        for f in range(f0, f1):
            ff.stdin.write(_frame(engine, pg, f / FPS, 94))
            if (f - f0) % 15 == 14:
                print(f"frames {f - f0 + 1}", flush=True)  # read by render() for the progress
    ff.stdin.close()
    if ff.wait() != 0 or not dest.exists():
        raise RuntimeError(f"ffmpeg failed on frames {f0}–{f1}")


def render(
    engine: Engine,
    proj: Path,
    three: Path | None,
    gl: str,
    duration: float,
    dest: Path,
    ffmpeg: str,
    workers: int = 4,
    timeout: float = 5400,
    progress: Callable[[float], None] | None = None,
) -> Path:
    """The whole reel, split across `workers` browsers, joined and scaled to 1080×1920 (silent).
    `progress` is told the share of frames drawn every few seconds."""
    total = round(duration * FPS)
    n = max(1, min(workers, total // 30 or 1))
    seg_dir = proj.parent / "seg"
    shutil.rmtree(seg_dir, ignore_errors=True)
    seg_dir.mkdir(parents=True)
    bounds = [round(total * k / n) for k in range(n + 1)]
    procs = []
    for k in range(n):
        seg = seg_dir / f"seg_{k:02d}.mp4"
        cmd = [sys.executable, "-m", "rasika_worker.whatif", "render", engine.id, str(proj),
               str(three or "-"), gl, str(bounds[k]), str(bounds[k + 1]), str(seg), ffmpeg]  # fmt: skip
        log = open(seg_dir / f"seg_{k:02d}.log", "w", encoding="utf-8")  # noqa: SIM115
        procs.append((subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT,
                                       cwd=str(Path(__file__).resolve().parents[1])), seg, log))  # fmt: skip
    started = time.time()
    while any(proc.poll() is None for proc, _, _ in procs) and time.time() - started < timeout:
        time.sleep(4)
        if progress:
            done = 0
            for _, seg, _ in procs:
                found = re.findall(
                    r"frames (\d+)", seg.with_suffix(".log").read_text("utf-8", "replace")
                )
                done += int(found[-1]) if found else 0
            progress(min(1.0, done / max(1, total)))
    failed = []
    for proc, seg, log in procs:
        try:
            code = proc.wait(timeout=max(1.0, timeout - (time.time() - started)))
        except subprocess.TimeoutExpired:
            proc.kill()
            code = -1
        log.close()
        if code != 0 or not seg.exists():
            failed.append(
                (seg.with_suffix(".log").read_text(encoding="utf-8", errors="replace"))[-800:]
            )
    if failed:
        raise AnimationError("The animation could not be rendered: " + failed[0])
    listing = seg_dir / "list.txt"
    listing.write_text("".join(f"file '{p.as_posix()}'\n" for _, p, _ in procs), encoding="utf-8")
    w, _h = engine.size
    scale = [] if w == 1080 else ["-vf", "scale=1080:1920:flags=lanczos"]
    subprocess.run(
        [ffmpeg, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing), *scale,
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-r", str(FPS), "-an", str(dest)],
        check=True,
    )  # fmt: skip
    return dest


def cues(tm: dict[str, Any], spans: list[list[float]], kit: str) -> list[dict[str, Any]]:
    """A whoosh on every cut (the sound bed's cues)."""
    gain = 0.45 if kit == "cinematic" else 0.5
    return [
        {"t": round(max(0.0, s - 0.08), 3), "type": "whoosh", "dur": 0.35, "gain": gain}
        for s, _e in spans[1:]
    ]


def main() -> None:
    a = sys.argv[1:]
    if len(a) == 9 and a[0] == "render":
        _, eid, proj, three, gl, f0, f1, dest, ffmpeg = a
        render_range(eid, Path(proj), None if three == "-" else Path(three), gl, int(f0), int(f1),
                     Path(dest), ffmpeg)  # fmt: skip
        return
    sys.exit(
        "usage: python -m rasika_worker.whatif render <engine> <project> <three|-> <gl> <f0> <f1> <out> <ffmpeg>"
    )


if __name__ == "__main__":
    main()
