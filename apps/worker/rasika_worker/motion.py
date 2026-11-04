"""
Motion animations with no footage: the quick skills of claude-animation-skills (MIT,
(c) 2026 Artem Novitckii; motion_kit/LICENSE), run by the worker instead of by hand.

  graph      a smooth line draws itself while one big number counts up with its tip
  maproute   a white 3D city: a route draws itself, the camera rides along, a pin drops
  breakdown  a 3D phone comes apart layer by layer, every part with a leader line and a label
  minimal    black-and-white line art: a dot hops up hairline steps to one quiet line

  spec_from_line()  one fast-model call turns the user's line into the skill's spec
  check_spec()      the skill's own rules (its build.py), worded for the user
  build_project()   template + spec + fonts + GSAP (+ three.js) → a HyperFrames project folder

The templates are the skills' own (motion_kit/templates); each reads `const SPEC = __SPEC__` and
draws every frame as a function of timeline time, so `hyper.render` renders them as is.
"""

from __future__ import annotations

import json
import re
import shutil
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rasika_worker.reference import parse_json

KIT = Path(__file__).resolve().parent / "motion_kit"
#: seconds the last frame is held, so the reel ends on the result instead of cutting away
HOLD = 1.4

HEX = re.compile(r"#[0-9a-fA-F]{6}")


class SpecError(ValueError):
    """A spec the skill can't draw; the message is shown to the user."""


@dataclass(frozen=True)
class Quick:
    template: str
    three: bool
    defaults: dict[str, Any]
    duration: Callable[[dict[str, Any]], float]
    #: what the writer is told about the spec (the skill's SKILL.md, condensed)
    doc: str


def _minimal_payoff(spec: dict[str, Any]) -> float:
    """when the dot reaches the top; the template uses the same formula"""
    n = int(spec["steps"])
    step = min(0.5, max(0.3, 1.6 / (n - 1)))
    return 0.42 + step * (n - 2) + 0.58


