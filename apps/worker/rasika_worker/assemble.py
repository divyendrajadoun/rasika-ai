"""Many clips → one take: hear every clip, put them in the order of what is said, drop the weaker
takes of the same line, trim the dead air around each, and join what is left into one video.

The joined video then runs the normal chain (probe → transcribe → clean cut → plan → render), so
the ums, repeats and pauses *inside* the clips are cut the way a single take is, and the editor
works on it word by word.

How the order is chosen, in this order of preference:

- the user's own order (the re-assemble panel): exactly what they picked;
- a script: each clip is matched to the script lines it says; clips follow the script, and when
  two clips say the same lines the closer (then the later) take stays;
- no script: one Claude call reads the clips and orders them as a story, dropping earlier takes;
- no key, or a bad answer: the recording order, with earlier takes of a line dropped by text match.

`arrange_*` are pure (clip texts in, decisions out); `render` cuts and joins with ffmpeg.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

from . import media
from .cleancut import FILLERS, _norm

#: speech keeps this much air before its first word and after its last
LEAD, TAIL = 0.25, 0.45
#: a clip matched to the script below this is not one of its lines
SCRIPT_MIN = 0.35
#: two clips this alike are takes of the same line
SAME_TAKE = 0.6


@dataclass
class Clip:
    id: str
    name: str
    words: list[dict[str, Any]]
    duration: float

    @property
    def tokens(self) -> list[str]:
        toks = (_norm(str(w.get("w", ""))) for w in self.words)
        return [t for t in toks if t and t not in FILLERS]

    @property
    def text(self) -> str:
        return " ".join(str(w.get("w", "")).strip() for w in self.words).strip()


@dataclass
class Decision:
    id: str
    name: str
    keep: bool
    why: str = ""
    start: float = 0.0
    end: float = 0.0
    duration: float = 0.0
    text: str = ""
    script_line: int | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def speech_span(words: list[dict[str, Any]], duration: float) -> tuple[float, float]:
    """The part of a clip that has speech in it, with a breath either side; a clip with no
    speech (a cutaway) stays whole."""
    spoken = [w for w in words if _norm(str(w.get("w", ""))) not in FILLERS]
    if not spoken:
        return 0.0, round(duration, 3)
    a = max(0.0, float(spoken[0]["t"]) - LEAD)
    b = min(duration, float(spoken[-1]["end"]) + TAIL)
    return round(a, 3), round(max(b, a + 0.2), 3)


def _decision(c: Clip, keep: bool, why: str = "", line: int | None = None) -> Decision:
    a, b = speech_span(c.words, c.duration)
    text = c.text
    return Decision(
        c.id,
        c.name,
        keep,
        why,
        a,
        b,
        round(c.duration, 3),
        text[:160] + ("…" if len(text) > 160 else ""),
        line,
    )


def _alike(x: list[str], y: list[str]) -> bool:
    """y says what x says: the same line again, or x was a false start of it."""
    if len(x) < 2 or len(y) < 2:
        return False
    prefix = 0
    for p, q in zip(x, y, strict=False):
        if p != q:
            break
        prefix += 1
    started_over = prefix >= 3 and prefix / len(x) >= 0.6
    return started_over or SequenceMatcher(None, x, y, autojunk=False).ratio() >= SAME_TAKE


def arrange_recorded(clips: list[Clip]) -> list[Decision]:
    """No script and no model: the recording order; a clip said again later is an earlier take."""
    out: list[Decision] = []
    spoken = [c for c in clips if c.tokens]
    for i, c in enumerate(clips):
        toks = c.tokens
        later = next((d for d in clips[i + 1 :] if _alike(toks, d.tokens)), None)
        if later:
            out.append(_decision(c, False, f"earlier take of {later.name}"))
        elif toks and len(toks) < 3 and len(spoken) > 1:
            out.append(_decision(c, False, "too short to use"))
        else:
            out.append(_decision(c, True))
    return out


def script_lines(script: str) -> list[str]:
    parts = re.split(r"(?<=[.!?।])\s+|\n+", script.strip())
    return [p.strip() for p in parts if p and p.strip()]


def match_script(
    tokens: list[str], lines: list[list[str]], max_span: int = 6
) -> tuple[float, int, int]:
    """The run of script lines this clip says: (similarity, first line, last line)."""
    best = (0.0, -1, -1)
    if not tokens:
        return best
    for i in range(len(lines)):
        joined: list[str] = []
        for j in range(i, min(len(lines), i + max_span)):
            joined = joined + lines[j]
            if not joined:
                continue
            r = SequenceMatcher(None, tokens, joined, autojunk=False).ratio()
            if r > best[0] + 1e-9:
                best = (r, i, j)
            if len(joined) > 2 * len(tokens) + 4:
                break
    return best


def arrange_by_script(clips: list[Clip], script: str) -> list[Decision]:
    """Clips in the order of the script; of two takes of the same lines the closer one stays
    (the later one when they are as close)."""
    lines = [
        [t for t in (_norm(x) for x in ln.split()) if t and t not in FILLERS]
        for ln in script_lines(script)
    ]
    if not any(lines):
        return arrange_recorded(clips)
    out: dict[str, Decision] = {}
    candidates: list[tuple[Clip, int, float, int, int]] = []
    for n, c in enumerate(clips):
        r, i, j = match_script(c.tokens, lines)
        if not c.tokens:
            out[c.id] = _decision(c, False, "no speech")
        elif r < SCRIPT_MIN:
            out[c.id] = _decision(c, False, "not in the script")
        else:
            candidates.append((c, n, r, i, j))
    # the best takes claim their lines first; a weaker take of the same lines goes
    taken: list[tuple[int, int, Clip]] = []
    for c, _n, _r, i, j in sorted(candidates, key=lambda k: (-round(k[2], 2), -k[1])):
        rival = next(
            (
                o
                for a, b, o in taken
                if min(b, j) - max(a, i) + 1 >= 0.5 * min(b - a + 1, j - i + 1)
            ),
            None,
        )
        if rival:
            out[c.id] = _decision(c, False, f"another take of {rival.name}", i)
        else:
            taken.append((i, j, c))
            out[c.id] = _decision(c, True, "", i)
    order = {c.id: n for n, c in enumerate(clips)}
    kept = sorted(
        (d for d in out.values() if d.keep), key=lambda d: (d.script_line or 0, order[d.id])
    )
    dropped = sorted((d for d in out.values() if not d.keep), key=lambda d: order[d.id])
    return kept + dropped


ORDER_SYSTEM = (
    "You assemble a short talking video from the clips a person recorded. Each clip is listed with "
    "a number, its length and what is said in it. Put the clips in the order that tells the story "
    "best: the opening line first, the closing line or call to action last, steps in their natural "
    "order. When two clips say the same thing (a retake), keep only the most complete and fluent "
    "one (the later take when they are equally good). Drop a clip that is only a false start, a "
    "test or chatter to the camera. Keep a clip with no speech only where a cutaway helps. Never "
    "invent clips. Reply with JSON only: "
    '{"order": [clip numbers to keep, in order], "dropped": [{"clip": n, "why": "a few words"}]}'
)


def arrange_with_model(client: Any, model: str, clips: list[Clip]) -> list[Decision] | None:
    """One Claude call; None when the answer is unusable (the caller falls back)."""
    listing = "\n".join(
        f"{n + 1} ({c.duration:.1f} s): " + (c.text[:700] or "[no speech]")
        for n, c in enumerate(clips)
    )
    resp = client.messages.create(
        model=model,
        max_tokens=3000,
        system=ORDER_SYSTEM,
        messages=[{"role": "user", "content": listing}],
    )
    raw = "".join(getattr(b, "text", "") for b in resp.content)
    return parse_model_order(raw, clips)


def parse_model_order(raw: str, clips: list[Clip]) -> list[Decision] | None:
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group())
        order = [int(x) - 1 for x in data.get("order", [])]
        dropped = {
            int(d["clip"]) - 1: str(d.get("why") or "dropped")[:80] for d in data.get("dropped", [])
        }
    except (ValueError, TypeError, KeyError, AttributeError):
        return None
    n = len(clips)
    if not order or len(set(order)) != len(order) or any(not 0 <= i < n for i in order):
        return None
    out = [_decision(clips[i], True) for i in order]
    out += [
        _decision(clips[i], False, dropped.get(i, "dropped")) for i in range(n) if i not in order
    ]
    return out


def arrange_as_picked(clips: list[Clip], order: list[str]) -> list[Decision]:
    """The user's own order: these clip ids, in this order; every other clip is left out."""
    by_id = {c.id: c for c in clips}
    seen: list[str] = []
    for i in order:
        if i in by_id and i not in seen:
            seen.append(i)
    out = [_decision(by_id[i], True) for i in seen]
    out += [_decision(c, False, "left out by you") for c in clips if c.id not in seen]
    return out


