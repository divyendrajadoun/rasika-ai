"""Reference matching: measure a reel the user loves, then write a style for *their* take in it.

Modelled on reelmimic's analyse → STYLE.md → plan loop, cut down to what Rasika's engine can
honour: cut cadence and shot lengths (pace), how shots arrive and move (camera / enter / exit),
and the look (palette, type, texture, caption treatment). Everything is measured locally with
ffmpeg + Pillow; one Claude vision call turns the numbers and eight stills into style tokens in
Rasika's own vocabulary, validated with the generated pydantic models. Nothing is copied from the
reference — its footage is never reused; the owner's words stay the owner's.
"""

from __future__ import annotations

import json
import re
import statistics
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import structlog

from rasika_worker import media
from rasika_worker.plan import StyleTokens

log = structlog.get_logger()

#: how much of the reference is honoured
FIDELITY = ("pace", "camera", "look")
#: fonts the engine bundles (packages/engine/src/css.ts FONTS) — the only ones a style may name
FONTS = [
    "Anton",
    "Inter",
    "Instrument Serif",
    "Montserrat",
    "Bebas Neue",
    "Playfair Display",
    "Playfair Display Roman",
    "Archivo Black",
    "Caveat",
    "Bangers",
    "Poppins",
    "DM Serif Display",
    "DM Serif Display Italic",
    "Kalam",
    "Permanent Marker",
    "JetBrains Mono",
    "Space Grotesk",
    "Oswald",
    "Jost",
    "Press Start 2P",
    "Fraunces",
    "IBM Plex Sans",
    "IBM Plex Mono",
]


@dataclass
class ReferenceReport:
    duration_sec: float
    cuts: list[float]
    shot_lengths: list[float]
    mean_shot_sec: float
    median_shot_sec: float
    cuts_per_min: float
    brightness: float  # 0..1 mean luma over the stills
    dark_ratio: float  # share of near-black pixels
    colourfulness: float  # 0..1 mean saturation
    dominant: list[str]  # hex, most to least frequent
    stills: list[str] = field(default_factory=list)
    is_vertical: bool = True

    def as_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["cuts"] = [round(c, 2) for c in self.cuts[:60]]
        d["shot_lengths"] = [round(s, 2) for s in self.shot_lengths[:60]]
        return d


_PTS = re.compile(r"pts_time:\s*([0-9.]+)")


def detect_cuts(ffmpeg: str, src: Path, threshold: float = 0.3) -> list[float]:
    """Scene-change timestamps (ffmpeg `select=gt(scene,t)` + showinfo)."""
    r = media.run(
        [
            ffmpeg,
            "-hide_banner",
            "-i",
            str(src),
            "-vf",
            f"select='gt(scene,{threshold})',showinfo",
            "-an",
            "-f",
            "null",
            "-",
        ]
    )
    return parse_cuts(r.stderr)


def parse_cuts(showinfo_stderr: str) -> list[float]:
    out: list[float] = []
    for m in _PTS.finditer(showinfo_stderr):
        t = float(m.group(1))
        if not out or t - out[-1] > 0.2:
            out.append(t)
    return out


def shot_stats(cuts: list[float], duration: float) -> tuple[list[float], float, float, float]:
    bounds = [0.0, *[c for c in cuts if 0 < c < duration], duration]
    lengths = [b - a for a, b in zip(bounds, bounds[1:], strict=False) if b - a > 0.05]
    if not lengths:
        lengths = [duration]
    mean = sum(lengths) / len(lengths)
    med = statistics.median(lengths)
    cpm = len(cuts) / duration * 60 if duration > 0 else 0.0
    return lengths, mean, med, cpm