QUICK: dict[str, Quick] = {
    "graph": Quick(
        "graph.html",
        False,
        {
            "label": "",
            "values": None,
            "labels": [],
            "final": None,
            "prefix": "",
            "suffix": "",
            "decimals": 0,
            "dark": False,
        },
        lambda s: 4.0,
        """A minimal line graph: a smooth black line draws itself on white (or white on black) while one big
number counts up with the tip and lands on the final value.
{"label": "Followers", "values": [1.2, 2.1, 3.4, 5, 9, 24, 51, 78, 100],
 "labels": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep"], "final": 100000,
 "prefix": "", "suffix": "", "decimals": 0, "dark": false}
- values: 2 or more numbers, 0 or above, oldest first, exactly as the user gave them (in any unit).
- labels: optional, one per value (months, years, weeks…), only if the user named them or they follow
  plainly from what they said ("in 9 months" from January is not plain: leave labels empty).
- final: the number the count lands on, in full (100K → 100000), when values are in thousands or
  millions; otherwise null.
- prefix/suffix/decimals: "$", "₹", "%", " kg"…; decimals 0 to 2.
- label: a plain noun ("Followers", "Monthly revenue"), never a slogan.
- dark: true only if the user asks for dark or white on black.
NEVER invent data. If the user gives fewer than two numbers (only a start and an end, or none), return
{"error": "<one sentence asking for the numbers in between>"}.""",
    ),
    "maproute": Quick(
        "map-route.html",
        True,
        {
            "destination": None,
            "minutes": None,
            "distance": None,
            "unit": "km",
            "places": ["North Quay", "Botanic Gardens", "Market Hall", "Elm Park", "The Canal"],
            "accent": "#2f7cf6",
            "seed": 7,
        },
        lambda s: 4.0,
        """A 3D map route: a clean white city, a coloured route that draws itself while the camera follows,
a red pin that drops, an ETA card that counts down and a destination card.
{"destination": "Iron Yard Gym", "minutes": 9, "distance": 2.8, "unit": "km",
 "places": ["North Quay", "Botanic Gardens", "Market Hall", "Elm Park", "The Canal"],
 "accent": "#2f7cf6", "seed": 7}
- destination: the place name, at most 26 characters (shorten it plainly if longer).
- minutes and distance: numbers. If only one is given, estimate the other (walking about 12 min per km,
  cycling about 4, driving in town about 2) and say so in "note".
- unit: "km" or "mi" (km unless the user uses miles).
- places: 5 small grey decoration labels, in order: near the start, a park at the far left, a block
  mid-route, a park at the far right, the river. Short names that fit the user's city if they name one
  (they are decoration, not real geography), or "" to hide one.
- accent: a hex colour for the route (#2f7cf6 unless the user names a colour).
- seed: any whole number 1 to 99.
If there is no destination, return {"error": "<one sentence asking where the route goes>"}.""",
    ),
    "breakdown": Quick(
        "breakdown.html",
        True,
        {
            "title": "Phone",
            "subtitle": "Exploded view",
            "labels": [
                ["Cover glass", "toughened · 0.6 mm"],
                ["OLED display", "6.3 in · 120 Hz"],
                ["Titanium frame", "grade 5 · 7.8 mm"],
                ["Logic board", "3 nm chip · 8 GB"],
                ["Battery", "3,582 mAh"],
                ["Back glass", "matte · magnet ring"],
            ],
            "time": "9:41",
            "date": "Saturday 1 November",
            "accent": "#F08A5D",
        },
        lambda s: 4.2,
        """A 3D exploded view of a phone: it comes apart layer by layer and every part gets a leader line and a
label. The shapes are always a phone's six layers; the words are the user's.
{"title": "Phone", "subtitle": "Exploded view",
 "labels": [["Cover glass", "toughened · 0.6 mm"], ["OLED display", "6.3 in · 120 Hz"],
            ["Titanium frame", "grade 5 · 7.8 mm"], ["Logic board", "3 nm chip · 8 GB"],
            ["Battery", "3,582 mAh"], ["Back glass", "matte · magnet ring"]],
 "time": "9:41", "date": "Saturday 1 November", "accent": "#F08A5D"}
- labels: exactly 6, top layer first (cover glass, display, frame, logic board, battery, back), each
  ["Name", "short note"]. Names up to 16 characters, notes up to 22. Notes are facts or one dry joke,
  never slogans. ["", ""] hides one. For a named phone, use its real, well-known specs only; if unsure,
  describe instead of quantifying. For a joke ("my phone, label it like a joke"), keep the part names
  and make the notes the joke.
- title/subtitle: the header (shown in capitals), short.
- time/date: what the lock screen shows.
- accent: a hex colour for the numbers, dots and battery stripe.""",
    ),
    "minimal": Quick(
        "minimalistic-graphics.html",
        False,
        {"lines": ["every step feels small.", "until you look back."], "steps": 5, "light": False},
        lambda s: _minimal_payoff(s) + 1.6,
        """Minimal black-and-white line art: hairline steps rise one by one, a white dot hops up them, and at the
top an orbit draws around it and the second line swaps in.
{"lines": ["every step feels small.", "until you look back."], "steps": 5, "light": false}
- lines: the user's idea as 1 or 2 short lines, a setup and a turn, each under 30 characters,
  lowercase, ending with a full stop. No emojis, no exclamation marks. Keep the user's words when they
  fit.
- steps: 3 to 7 (5 unless the idea names a number).
- light: true for black lines on white, only if the user asks.
The picture is a dot climbing steps, so it suits steady progress (habits, compounding, patience).""",
    ),
}

SPEC_SYSTEM = """You turn one line from a user into the JSON spec of an animation template. Return ONE JSON
object, nothing else: the spec's fields (and an optional "note": one short sentence telling the user
what you assumed), or {"error": "..."} when the line lacks what the spec needs.

The template:

"""


