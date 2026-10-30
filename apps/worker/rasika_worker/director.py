"""
The director's rules for a film made from a brief, and the plan check that holds a storyboard to
them before anything is drawn.

Distilled from video-director (https://github.com/win4r/video-director, MIT, © its contributors):
its principles that a writer controls go into the writing prompts (RULES), and the parts of its
check_timeline.py that apply to a voice-led reel run on the storyboard once the voice is timed
(plan): the hook is up by 3 s and names the subject, every screen holds long enough to be read,
the terms people search for are said, and the captions are not too fast to read. A screen that
changes before it can be read gets the next scene's start moved a little later, onto a word the
voice says; what cannot be fixed that way is reported (it lands in the reel's QA report).
"""

from __future__ import annotations

import re
from typing import Any

RULES = """
Craft rules for every film (they decide whether people stay):
- Hook by 3 s, readable with the sound off: the first scene names the subject in the words people search
  for and states the promise, big, on screen from frame 0. Never hold the subject or the point back.
- Add "terms" to the JSON object: 1–3 words or short phrases people would type into a search box (the
  subject's name, then the field's standard term for the key idea). Say each one verbatim in the voice, the
  first one inside the first sentence, the others right after the idea they name. Use the standard term,
  not a friendlier synonym.
- Every on-screen line needs time to be read before the picture changes: about 1 s + 0.3 s a word, never
  under 1.5 s. When a beat is short, cut its words, not its hold.
- One idea per film, and the ending answers the opening (the hook's question answered, the problem gone).
- One accent colour with one meaning (the key word of the scene); never two accents fighting in a scene.
- Tell the truth: every number comes from the facts and is worded no stronger than its source ("after the
  launch", not "because of the launch"; "so far" for a period that isn't over).
- Sound like a person, not an ad: no "unlock", "elevate", "game-changer", "seamless", "dive in", "in
  today's fast-paced world".
"""

HOOK_BY = 3.0
MAX_WORDS_PER_SEC = 3.5  # captions faster than this can't be read
MAX_PUSH = (
    1.2  # how much later a scene may start than its words (s): further, and it lags the voice
)

# what a scene puts on screen to be read (cards are pictures with their own small text: not counted)
TEXT_FIELDS = (
    "title",
    "serif",
    "pill",
    "label",
    "label_kick",
    "big",
    "sub",
    "lead",
    "word",
    "tail",
)


def read_time(text: str) -> float:
    """video-director's hold for a line of on-screen text: max(1.5 s, 1 s + 0.3 s a word)."""
    n = len(text.split())
    return max(1.5, 1.0 + 0.3 * n) if n else 0.0


def scene_text(s: dict[str, Any]) -> str:
    parts = [str(s.get(k) or "") for k in TEXT_FIELDS]
    return re.sub(r"[*\n]+", " ", " ".join(p for p in parts if p)).strip()


def _starts(
    scenes: list[dict[str, Any]], words: list[dict[str, Any]], length: float
) -> list[float]:
    """When each scene starts, the way hyper.py and toon.py time them (the first at 0)."""
    from rasika_worker.roundup import when  # roundup's prompt imports RULES from here

    starts: list[float] = []
    for i, s in enumerate(scenes):
        t = when(words, str(s.get("say") or ""), starts[-1] + 0.6 if starts else 0.0) if i else 0.0
        if t is None:
            t = (starts[-1] + 2.5) if starts else 0.0
        starts.append(min(t, length - 0.6))
    return starts


def _say_at(words: list[dict[str, Any]], t: float) -> tuple[str, float] | None:
    """Three spoken words starting at the first word at or after t, and when that word starts."""
    for i, w in enumerate(words):
        if float(w["t"]) + 1e-6 >= t:
            return " ".join(str(x.get("w") or "") for x in words[i : i + 3]), float(w["t"])
    return None


def plan(
    sb: dict[str, Any], words: list[dict[str, Any]], length: float
) -> tuple[dict[str, Any], list[dict[str, str]]]:
    """The storyboard with too-fast scene changes moved onto later words, and the plan checks as
    [{level, check, detail}] (the QA report's shape, names starting with "plan:")."""
    from rasika_worker.roundup import _norm, says

    checks: list[dict[str, str]] = []

    def add(level: str, name: str, detail: str) -> None:
        checks.append({"level": level, "check": "plan: " + name, "detail": detail})

    scenes = [s for s in sb.get("scenes") or [] if isinstance(s, dict)]
    narration = str(sb.get("narration") or "")
    if not scenes or not words:
        return sb, checks

    # reads: each scene's text holds long enough before the next scene
    starts = _starts(scenes, words, length)
    moved, short = [], []
    for i, s in enumerate(scenes):
        need = read_time(scene_text(s))
        end = starts[i + 1] if i + 1 < len(scenes) else length
        if not need or end - starts[i] >= need:
            continue
        if i + 1 < len(scenes):
            want = starts[i] + need
            nxt = _say_at(words, want)
            after = starts[i + 2] if i + 2 < len(scenes) else length
            next_need = read_time(scene_text(scenes[i + 1]))
            if nxt and nxt[1] - end <= MAX_PUSH and after - nxt[1] >= next_need:
                scenes[i + 1]["say"] = nxt[0]
                starts = _starts(scenes, words, length)
                moved.append(f"scene {i + 2} → {nxt[1]:.1f} s")
                continue
        short.append(
            f"scene {i + 1} at {starts[i]:.1f} s: {end - starts[i]:.1f} s for {need:.1f} s of text"
        )
    if moved:
        add("PASS", "reading time", "fixed: " + "; ".join(moved[:8]))
    if short:
        add("WARN", "reading time", "; ".join(short[:6]))
    elif not moved:
        add("PASS", "reading time", "every screen holds long enough to read")

    # the hook: on screen from 0 (by construction) and readable, and the subject named by 3 s
    terms = [str(t).strip() for t in sb.get("terms") or [] if str(t).strip()][:3]
    if terms:
        early = " ".join(str(w.get("w") or "") for w in words if float(w["t"]) < HOOK_BY)
        hook_text = scene_text(scenes[0])
        named = says(early, terms[0]) or says(hook_text, terms[0])
        add(
            "PASS" if named else "WARN",
            "hook names the subject",
            f"'{terms[0]}' {'is' if named else 'is not'} said or shown by {HOOK_BY:g} s",
        )
        missing = [t for t in terms if not says(narration, t)]
        add(
            "WARN" if missing else "PASS",
            "terms said",
            f"never said: {', '.join(missing)}" if missing else ", ".join(terms),
        )
    else:
        add("WARN", "terms said", "the writer listed no search terms")

    # captions: the voice read out on screen, so not faster than people read
    spoken = len(_norm(narration))
    span = float(words[-1].get("end") or words[-1]["t"]) - float(words[0]["t"])
    rate = spoken / span if span > 0 else 0.0
    add(
        "WARN" if rate > MAX_WORDS_PER_SEC else "PASS",
        "caption speed",
        f"{rate:.1f} words/s (≤ {MAX_WORDS_PER_SEC:g})",
    )
    return {**sb, "scenes": scenes}, checks