def kept_seconds(decisions: list[Decision]) -> float:
    return round(sum(d.end - d.start for d in decisions if d.keep), 3)


def render(
    ffmpeg: str, ffprobe: str, sources: dict[str, Path], decisions: list[Decision], dest: Path
) -> None:
    """Each kept clip trimmed to its speech and normalised (1080×1920, 30 fps, 48 kHz stereo), then
    joined; the edges get a 20 ms audio fade so the joins never click."""
    parts: list[Path] = []
    for k, d in enumerate(x for x in decisions if x.keep):
        src = sources[d.id]
        info = media.probe(ffprobe, src)
        length = max(0.2, d.end - d.start)
        seg = dest.parent / f"seg_{k:02d}.mp4"
        cmd = [ffmpeg, "-v", "error", "-y", "-ss", f"{d.start:.3f}", "-t", f"{length:.3f}"]
        cmd += ["-i", str(src)]
        if not info.has_audio:  # a silent clip gets silence, so every part has the same streams
            cmd += ["-f", "lavfi", "-t", f"{length:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        fade = f"afade=t=in:d=0.02,afade=t=out:st={max(0.0, length - 0.02):.3f}:d=0.02"
        cmd += [
            "-map", "0:v:0", "-map", "0:a:0" if info.has_audio else "1:a:0",
            "-vf", media.VF_FIT,
            "-af", f"aresample=48000,{fade}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-shortest", "-movflags", "+faststart", str(seg),
        ]  # fmt: skip
        media.run(cmd)
        parts.append(seg)
    if not parts:
        raise ValueError("no clip kept")
    if len(parts) == 1:
        parts[0].replace(dest)
        return
    media.concat(ffmpeg, parts, dest)
    for p in parts:
        p.unlink(missing_ok=True)
