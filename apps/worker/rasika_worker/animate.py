"""The /animate studio: a style reference + a rough idea → a film drawn entirely in code.

The same method as the /animate skill (researcher, art director, animator, editor, QA in one):

1. `write_film`: Claude studies the user's 1–3 style images and writes the style bible (palette,
   line, texture, light, motion personality, how to draw it in code), the facts it will show (for
   explainers) and a shot list — one idea per shot, 2–4 s each, the camera always moving.
2. `write_code`: one drawing function per shot — the body of `draw(g, t, W, H, rnd, S)` on a
   1080×1920 canvas, a pure function of time (engine element `codeScene`).
3. `check`: every shot is run in a browser with no network at five moments; errors, blank frames
   and slow frames come back as notes.
4. `critique`: a still of every shot goes back to Claude next to the references; it fixes what is
   off (palette, line, texture, readability, the subject in the first second). One loop, and a fix
   that breaks a shot is dropped, never shipped.

Everything on screen is drawn by the code: no video model, no stock footage, no AI images.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from rasika_worker.reference import parse_json

W, H = 1080, 1920
MOODS = ("launch", "showreel", "recipe", "versus", "journey", "none")

# what drawing code may never reach for (mirrors validatePlan's CODE_BANNED)
BANNED = [
    r"\bfetch\s*\(",
    r"XMLHttpRequest",
    r"WebSocket",
    r"EventSource",
    r"\bimport\s*\(",
    r"\beval\s*\(",
    r"\bFunction\s*\(",
    r"Math\.random",
    r"\bDate\b",
    r"performance\.now",
    r"requestAnimationFrame",
    r"setTimeout|setInterval",
    r"localStorage|sessionStorage|indexedDB|document\.cookie",
    r"\blocation\b|window\.open|navigator\.",
    r"\bdocument\.",
    r"postMessage|Worker\s*\(",
]


def unsafe(code: str) -> list[str]:
    return [b for b in BANNED if re.search(b, code)]


FILM_SYSTEM = """You are the art director and writer of an animation studio where every frame is drawn by code
(canvas 2D, 1080×1920 vertical). You get the user's style references (images), a topic or story, a
length and whether there is narration. Return ONE JSON object, nothing else:

{
  "title": "short title",
  "style": {
    "palette": [{"hex": "#rrggbb", "role": "background|ink|accent|highlight|shadow|..."}],   // 5–8, sampled from the references
    "line": "stroke weight, wobble, corners, outlines or none",
    "texture": "paper grain, watercolour bleed, halftone, felt, gouache flatness…",
    "light": "flat, soft gradient, rim light…",
    "motion": "springy / floaty / snappy / slow and heavy; camera habits",
    "how": "one paragraph: how we draw this in canvas code (layers, gradients, noise for texture, splines for bodies)"
  },
  "facts": [{"fact": "…", "source": "where this is established (encyclopaedia, official site, paper)"}],  // explainers only; [] for stories
  "shots": [{"sec": 3.0, "see": "what we see", "moves": "what moves", "camera": "push-in / track / pull back / pan / glide",
             "words": "≤ 6 on-screen words or empty", "sound": "whoosh|pop|impact|none"}],
  "narration": null | "the full voice-over (only when narration is on; ~2.4 words a second)",
  "music": {"mood": "launch|showreel|recipe|versus|journey|none"}
}

Rules:
- The sum of shot secs = the requested length (±0.5 s). One idea per shot, 2–4 s each.
- The first second already moves and shows the subject. No title cards before the action.
- Camera language: open wide, move in and track the subject, glide to a second subject, pull back to
  reveal. Never a still frame. Big reveals take 2–3 s.
- Pure animation beats UI: no info cards, badges, progress bars or label pills. Words only where they
  help, few (≤ 6 per shot), and most shots have none.
