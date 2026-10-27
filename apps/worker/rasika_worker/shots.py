"""One messy video → shots: a video already joined in VN, CapCut or InShot still has its bad takes,
false starts, test shots and cutaways that add nothing. Here it is cut back into the shots it was
joined from, each shot is looked at, and the many-clips path (assemble.py) takes over: the shots
are ordered, the earlier takes and unusable shots are left out, the rest is joined and clean-cut.

- `find_cuts`: where the video was joined. ffmpeg's scene score of every frame of a small copy; a
  strong change is a cut, a weaker one (a jump cut between two takes in the same framing) only
  where it is a sudden spike and no word is being said, so a gesture never splits a shot;
- `segments`: cuts → shots no shorter than `MIN_SHOT`, at most `MAX_SHOTS` (the weakest go first);
- `look`: a few frames of each shot measured (dark, black, blurry, shaky) and one still kept for
  the model;
- `review`: one Claude call sees each shot's still, its words and its measurements, and orders the
  shots that tell the story, leaving out the rest with a reason;
- `drop_unusable`: without the model, the measurements alone leave out black and dark empty shots.

`find_cuts` and `look` run ffmpeg; `segments`, `split_words`, `hints` and `drop_unusable` are pure.
"""

from __future__ import annotations

import base64
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from . import assemble, media

#: a scene change this strong is a cut wherever it falls
HARD = 0.3
#: from here up to HARD, a cut only where it stands out from the frames around it (SPIKE times
#: their median, over NEAR frames either side) and no word is being said: a jump cut between two
#: takes in the same framing changes the picture far less than a cut, but suddenly
SOFT = 0.06
SPIKE = 3.0
NEAR = 15
#: a spike this strong counts even over a word: the transcript's word times are off by a few
#: tenths of a second, and a pause between two takes is often given to the word before it
MID = 0.12
MIN_SHOT = 0.8
MAX_SHOTS = 30
#: frames measured per shot, and their size (grey)
SAMPLES, SW, SH = 8, 180, 320


@dataclass
class Look:
    """What a shot looks like: mean brightness 0–255, sharpness (variance of the Laplacian),
    camera movement (median shift between samples, px of a 180-wide frame), and the still."""

    bright: float
    sharp: float
    shift: float
    still: str = ""
    flags: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "bright": round(self.bright, 1),
            "sharp": round(self.sharp, 1),
            "shift": round(self.shift, 2),
            "flags": self.flags,
        }


def scene_scores(ffmpeg: str, src: Path) -> list[tuple[float, float]]:
    """(time, scene score) of every frame."""
    p = subprocess.run(
        [ffmpeg, "-hide_banner", "-nostats", "-i", str(src), "-an", "-vf",
         "scale=144:256,select='gte(scene,0)',metadata=print:key=lavfi.scene_score",
         "-f", "null", "-"],
        capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=900,
    )  # fmt: skip
    if p.returncode != 0:
        raise media.MediaError(f"scene detection failed: {p.stderr[-400:]}")
    out: list[tuple[float, float]] = []
    t: float | None = None
    for line in p.stderr.splitlines():
        m = re.search(r"pts_time:([\d.]+)", line)
        if m:
            t = float(m.group(1))
            continue
        m = re.search(r"lavfi\.scene_score=([\d.]+)", line)
        if m and t is not None:
            out.append((t, float(m.group(1))))
            t = None
    return out


def _in_word(t: float, words: list[dict[str, Any]]) -> bool:
    return any(float(w["t"]) + 0.03 < t < float(w["end"]) - 0.03 for w in words)


def find_cuts(
    scores: list[tuple[float, float]], words: list[dict[str, Any]]
) -> list[tuple[float, float]]:
    """(time, strength) of the joins: every strong change, and a weaker one that is a sudden spike
    between words."""
    vals = np.array([s for _, s in scores], dtype=float)
    out = []
    for i, (t, s) in enumerate(scores):
        if s >= HARD:
            out.append((t, s))
        elif s >= MID or (s >= SOFT and not _in_word(t, words)):
            near = np.concatenate([vals[max(0, i - NEAR) : i], vals[i + 1 : i + 1 + NEAR]])
            if not len(near) or s >= SPIKE * max(float(np.median(near)), 0.005):
                out.append((t, s))
    return out