def spec_from_line(
    client: Any, model: str, kind: str, line: str
) -> tuple[dict[str, Any], dict[str, int]]:
    """The user's line → the skill's spec (checked). Raises SpecError with a message for the user."""
    q = QUICK[kind]
    msg = client.messages.create(
        model=model,
        max_tokens=8000,
        output_config={"effort": "low"},
        system=SPEC_SYSTEM + q.doc,
        messages=[{"role": "user", "content": line.strip()[:1500]}],
    )
    text = "".join(getattr(b, "text", "") for b in msg.content)
    usage = {
        "input_tokens": int(getattr(msg.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(msg.usage, "output_tokens", 0) or 0),
    }
    try:
        raw = parse_json(text)
    except ValueError as exc:
        raise SpecError("Could not read that; try saying it in one plain line.") from exc
    if raw.get("error"):
        raise SpecError(str(raw["error"])[:300])
    note = str(raw.pop("note", "") or "")[:200]
    spec = check_spec(kind, raw)
    if note:
        spec["_note"] = note
    return spec, usage


def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return None


def _text(v: Any, n: int) -> str:
    return re.sub(r"\s+", " ", str(v or "")).strip()[:n]


def check_spec(kind: str, raw: dict[str, Any]) -> dict[str, Any]:
    """The skill's defaults filled in and its rules applied; unknown fields dropped."""
    q = QUICK[kind]
    spec = {k: raw.get(k, v) for k, v in q.defaults.items()}
    if kind == "graph":
        got = [_num(x) for x in spec["values"] or []]
        vals = [v for v in got if v is not None and v >= 0]
        if len(vals) < 2 or len(vals) != len(got):
            raise SpecError("A graph needs two or more numbers, all 0 or above, oldest first.")
        if max(vals) <= 0:
            raise SpecError("At least one number must be above 0.")
        spec["values"] = vals[:60]
        labels = [_text(x, 10) for x in spec["labels"] or []]
        spec["labels"] = labels if len(labels) == len(vals) else []
        spec["final"] = _num(spec["final"])
        spec["label"] = _text(spec["label"], 32)
        spec["prefix"], spec["suffix"] = _text(spec["prefix"], 4), _text(spec["suffix"], 8)
        if spec["suffix"] and not spec["suffix"].startswith(("%",)) and spec["suffix"][0].isalpha():
            spec["suffix"] = " " + spec["suffix"]
        spec["decimals"] = max(0, min(2, int(_num(spec["decimals"]) or 0)))
        spec["dark"] = bool(spec["dark"])
    elif kind == "maproute":
        spec["destination"] = _text(spec["destination"], 26)
        mins, dist = _num(spec["minutes"]), _num(spec["distance"])
        if not spec["destination"] or mins is None or dist is None or mins <= 0 or dist <= 0:
            raise SpecError("Say where the route goes and how far or how long it is.")
        spec["minutes"] = round(min(mins, 999))
        spec["distance"] = round(min(dist, 9999), 1)
        spec["unit"] = "mi" if str(spec["unit"]).lower().startswith("mi") else "km"
        spec["places"] = ([_text(p, 18) for p in spec["places"] or []] + [""] * 5)[:5]
        if not HEX.fullmatch(str(spec["accent"])):
            spec["accent"] = q.defaults["accent"]
        spec["seed"] = int(_num(spec["seed"]) or 7) % 100
    elif kind == "breakdown":
        labels = spec["labels"]
        if not isinstance(labels, list) or len(labels) != 6:
            raise SpecError("An exploded view labels exactly six layers.")
        spec["labels"] = [
            [_text(x[0] if x else "", 18), _text(x[1] if len(x) > 1 else "", 24)]
            if isinstance(x, list)
            else ["", ""]
            for x in labels
        ]
        for k, n in (("title", 18), ("subtitle", 24), ("time", 5), ("date", 26)):
            spec[k] = _text(spec[k], n)
        if not HEX.fullmatch(str(spec["accent"])):
            spec["accent"] = q.defaults["accent"]
    elif kind == "minimal":
        lines = [_text(x, 34) for x in (spec["lines"] or []) if _text(x, 34)]
        if not 1 <= len(lines) <= 2:
            raise SpecError("Line art takes one or two short lines of text.")
        spec["lines"] = lines
        steps = int(_num(spec["steps"]) or 5)
        spec["steps"] = max(3, min(7, steps))
        spec["light"] = bool(spec["light"])
    return spec


def duration(kind: str, spec: dict[str, Any]) -> float:
    return round(QUICK[kind].duration(spec) + HOLD, 3)


def _link(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


def build_project(
    kind: str,
    spec: dict[str, Any],
    dest: Path,
    gsap_js: Path | None,
    three_dir: Path | None,
) -> float:
    """Writes the HyperFrames project (index.html with the spec, fonts, GSAP, three.js); returns its
    length in seconds."""
    q = QUICK[kind]
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    dur = duration(kind, spec)
    clean = {k: v for k, v in spec.items() if not k.startswith("_")}
    data = json.dumps(clean, ensure_ascii=False).replace("</", "<\\/")
    html = (KIT / "templates" / q.template).read_text(encoding="utf-8")
    html = html.replace("__SPEC__", data).replace("__DURATION__", f"{dur:.3f}")
    (dest / "index.html").write_text(html, encoding="utf-8")
    for f in (KIT / "fonts").glob("*.woff2"):
        _link(f, dest / "fonts" / f.name)
    if "vendor/gsap.min.js" in html:
        if not gsap_js or not Path(gsap_js).exists():
            raise RuntimeError("GSAP is not installed for the motion templates")
        _link(Path(gsap_js), dest / "vendor" / "gsap.min.js")
    if q.three:
        t = Path(three_dir) if three_dir else None
        if not t or not (t / "build" / "three.module.js").exists():
            raise RuntimeError("three.js is not installed for the 3D motion templates")
        _link(t / "build" / "three.module.js", dest / "vendor" / "three" / "three.module.js")
        for rel in ("environments/RoomEnvironment.js",):
            _link(t / "examples" / "jsm" / rel, dest / "vendor" / "three" / "addons" / rel)
    return dur