- Explainers: only facts you are sure of and could cite; simplify or leave out anything uncertain.
- The references guide the LOOK only: never copy their subject or composition; describe the style.
"""

CODE_SYSTEM = """You are the animator. You write each shot as JavaScript: the BODY of a function

    function draw(g, t, W, H, rnd, S) { …your code… }

- g: CanvasRenderingContext2D for a 1080×1920 canvas (W=1080, H=1920), cleared before each call.
- t: seconds since the shot began (0 … S.D, where S.D is the shot's length).
- rnd(): seeded random in [0,1); it restarts every frame, so the same calls give the same numbers.
- S: helpers — S.D (shot length), S.lerp(a,b,p), S.clamp(x,a=0,b=1), S.prog(t,a,b[,ease]) eased progress,
  S.ease.{linear,outCubic,inCubic,inOutCubic,outQuint,outExpo,inExpo,outBack,outQuart,inOutQuint},
  S.spring(p) (small overshoot), S.smooth(a,b,x), S.noise(x,y) smooth value noise 0..1,
  S.mix("#rrggbb","#rrggbb",p) → css colour, S.TAU.

Hard rules (code that breaks them is rejected):
- A pure function of t: no Math.random, Date, performance, timers, requestAnimationFrame, fetch,
  document, window, storage, eval, Function, import. No state kept between calls.
- Draw EVERYTHING yourself with paths, arcs, bezier curves, gradients and transforms. No images, no text
  (on-screen words are set by a separate layer; leave the lower third calm when a shot has words).
- Fast: each frame must draw in well under 60 ms. Prefer a few hundred path operations; build texture
  with rnd()-placed dabs or a small grid of S.noise samples, not per-pixel loops over the canvas.
- Fill the whole frame every time (start with the background), so no frame is ever blank.
- Living things feel alive: bodies follow a curve and bend, wings and fins lag, everything has a slow idle
  motion (sway, bob, drift). The camera moves (scale/translate the scene with g.save/translate/scale).
- Match the style bible: its palette hex values exactly, its line, texture and light.

Output format — plain text, no JSON, no markdown fences: for every shot, a marker line then its code:
=== SHOT 1 ===
…the body of draw for shot 1…
=== SHOT 2 ===
…
One block per shot, in order, nothing before the first marker.
"""

CRITIQUE_SYSTEM = """You are the editor and QA of a code-animation studio. You get the style references, the style
bible, the shot list, one still per shot (rendered at the shot's middle) and each shot's code. For each
shot check: does it match the references' palette, line and texture? Is the subject readable and is the
frame composed (nothing cut off by accident, no stray shapes, even spacing)? Does it say what the shot
list says? Fix only what is off. Output, plain text (no JSON, no fences):
NOTES:
- …what you fixed, one line per shot you changed…
=== SHOT 2 ===
…the full corrected body of draw for shot 2…
(one block per shot you fixed; shots that are fine are left out). Same code rules as before (pure
function of t, no text, no images, fast).
"""


def _images(paths: list[Path]) -> list[dict[str, Any]]:
    from rasika_worker.planner import _b64_image

    out: list[dict[str, Any]] = []
    for i, p in enumerate(paths[:3]):
        out.append({"type": "text", "text": f"Style reference {i + 1}"})
        out.append(_b64_image(p))
    return out


def _call(
    client: Any, model: str, system: str, content: list[dict[str, Any]], max_tokens: int
) -> tuple[str, dict[str, int]]:
    with client.messages.stream(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": content}],
    ) as stream:
        msg = stream.get_final_message()
    text = "".join(getattr(b, "text", "") for b in msg.content)
    usage = {
        "input_tokens": int(getattr(msg.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(msg.usage, "output_tokens", 0) or 0),
    }
    return text, usage


def write_film(
    client: Any,
    model: str,
    topic: str,
    seconds: float,
    narrate: bool,
    refs: list[Path],
    ending: str = "",
) -> tuple[dict[str, Any], dict[str, int]]:
    content = [
        {
            "type": "text",
            "text": f"## Topic / story\n\n{topic}\n\n## Length\n\n{seconds:.0f} seconds, 9:16\n\n"
            f"## Narration\n\n{'on' if narrate else 'off (music only)'}\n\n"
            + (f"## Ending / words the user wants\n\n{ending}\n\n" if ending else "")
            + (
                "## The style references follow."
                if refs
                else "## No references: choose a clear, bold style that suits the topic."
            ),
        },
        *_images(refs),
    ]
    text, usage = _call(client, model, FILM_SYSTEM, content, 8000)
    film = parse_json(text)
    shots = [s for s in film.get("shots") or [] if isinstance(s, dict)]
    if not shots:
        raise ValueError("the studio wrote no shots")
    total = sum(max(1.0, float(s.get("sec", 3))) for s in shots)
    k = seconds / total if total else 1.0
    for s in shots:  # the film runs the length asked for
        s["sec"] = round(max(1.0, float(s.get("sec", 3))) * k, 2)
    film["shots"] = shots
    mood = str((film.get("music") or {}).get("mood") or "journey")
    film["music"] = {"mood": mood if mood in MOODS else "journey", "bpm": None}
    film["narration"] = (str(film.get("narration") or "").strip() or None) if narrate else None
    return film, usage


def _style_text(film: dict[str, Any]) -> str:
    return json.dumps({"style": film.get("style"), "shots": film.get("shots")}, ensure_ascii=False)


MARK = re.compile(r"^=+\s*SHOT\s+(\d+)\s*=+\s*$", re.M)


def parse_shots(text: str) -> dict[int, str]:
    """Shot blocks from `=== SHOT n ===` markers (0-based keys), fences stripped."""
    parts = MARK.split(text)
    out: dict[int, str] = {}
    for i in range(1, len(parts) - 1, 2):
        code = parts[i + 1].strip()
        code = re.sub(r"^```[a-z]*\s*|```\s*$", "", code).strip()
        if code:
            out[int(parts[i]) - 1] = code
    return out


def write_code(
    client: Any, model: str, film: dict[str, Any], refs: list[Path]
) -> tuple[list[str], dict[str, int]]:
    """One call per shot (three at a time): a whole film in one answer runs out of room."""
    from concurrent.futures import ThreadPoolExecutor

    n = len(film["shots"])
    base = [
        {"type": "text", "text": "## The style bible and shot list\n\n" + _style_text(film)},
        *_images(refs),
    ]

    def one(i: int) -> tuple[str, dict[str, int]]:
        ask = {
            "type": "text",
            "text": f"Write shot {i + 1} of {n} only, under its `=== SHOT {i + 1} ===` marker.",
        }
        for _attempt in range(2):
            text, usage = _call(client, model, CODE_SYSTEM, [*base, ask], 16000)
            code = parse_shots(text).get(i)
            if code:
                return code, usage
        raise ValueError(f"the animator wrote nothing for shot {i + 1}")

    with ThreadPoolExecutor(max_workers=3) as pool:
        got = list(pool.map(one, range(n)))
    total = {
        "input_tokens": sum(u["input_tokens"] for _, u in got),
        "output_tokens": sum(u["output_tokens"] for _, u in got),
    }
    return [c for c, _ in got], total


CHECK_JS = """async ([codes, durs, stillDir]) => {
  const out = [];
  const E = window.RasikaEngine;
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const g = c.getContext('2d');
  for (let i = 0; i < codes.length; i++) {
    const D = durs[i]; const notes = []; let still = null; let slow = 0;
    let fn = null;
    try { fn = new Function('g', 't', 'W', 'H', 'rnd', 'S', '"use strict";\\n' + codes[i]); }
    catch (e) { out.push({ notes: ['does not compile: ' + e], still: null }); continue; }
    for (const f of [0, 0.25, 0.5, 0.75, 0.98]) {
      const t = D * f;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 1080, 1920);
      const a = performance.now();
      try { fn(g, t, 1080, 1920, E.seededRandom(7), { ...E.codeHelpers, D }); }
      catch (e) { notes.push(`throws at t=${t.toFixed(2)}: ${e}`); break; }
      slow = Math.max(slow, performance.now() - a);
      const px = g.getImageData(0, 0, 1080, 1920).data;
      let n = 0, sum = 0, sq = 0;
      for (let k = 0; k < px.length; k += 4 * 997) { const v = px[k] + px[k + 1] + px[k + 2]; sum += v; sq += v * v; n++; }
      const alpha = px[3 + 4 * 1080 * 960 + 4 * 540];
      const varc = sq / n - (sum / n) ** 2;
      if (varc < 4) notes.push(`frame at t=${t.toFixed(2)} is blank or one flat colour`);
      if (alpha < 250) notes.push(`frame at t=${t.toFixed(2)} does not fill the frame (transparent centre)`);
      if (f === 0.5) still = c.toDataURL('image/jpeg', 0.8);
    }
    if (slow > 120) notes.push(`a frame takes ${slow.toFixed(0)} ms to draw (keep it well under 60 ms)`);
    out.push({ notes, still });
  }
  return out;
}"""


def check(
    settings: Any, codes: list[str], durs: list[float], out_dir: Path
) -> list[dict[str, Any]]:
    """Run every shot at five moments in a no-network page; notes per shot + a still at the middle."""
    import base64

    from playwright.sync_api import sync_playwright

    from rasika_worker.render import _local_only

    out_dir.mkdir(parents=True, exist_ok=True)
    engine = (settings.engine_dir / "dist" / "rasika-engine.js").resolve()
    page_file = out_dir / "check.html"
    page_file.write_text(
        f'<!doctype html><meta charset="utf-8"><script src="{engine.as_uri()}"></script>',
        encoding="utf-8",
    )
    results: list[dict[str, Any]] = []
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--allow-file-access-from-files"])
        page = b.new_page()
        page.route("**/*", _local_only)
        page.goto(page_file.as_uri())
        page.wait_for_function("!!window.RasikaEngine", timeout=20000)
        raw = page.evaluate(CHECK_JS, [codes, durs, ""])
        b.close()
    for i, r in enumerate(raw):
        notes = list(r.get("notes") or [])
        bad = unsafe(codes[i])
        if bad:
            notes.insert(0, "uses forbidden calls: " + ", ".join(bad))
        still = None
        if r.get("still"):
            still = out_dir / f"shot_{i + 1}.jpg"
            still.write_bytes(base64.b64decode(str(r["still"]).split(",", 1)[1]))
        results.append({"notes": notes, "still": still})
    return results


def fix_broken(
    client: Any, model: str, film: dict[str, Any], codes: list[str], results: list[dict[str, Any]]
) -> tuple[list[str], dict[str, int]]:
    """Shots that fail the checks go back to the animator with the notes."""
    broken = [i for i, r in enumerate(results) if r["notes"]]
    if not broken:
        return codes, {"input_tokens": 0, "output_tokens": 0}
    content = [
        {"type": "text", "text": "## The style bible and shot list\n\n" + _style_text(film)},
        {
            "type": "text",
            "text": "These shots failed the render checks. Rewrite each one so it passes.\n\n"
            + "\n\n".join(
                f"### Shot {i + 1}\nProblems: {'; '.join(results[i]['notes'])}\nCode:\n{codes[i]}"
                for i in broken
            )
            + "\n\nReturn only these shots, each under its `=== SHOT n ===` marker.",
        },
    ]
    text, usage = _call(client, model, CODE_SYSTEM, content, 24000)
    out = list(codes)
    for n, code in parse_shots(text).items():
        if 0 <= n < len(out):
            out[n] = code
    return out, usage


def critique(
    client: Any,
    model: str,
    film: dict[str, Any],
    codes: list[str],
    stills: list[Path | None],
    refs: list[Path],
) -> tuple[dict[int, str], list[str], dict[str, int]]:
    from rasika_worker.planner import _b64_image

    content: list[dict[str, Any]] = [
        {"type": "text", "text": "## The style bible and shot list\n\n" + _style_text(film)},
        *_images(refs),
    ]
    for i, st in enumerate(stills):
        content.append(
            {"type": "text", "text": f"### Shot {i + 1} — still at its middle\nCode:\n{codes[i]}"}
        )
        if st:
            content.append(_b64_image(st))
    text, usage = _call(client, model, CRITIQUE_SYSTEM, content, 24000)
    fixes = {n: c for n, c in parse_shots(text).items() if 0 <= n < len(codes)}
    head = MARK.split(text)[0]
    notes = [
        ln.strip("-• ").strip() for ln in head.splitlines() if ln.strip().startswith(("-", "•"))
    ]
    return fixes, notes[:20], usage


def draw_shots(
    settings: Any,
    client: Any,
    model: str,
    film: dict[str, Any],
    refs: list[Path],
    out_dir: Path,
    say: Any = lambda _m: None,
) -> tuple[list[str], list[dict[str, Any]], list[str], dict[str, int]]:
    """Code per shot, the render checks, a fix for what failed, one critique loop (a fix that breaks
    a shot is dropped). Returns the codes, the last check of each shot, the editor's notes, usage."""
    total = {"input_tokens": 0, "output_tokens": 0}

    def add(u: dict[str, int]) -> None:
        for k in total:
            total[k] += int(u.get(k, 0))

    durs = [float(s["sec"]) for s in film["shots"]]
    say(f"Drawing {len(durs)} shot{'' if len(durs) == 1 else 's'} in code…")
    codes, u = write_code(client, model, film, refs)
    add(u)
    res = check(settings, codes, durs, out_dir / "check")
    if any(r["notes"] for r in res):
        say("Fixing the shots that did not draw…")
        codes, u = fix_broken(client, model, film, codes, res)
        add(u)
        res = check(settings, codes, durs, out_dir / "check")
    say("Checking every shot against the style…")
    fixes, notes, u = critique(client, model, film, codes, [r["still"] for r in res], refs)
    add(u)
    if fixes:
        trial = list(codes)
        for i, c in fixes.items():
            trial[i] = c
        res2 = check(settings, trial, durs, out_dir / "check2")
        for i in fixes:  # a fix that breaks a shot is dropped, never shipped
            if not res2[i]["notes"]:
                codes[i] = trial[i]
        res = check(settings, codes, durs, out_dir / "check3")
    return codes, res, notes, total


CUTAWAY_SYSTEM = """You are the art director of an animation studio. A person talks to camera in a vertical
reel; on a few key lines we cut away from them to a short animation drawn entirely in code (canvas 2D,
1080×1920) while their voice carries on. You get the timed transcript, the reel's colours, an optional
look the user asked for, and how many scenes to make. Return ONE JSON object, nothing else:

{
  "style": {
    "palette": [{"hex": "#rrggbb", "role": "background|ink|accent|highlight|shadow|..."}],   // 5–7
    "line": "…", "texture": "…", "light": "…", "motion": "…",
    "how": "one paragraph: how we draw this in canvas code"
  },
  "shots": [{"at": 4.2, "sec": 3.0, "line": "the words being said", "see": "what we see", "moves": "what moves",
             "camera": "push-in / track / pull back / pan / glide", "sound": "whoosh|pop|impact|none"}]
}

Rules:
- Pick the lines that a picture explains best: a process, a comparison, a number, an image the speaker
  paints. Never the first sentence (the face hooks the viewer) and never the last two seconds.
- "at" is the start time in seconds of the word that begins the line (from the transcript); "sec" is
  2.5–4. Scenes never overlap and are at least 3 s apart.
- Each scene shows what is being said at that moment, literally and simply, one idea, moving from its
  first frame. No words, letters or numbers drawn (captions run over the scene in the lower third, so
  keep y 1450–1750 calm). No UI cards, no logos, no real people's likeness.
- The palette: the user's look if given; otherwise built from the reel's colours so the cut feels part
  of the edit. Every scene shares the one style.
"""


def cutaways(
    client: Any,
    model: str,
    words: list[dict[str, Any]],
    duration: float,
    n: int,
    tokens: dict[str, Any],
    look: str = "",
) -> tuple[dict[str, Any], dict[str, int]]:
    """Choose the key lines of a talking-head take and write the style + a shot per line."""
    timed = " ".join(
        f"[{float(w.get('t', 0)):.2f}]{w.get('w') or w.get('word') or ''}" for w in words
    )
    pal = tokens.get("palette") or {}
    content = [
        {
            "type": "text",
            "text": f"## Transcript (start times in seconds)\n\n{timed}\n\n"
            f"## Length\n\n{duration:.1f} s\n\n"
            f"## The reel's colours\n\n{json.dumps(pal)}\n\n"
            f"## Look the user asked for\n\n{look or '(none)'}\n\n## Scenes\n\n{n}",
        }
    ]
    text, usage = _call(client, model, CUTAWAY_SYSTEM, content, 6000)
    film = parse_json(text)
    starts = sorted(float(w.get("t", 0)) for w in words)
    shots: list[dict[str, Any]] = []
    free_from = 1.5
    asked = sorted(
        (s for s in film.get("shots") or [] if isinstance(s, dict)),
        key=lambda s: float(s.get("at", 0)),
    )
    for s in asked:
        at = float(s.get("at", 0))
        # on a word start, never in the opening, never past the end
        at = min(starts, key=lambda x: abs(x - at)) if starts else at
        sec = max(2.5, min(4.0, float(s.get("sec", 3))))
        if at < free_from or at + sec > duration - 1.0:
            continue
        s["at"], s["sec"], s["words"] = round(at, 3), round(sec, 2), ""
        shots.append(s)
        free_from = at + sec + 3.0
        if len(shots) >= n:
            break
    if not shots:
        raise ValueError("no line of the take fits an animated scene")
    film["shots"] = shots
    return film, usage


def insert_cutaways(
    plan: dict[str, Any], shots: list[dict[str, Any]], codes: list[str]
) -> dict[str, Any]:
    """Each scene covers the speaker for its line. What the planner put there is dropped when it
    starts inside the scene or mostly lies within it; captions (their own layer) stay on top."""
    plan = json.loads(json.dumps(plan))
    wins = [(float(s["at"]), float(s["at"]) + float(s["sec"])) for s in shots]

    def covered(e: dict[str, Any]) -> bool:
        a, b = float(e.get("t0", 0)), float(e.get("t1", 0))
        for w0, w1 in wins:
            inside = max(0.0, min(b, w1) - max(a, w0))
            if w0 - 0.05 <= a < w1 or (b > a and inside / (b - a) > 0.5):
                return True
        return False

    kept = [e for e in plan.get("elements") or [] if not covered(e)]
    for i, (s, code) in enumerate(zip(shots, codes, strict=True)):
        kept.append(
            {
                "id": f"anim{i + 1}",
                "type": "codeScene",
                "t0": round(float(s["at"]), 3),
                "t1": round(float(s["at"]) + float(s["sec"]), 3),
                "code": code,
                "seed": 31 + i,
            }
        )
    plan["elements"] = sorted(kept, key=lambda e: float(e.get("t0", 0)))
    sfx = plan.setdefault("sfx", {"auto": True, "intensity": 0.6, "extra": []})
    extra = list(sfx.get("extra") or [])
    for s in shots:
        extra.append({"t": round(float(s["at"]), 3), "type": "whoosh", "dur": 0.45, "gain": 0.45})
    sfx["extra"] = extra
    return plan


def palette_style(tokens: dict[str, Any], film: dict[str, Any]) -> dict[str, Any]:
    """The animate preset in the film's own palette (words and captions read on its background)."""
    style: dict[str, Any] = dict(json.loads(json.dumps(tokens)))
    pal = dict(style["palette"])
    roles = {
        str(p.get("role", "")).lower(): str(p.get("hex", ""))
        for p in (film.get("style") or {}).get("palette") or []
    }
    hexes = [h for h in roles.values() if re.fullmatch(r"#[0-9a-fA-F]{6}", h)]

    def luma(h: str) -> float:
        n = int(h[1:], 16)
        return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255

    bg = next(
        (h for r, h in roles.items() if "background" in r and h in hexes),
        hexes[0] if hexes else None,
    )
    if bg:
        pal["stage"] = bg
        dark = luma(bg) < 0.45
        accent = next((h for r, h in roles.items() if "accent" in r and h in hexes), None)
        if accent:
            pal["gold" if dark else "ter"] = accent
        ink = next((h for r, h in roles.items() if "ink" in r and h in hexes), None)
        if ink and abs(luma(ink) - luma(bg)) > 0.4:
            pal["iv" if dark else "mar"] = ink
    style["palette"] = pal
    style["id"] = "animate-studio-film"
    style["name"] = str(film.get("title") or "Animated film")[:40] + " look"
    return style


def build_plan(
    style: dict[str, Any], film: dict[str, Any], codes: list[str], duration: float, narrated: bool
) -> dict[str, Any]:
    """The plan is fixed by the studio's shot list: a codeScene per shot, its words over it, a
    sound on each cut. No planner call: there is nothing left to decide."""
    shots = film["shots"]
    scale = duration / max(0.1, sum(float(s["sec"]) for s in shots))
    t = 0.0
    elements: list[dict[str, Any]] = []
    extra: list[dict[str, Any]] = []
    for i, (s, code) in enumerate(zip(shots, codes, strict=True)):
        dur = float(s["sec"]) * scale
        t0, t1 = round(t, 3), round(min(duration, t + dur), 3)
        elements.append(
            {
                "id": f"shot{i + 1}",
                "type": "codeScene",
                "t0": t0,
                "t1": t1,
                "code": code,
                "seed": 7 + i,
            }
        )
        words = str(s.get("words") or "").strip()
        if words:
            elements.append(
                {
                    "id": f"words{i + 1}",
                    "type": "posterText",
                    "t0": round(t0 + min(0.6, dur * 0.2), 3),
                    "t1": round(t1 - 0.1, 3),
                    "top": 1380,
                    "left": 60,
                    "w": 960,
                    "align": "center",
                    "anim": "rise",
                    "lines": [{"text": words[:60], "font": "anton", "size": 88}],
                }
            )
        snd = str(s.get("sound") or "").lower()
        if i > 0:
            extra.append({"t": t0, "type": "whoosh", "dur": 0.45, "gain": 0.45})
        if snd in ("pop", "impact"):
            extra.append({"t": round(t0 + dur * 0.5, 3), "type": snd, "gain": 0.6})
        t += dur
    return {
        "version": 1,
        "meta": {
            "durationSec": round(duration, 2),
            "fps": 30,
            "width": W,
            "height": H,
            "language": "en",
            "faceless": True,
        },
        "style": style,
        "subject": {
            "faceBox": {"x": 0, "y": 0, "w": 1, "h": 1},
            "freeZone": {"x": 0, "y": 150, "w": W, "h": 1500},
        },
        "videoModes": [{"t": 0, "mode": "full"}],
        "captions": {"enabled": bool(narrated), "y": 1560, "gold": [], "accent": []},
        "sfx": {"auto": False, "intensity": 0.8, "extra": extra},
        "elements": elements,
    }