def segments(
    cuts: list[tuple[float, float]], duration: float, min_len: float = MIN_SHOT,
    max_shots: int = MAX_SHOTS,
) -> list[tuple[float, float]]:
    """Cuts → shots. Of cuts closer than `min_len` (a transition, a flash) the strongest stays; a
    cut that would leave a shot under `min_len` at either end goes; then the weakest cuts go until
    there are at most `max_shots` shots."""
    kept: list[tuple[float, float]] = []
    for t, s in sorted(cuts):
        if t < min_len or t > duration - min_len:
            continue
        if kept and t - kept[-1][0] < min_len:
            if s > kept[-1][1]:
                kept[-1] = (t, s)
            continue
        kept.append((t, s))
    while len(kept) + 1 > max_shots:
        kept.remove(min(kept, key=lambda c: c[1]))
    edges = [0.0, *(round(t, 3) for t, _ in kept), round(duration, 3)]
    return [(a, b) for a, b in zip(edges, edges[1:], strict=False) if b - a > 0.05]


def split_words(
    words: list[dict[str, Any]], shots: list[tuple[float, float]]
) -> list[list[dict[str, Any]]]:
    """Each word goes to the shot that holds its middle, its times made relative to that shot."""
    out: list[list[dict[str, Any]]] = [[] for _ in shots]
    for w in words:
        mid = (float(w["t"]) + float(w["end"])) / 2
        for i, (a, b) in enumerate(shots):
            if a <= mid < b or (i == len(shots) - 1 and mid >= b):
                ww = dict(w)
                ww["t"] = round(max(0.0, float(w["t"]) - a), 3)
                ww["end"] = round(min(b - a, float(w["end"]) - a), 3)
                out[i].append(ww)
                break
    return out


def _frames(ffmpeg: str, src: Path, start: float, length: float) -> np.ndarray:
    fps = SAMPLES / max(length, 0.25)
    p = subprocess.run(
        [ffmpeg, "-v", "error", "-ss", f"{start:.3f}", "-t", f"{length:.3f}", "-i", str(src),
         "-an", "-vf", f"fps={fps:.4f},scale={SW}:{SH},format=gray", "-f", "rawvideo", "-"],
        capture_output=True, timeout=300,
    )  # fmt: skip
    n = len(p.stdout) // (SW * SH)
    if p.returncode != 0 or n == 0:
        return np.zeros((0, SH, SW), np.uint8)
    return np.frombuffer(p.stdout[: n * SW * SH], np.uint8).reshape(n, SH, SW)


def look(ffmpeg: str, src: Path, start: float, end: float, still: Path) -> Look:
    import cv2

    frames = _frames(ffmpeg, src, start, end - start)
    if not len(frames):
        return Look(0.0, 0.0, 0.0)
    bright = float(frames.mean())
    sharp = float(np.median([cv2.Laplacian(f, cv2.CV_64F).var() for f in frames]))
    shifts = []
    for a, b in zip(frames, frames[1:], strict=False):
        (dx, dy), _ = cv2.phaseCorrelate(a.astype(np.float32), b.astype(np.float32))
        shifts.append(float(np.hypot(dx, dy)))
    shift = float(np.median(shifts)) if shifts else 0.0
    mid = start + (end - start) / 2
    try:
        media.run(
            [ffmpeg, "-v", "error", "-y", "-ss", f"{mid:.3f}", "-i", str(src), "-frames:v", "1",
             "-vf", "scale=360:640:force_original_aspect_ratio=decrease", "-q:v", "5", str(still)]
        )  # fmt: skip
    except media.MediaError:
        still = Path()
    return Look(bright, sharp, shift, str(still) if still.name else "")


