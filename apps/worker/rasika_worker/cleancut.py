"""Clean cut: take the ums, stutters, repeats and dead air out of a talking take.

The cutting rules shared by chengfeng-cut, claude-youtube-editor's /clean-cut, paper-cut-video's
speech edit and Hypit's pause trims, done from the word-level transcript:

- filler words (um, uh, erm …; 嗯 呃; मतलब is NOT a filler: only sounds that carry no meaning);
- a word or two-word phrase said twice in a row ("the the", "I think I think"): the first goes;
- pauses: every word keeps 80 ms before it and 150 ms after; a gap longer than `max_gap` between
  kept words closes to `keep_gap` (a breath, not a jump).

`plan_cuts` is pure (words in, keep-ranges and a ledger out); `cut` renders the keep-ranges with
ffmpeg. The pipeline then runs the cut through probe and transcription again, so every word time
the planner sees is measured on the cut itself.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import media

FILLERS = {
    "um",
    "umm",
    "uh",
    "uhh",
    "uhm",
    "erm",
    "er",
    "ah",
    "ahh",
    "hmm",
    "hm",
    "mm",
    "mhm",
    "嗯",
    "呃",
    "额",
    "啊",
}
PRE, POST = 0.08, 0.15


@dataclass
class CutPlan:
    keep: list[tuple[float, float]]
    removed: list[dict[str, Any]] = field(default_factory=list)
    duration_in: float = 0.0
    moved: bool = False  # the hook was moved to the front

    @property
    def duration_out(self) -> float:
        return round(sum(b - a for a, b in self.keep), 3)

    @property
    def removed_sec(self) -> float:
        return round(self.duration_in - self.duration_out, 3)


def _norm(w: str) -> str:
    return re.sub(r"[^\w']+", "", w.lower())


def sentences(words: list[dict[str, Any]]) -> list[tuple[int, int]]:
    """Word-index ranges of the spoken sentences (split on . ! ? and long pauses)."""
    out: list[tuple[int, int]] = []
    start = 0
    for i, w in enumerate(words):
        end_here = str(w.get("w", "")).rstrip().endswith((".", "!", "?", "。", "！", "？"))
        gap = i + 1 < len(words) and float(words[i + 1]["t"]) - float(w["end"]) > 0.9
        if end_here or gap or i == len(words) - 1:
            out.append((start, i))
            start = i + 1
    return out


def pick_hook(client: Any, model: str, words: list[dict[str, Any]]) -> tuple[int, int] | None:
    """The strongest line of the take for the first two seconds (one Claude call), as a word range."""
    sents = sentences(words)
    if len(sents) < 3:
        return None
    listing = "\n".join(
        f"{n}: " + " ".join(str(words[k]["w"]) for k in range(a, b + 1))
        for n, (a, b) in enumerate(sents)
    )
    resp = client.messages.create(
        model=model,
        max_tokens=200,
        system="You pick the hook for a short vertical video: the single strongest, most surprising or "
        "intriguing sentence, which must make sense heard first, and be at most ~4 seconds long. Reply with JSON "
        '{"sentence": <number>} only.',
        messages=[{"role": "user", "content": listing}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    m = re.search(r"\d+", text)
    if not m:
        return None
    n = int(m.group())
    if not 0 < n < len(sents):  # the first sentence is already first
        return None
    a, b = sents[n]
    if float(words[b]["end"]) - float(words[a]["t"]) > 6.0:
        return None
    return a, b


def plan_cuts(
    words: list[dict[str, Any]],
    duration: float,
    max_gap: float = 0.6,
    keep_gap: float = 0.35,
    hook: tuple[int, int] | None = None,
) -> CutPlan:
    """Keep-ranges (seconds of the source) and the ledger of what was taken out, and why."""
    n = len(words)
    drop: dict[int, str] = {}
    toks = [_norm(str(w.get("w", ""))) for w in words]
    for i, t in enumerate(toks):
        if t in FILLERS:
            drop[i] = "filler"
    for i in range(1, n):
        if i in drop or i - 1 in drop or not toks[i]:
            continue
        if toks[i] == toks[i - 1] and float(words[i]["t"]) - float(words[i - 1]["end"]) < 1.0:
            drop[i - 1] = "repeat"
    for i in range(3, n):
        pair, before = toks[i - 1 : i + 1], toks[i - 3 : i - 1]
        if all(pair) and pair == before and not any(k in drop for k in range(i - 3, i + 1)):
            drop[i - 3] = drop[i - 2] = "repeat"

    keep_idx = [i for i in range(n) if i not in drop]
    if hook:
        # the strongest line goes first; the rest follows in order, without it
        h0, h1 = hook
        first = [i for i in keep_idx if h0 <= i <= h1]
        if first:
            rest = [i for i in keep_idx if not h0 <= i <= h1]
            hook_spans = _spans(words, first, duration, max_gap, keep_gap)
            rest_spans = _spans(words, rest, duration, max_gap, keep_gap)
            removed = [
                {"i": i, "w": words[i].get("w"), "t": round(float(words[i]["t"]), 2), "why": why}
                for i, why in sorted(drop.items())
            ]
            return CutPlan(hook_spans + rest_spans, removed, duration, moved=True)
    removed = [
        {"i": i, "w": words[i].get("w"), "t": round(float(words[i]["t"]), 2), "why": why}
        for i, why in sorted(drop.items())
    ]
    if not keep_idx:
        return CutPlan([(0.0, duration)], [], duration)

    keep = _spans(words, keep_idx, duration, max_gap, keep_gap)
    return CutPlan(keep, removed, duration)


def cut(
    ffmpeg: str, src: Path, dest: Path, keep: list[tuple[float, float]], has_audio: bool = True
) -> None:
    """Render the keep-ranges back to back (frame-accurate re-encode, audio cross-faded 10 ms)."""
    parts, labels = [], []
    for k, (a, b) in enumerate(keep):
        parts.append(f"[0:v]trim=start={a}:end={b},setpts=PTS-STARTPTS[v{k}]")
        if has_audio:
            parts.append(
                f"[0:a]atrim=start={a}:end={b},asetpts=PTS-STARTPTS,"
                f"afade=t=in:d=0.01,afade=t=out:st={max(0.0, b - a - 0.01):.3f}:d=0.01[a{k}]"
            )
            labels.append(f"[v{k}][a{k}]")
        else:
            labels.append(f"[v{k}]")
    graph = ";".join(parts) + ";" + "".join(labels)
    graph += f"concat=n={len(keep)}:v=1:a={1 if has_audio else 0}" + (
        "[v][a]" if has_audio else "[v]"
    )
    script = dest.with_suffix(".filter.txt")
    script.write_text(graph, encoding="utf-8")
    cmd = [
        ffmpeg,
        "-v",
        "error",
        "-y",
        "-i",
        str(src),
        "-filter_complex_script",
        str(script),
        "-map",
        "[v]",
    ]
    if has_audio:
        cmd += ["-map", "[a]", "-c:a", "aac", "-b:a", "192k"]
    cmd += [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "17",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(dest),
    ]
    media.run(cmd)


def _spans(
    words: list[dict[str, Any]],
    keep_idx: list[int],
    duration: float,
    max_gap: float,
    keep_gap: float,
) -> list[tuple[float, float]]:
    """Keep-ranges for these word indices (in order): padded words, ordinary gaps kept whole, long
    pauses closed to a breath, a cut wherever words were taken out in between."""
    spans: list[list[float]] = []
    prev = -1
    for i in keep_idx:
        a = max(0.0, float(words[i]["t"]) - PRE)
        b = min(duration, float(words[i]["end"]) + POST)
        if prev >= 0 and i != prev + 1:
            # words were taken out in between: cut, and never let the padding reach into them
            spans[-1][1] = min(spans[-1][1], float(words[prev + 1]["t"]))
            a = max(a, float(words[i - 1]["end"]))
            spans.append([a, b])
        elif spans and a - spans[-1][1] <= max(0.0, max_gap - PRE - POST):
            spans[-1][1] = max(spans[-1][1], b)  # an ordinary gap between words: keep it whole
        else:
            if spans:  # a long pause: keep a breath of it
                spans[-1][1] = min(a, spans[-1][1] + max(0.0, keep_gap - PRE - POST))
            spans.append([a, b])
        prev = i
    # a short lead-in and tail so the first and last words are not clipped, never into a neighbour
    first, last = keep_idx[0], keep_idx[-1]
    lo = float(words[first - 1]["end"]) if first > 0 else 0.0
    hi = float(words[last + 1]["t"]) - 0.02 if last + 1 < len(words) else duration
    spans[0][0] = max(0.0, lo, spans[0][0] - 0.12)
    spans[-1][1] = min(duration, max(spans[-1][1], min(hi, spans[-1][1] + 0.5)))
    keep = [(round(a, 3), round(b, 3)) for a, b in spans if b - a > 0.05]
    return keep