def colour_stats(stills: list[Path]) -> tuple[float, float, float, list[str]]:
    """Mean luma, dark share, saturation and the dominant colours across the stills (Pillow)."""
    from PIL import Image

    lum: list[float] = []
    dark: list[float] = []
    sat: list[float] = []
    counts: dict[str, int] = {}
    for p in stills:
        im = Image.open(p).convert("RGB").resize((96, 170))
        px = list(im.getdata())
        if not px:
            continue
        ls = [(0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 for r, g, b in px]
        lum.append(sum(ls) / len(ls))
        dark.append(sum(1 for v in ls if v < 0.12) / len(ls))
        sat.append(sum((max(c) - min(c)) / (max(c) or 1) for c in px) / len(px))
        q = im.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette() or []
        for n, idx in q.getcolors() or []:
            if not isinstance(idx, int):
                continue
            r, g, b = pal[idx * 3 : idx * 3 + 3]
            key = f"#{r:02x}{g:02x}{b:02x}"
            counts[key] = counts.get(key, 0) + int(n)
    dominant = [h for h, _ in sorted(counts.items(), key=lambda kv: -kv[1])[:6]]
    n = max(1, len(lum))
    return sum(lum) / n, sum(dark) / n, sum(sat) / n, dominant


def analyse(ffmpeg: str, ffprobe: str, src: Path, work: Path, n_stills: int = 8) -> ReferenceReport:
    info = media.probe(ffprobe, src)
    duration = float(info.duration_sec)
    cuts = detect_cuts(ffmpeg, src)
    lengths, mean, med, cpm = shot_stats(cuts, duration)
    work.mkdir(parents=True, exist_ok=True)
    stills: list[Path] = []
    for i in range(n_stills):
        t = duration * (i + 0.5) / n_stills
        stills.append(media.still(ffmpeg, src, t, work / f"ref_{i:02d}.jpg", width=360))
    bright, dark, sat, dominant = colour_stats(stills)
    rep = ReferenceReport(
        duration_sec=round(duration, 2),
        cuts=cuts,
        shot_lengths=lengths,
        mean_shot_sec=round(mean, 2),
        median_shot_sec=round(med, 2),
        cuts_per_min=round(cpm, 1),
        brightness=round(bright, 3),
        dark_ratio=round(dark, 3),
        colourfulness=round(sat, 3),
        dominant=dominant,
        stills=[str(p) for p in stills],
        is_vertical=bool(info.is_vertical),
    )
    log.info("reference_analysed", **{k: v for k, v in rep.as_dict().items() if k != "stills"})
    return rep


# ── the one Claude call ──

SYSTEM = """You are the style director of Rasika, a reel editor. You will see numbers measured from a
reference reel and eight stills from it. Write a STYLE for the user's own talking-head reel that
borrows the reference's *technique* — its cut cadence, how shots arrive and move, its palette,
type and texture — never its footage, words, characters or logos.

Answer with ONE JSON object and nothing else, shaped like the `preset` you are given (same keys),
changing only what the fidelity allows:
- pace: rewrite `motion.direction` only — a markdown brief (≤ 1200 chars) that states the measured
  mean/median shot length and cuts per minute, and tells the planner how often a new visual must
  land, when to cut to `zoom`/`card`/`pip`, where the peaks are, and what to avoid. Keep every
  other field exactly as the preset has it.
- camera: pace + `motion.enter`, `motion.exit`, `motion.easing`, `motion.speed`, `motion.camera`,
  `motion.sfxKit` chosen to match how the reference moves (hard cuts → `cut`, punchy → `whip`/`push`),
  and `motion.framing` read from the stills: `full` when the speaker fills the frame edge to edge in
  (nearly) every still, `framed` when the footage mostly sits in a window or card on a coloured
  stage, `any` when it mixes both. `motion.framing` MUST agree with what `motion.direction` says
  about framing (a direction that says the speaker is edge to edge means `framing: "full"`).
  In `motion.direction`, also describe the TYPE TREATMENT precisely enough to rebuild: how big the
  key word is against the frame width (e.g. "one word at about 40% of the width, condensed red
  caps"), the second face used for asides, where the type sits relative to the person, and the
  stickers, cut-outs or cards that recur.
- look: camera + `palette`, `fonts` (ONLY from the allowed list), `grain`, `captionStyle`,
  `captionSize`, `captionAccent`, `motion.texture`, `motion.family`, `motion.caseStyle`, `name`,
  `tagline`, `pace`, `endCardShape`, `preferredElements`, `motion.avoidElements`. At this level the
  user picked no style: the given preset is only a neutral template, so replace every visual field
  with what the reference shows; keep nothing from the template that the stills contradict.
Rules: `palette.stage` is the colour behind framed shots; `mar` the light wall tone; `ter` the
accent; `gold` the highlight; `goldd` a deeper highlight; `iv` light text; `ink` darkest. Keep
contrast ≥ 4.5:1 between `iv`/`ink` and the stage. `fonts.devanagari` stays as the preset has it.
Enumerations: family editorial|kinetic|whiteboard|chalk|hype|launch|collage|blocks|beat; enter
rise|pop|slam|slide|fade|draw|blur|letters|mask|type; exit lift|dive|cut|wipe|fade; easing
spring|snap|smooth|soft|steps; camera glide|cut|whip|still|push; sfxKit pop|click|marker|chalk|
hype|cinematic|none; texture none|paper|board|grid|dots|vignette|gradient|halftone|scan|lines|grain;
captionStyle one-word|phrase|karaoke|box|clean|off. `id` must stay as given."""


def propose_style(
    client: Any,
    model: str,
    report: ReferenceReport,
    preset: dict[str, Any],
    fidelity: str,
    brief: str | None = None,
) -> tuple[dict[str, Any], dict[str, int]]:
    """Ask Claude for the matched style; returns (validated tokens, usage)."""
    from rasika_worker.planner import _b64_image

    fidelity = fidelity if fidelity in FIDELITY else "camera"
    base = {k: v for k, v in preset.items()}
    base["id"] = f"{preset.get('id', 'custom')}-ref"
    user: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": "## Fidelity\n\n"
            + fidelity
            + "\n\n## Measured from the reference\n\n"
            + json.dumps({k: v for k, v in report.as_dict().items() if k != "stills"})
            + "\n\n## Allowed fonts\n\n"
            + ", ".join(FONTS)
            + "\n\n## The preset to start from\n\n"
            + json.dumps(base, ensure_ascii=False)
            + ("\n\n## What the user said about the reference\n\n" + brief if brief else ""),
        },
        {"type": "text", "text": f"## Stills ({len(report.stills)}, evenly spaced)"},
    ]
    for p in report.stills[:8]:
        user.append(_b64_image(Path(p)))
    resp = client.messages.create(
        model=model,
        max_tokens=6000,
        system=SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    usage = {
        "input_tokens": int(getattr(resp.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(resp.usage, "output_tokens", 0) or 0),
    }
    tokens = merge_by_fidelity(preset, parse_json(text), fidelity)
    tokens["id"] = base["id"]
    valid = StyleTokens.model_validate(tokens).model_dump(mode="json", by_alias=True)
    valid["fonts"]["devanagari"] = preset.get("fonts", {}).get(
        "devanagari", valid["fonts"]["devanagari"]
    )
    return valid, usage


def parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start = text.find("{")
    if start < 0:
        raise ValueError("the style director returned no JSON")
    # read exactly one object: the model sometimes adds a note (with braces) after it
    out, _ = json.JSONDecoder().raw_decode(text[start:])
    if not isinstance(out, dict):
        raise ValueError("the style director returned a non-object")
    return out


def merge_by_fidelity(
    preset: dict[str, Any], proposed: dict[str, Any], fidelity: str
) -> dict[str, Any]:
    """Only the fields the fidelity level allows may change; everything else is the preset's."""
    out: dict[str, Any] = json.loads(json.dumps(preset))
    pm = dict(proposed.get("motion") or {})
    motion = dict(out.get("motion") or {})
    if "direction" in pm:
        motion["direction"] = str(pm["direction"])[:4000]
    if fidelity in ("camera", "look"):
        for k in ("enter", "exit", "easing", "speed", "camera", "sfxKit", "framing"):
            if k in pm:
                motion[k] = pm[k]
    if fidelity == "look":
        for k in ("texture", "family", "caseStyle", "avoidElements"):
            if k in pm:
                motion[k] = pm[k]
        for k in (
            "palette",
            "grain",
            "captionStyle",
            "captionSize",
            "captionAccent",
            "name",
            "tagline",
            "pace",
            "endCardShape",
            "preferredElements",
        ):
            if k in proposed:
                out[k] = proposed[k]
        fonts = dict(out.get("fonts") or {})
        for k, v in dict(proposed.get("fonts") or {}).items():
            if k != "devanagari" and v in FONTS:
                fonts[k] = v
        out["fonts"] = fonts
    out["motion"] = motion
    return out
