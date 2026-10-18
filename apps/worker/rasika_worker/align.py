"""Re-align an edited transcript to the original word timings (port of mikku align.py's difflib
step). Matched words keep their times; inserted/changed words are interpolated between their
neighbours (0.3 s steps at the edges)."""

from __future__ import annotations

import difflib
import re
from typing import Any

_NORM = re.compile(r"[^\w']", re.UNICODE)


def norm(w: str) -> str:
    return _NORM.sub("", w.lower())


def realign(old_words: list[dict[str, Any]], new_text: str) -> list[dict[str, Any]]:
    script = new_text.split()
    if not script:
        return []
    times: list[float | None] = [None] * len(script)
    ends: list[float | None] = [None] * len(script)
    old_norm = [norm(str(w["w"])) for w in old_words]
    sm = difflib.SequenceMatcher(None, [norm(w) for w in script], old_norm, autojunk=False)
    for b in sm.get_matching_blocks():
        for k in range(b.size):
            src = old_words[b.b + k]
            times[b.a + k] = float(src["t"])
            ends[b.a + k] = float(src["end"]) if src.get("end") is not None else None
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:  # nothing matched: spread across the old span
        t0 = float(old_words[0]["t"]) if old_words else 0.0
        t1 = (
            float(old_words[-1].get("end") or old_words[-1]["t"])
            if old_words
            else 0.3 * len(script)
        )
        for i in range(len(script)):
            times[i] = t0 + (t1 - t0) * i / max(1, len(script) - 1)
    else:
        for i in range(len(times)):
            if times[i] is not None:
                continue
            p = max((k for k in known if k < i), default=None)
            n = min((k for k in known if k > i), default=None)
            tp = times[p] if p is not None else None
            tn = times[n] if n is not None else None
            if p is None and n is not None and tn is not None:
                times[i] = tn - 0.3 * (n - i)
            elif n is None and p is not None and tp is not None:
                times[i] = tp + 0.3 * (i - p)
            elif p is not None and n is not None and tp is not None and tn is not None:
                times[i] = tp + (tn - tp) * (i - p) / (n - p)
    out: list[dict[str, Any]] = []
    for i, (w, t) in enumerate(zip(script, times, strict=True)):
        t = max(0.0, round(float(t or 0.0), 3))
        nxt = times[i + 1] if i + 1 < len(times) else None
        known_end = ends[i]
        if known_end is not None:
            end = known_end
        elif nxt is not None:
            end = round(nxt, 3)
        else:
            end = round(t + 0.4, 3)
        out.append({"w": w, "t": t, "end": max(t, end)})
    return out