def hints(looks: list[Look]) -> None:
    """Flags measured against the other shots of the same video (a phone's own sharpness varies)."""
    sharp = float(np.median([x.sharp for x in looks])) if looks else 0.0
    for x in looks:
        x.flags = []
        if x.bright < 12:
            x.flags.append("black")
        elif x.bright < 32:
            x.flags.append("very dark")
        if "black" in x.flags:
            continue  # nothing else to see in it
        if sharp and x.sharp < 0.35 * sharp:
            x.flags.append("blurry")
        if x.shift > 6:
            x.flags.append("shaky")


def drop_unusable(
    decisions: list[assemble.Decision], looks: dict[str, Look], clips: dict[str, assemble.Clip]
) -> list[assemble.Decision]:
    """Without the model: a black shot, or a dark or very short one with nothing said, goes."""
    out = []
    for d in decisions:
        x, c = looks.get(d.id), clips.get(d.id)
        silent = not (c and c.tokens)
        if d.keep and x and "black" in x.flags:
            d.keep, d.why = False, "black frames"
        elif d.keep and x and silent and "very dark" in x.flags:
            d.keep, d.why = False, "too dark, nothing said"
        elif d.keep and c and silent and c.duration < 1.0:
            d.keep, d.why = False, "a flash, nothing said"
        out.append(d)
    return [d for d in out if d.keep] + [d for d in out if not d.keep]


REVIEW_SYSTEM = (
    "You are the editor of a short vertical video. The person filmed it and joined the shots in a "
    "phone app without cleaning it up. You get every shot: its number, length, what is said in it, "
    "what was measured in its picture, and one still from its middle. Decide which shots make the "
    "video and in what order.\n"
    "- Keep the shots that tell the story: the hook first, steps in their natural order, the "
    "closing line or call to action last. Keep the order the person joined them in unless it is "
    "clearly wrong.\n"
    "- When two shots say the same thing (a retake), keep only the most complete and fluent one "
    "(the later one when they are equally good).\n"
    "- Leave out: false starts, a shot that stops mid-sentence and is said again later, tests "
    "('is this recording?'), chatter to someone off camera, a shot whose picture is unusable "
    "(black, lens covered, out of focus, pointed at the floor, badly shaken), and a shot with no "
    "speech that shows nothing that belongs to the story.\n"
    "- Keep a shot with no speech when it shows something the speech is about (the product, the "
    "place, the result): it becomes a cutaway.\n"
    "- When a script is given, follow its order and leave out shots that are not in it.\n"
    "Never invent shots. Reply with JSON only: "
    '{"order": [shot numbers to keep, in order], "dropped": [{"clip": n, "why": "a few words"}]}'
)


def review(
    client: Any,
    model: str,
    clips: list[assemble.Clip],
    looks: dict[str, Look],
    script: str = "",
    max_images: int = MAX_SHOTS,
) -> list[assemble.Decision] | None:
    """One Claude call with a still of each shot; None when the answer is unusable."""
    content: list[dict[str, Any]] = []
    if script.strip():
        content.append({"type": "text", "text": f"The script:\n{script.strip()[:4000]}"})
    for n, c in enumerate(clips):
        x = looks.get(c.id)
        measured = ", ".join(x.flags) if x and x.flags else "looks fine"
        content.append(
            {
                "type": "text",
                "text": f"Shot {n + 1} ({c.duration:.1f} s; picture: {measured}): "
                + (c.text[:600] or "[no speech]"),
            }
        )
        if x and x.still and n < max_images and Path(x.still).is_file():
            content.append(
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64.b64encode(Path(x.still).read_bytes()).decode(),
                    },
                }
            )
    content.append({"type": "text", "text": "Reply with the JSON now."})
    resp = client.messages.create(
        model=model,
        max_tokens=3000,
        system=REVIEW_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    raw = "".join(getattr(b, "text", "") for b in resp.content)
    return assemble.parse_model_order(raw, clips)
