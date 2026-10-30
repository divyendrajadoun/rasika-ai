"""The director's plan check: a screen that changes before it can be read starts later on a spoken
word, what can't be moved is reported, and the hook, terms and caption speed are checked."""

from __future__ import annotations

from rasika_worker import director


def _words(text: str, every: float = 0.4) -> list[dict]:
    return [
        {"w": w, "t": round(i * every, 2), "end": round(i * every + every * 0.8, 2)}
        for i, w in enumerate(text.split())
    ]


NARRATION = (
    "Bloom filters answer fast. They keep a few bits per item. Ask for a word and check its bits. "
    "All set means maybe, that's a false positive. Any bit clear means no, never wrong."
)


def _levels(checks: list[dict]) -> dict[str, str]:
    return {c["check"]: c["level"] for c in checks}


def test_read_time_is_video_directors_formula() -> None:
    assert director.read_time("") == 0.0
    assert director.read_time("Go") == 1.5
    assert director.read_time("one two three four five six") == 1.0 + 0.3 * 6


def test_a_screen_too_short_to_read_starts_the_next_scene_later() -> None:
    words = _words(NARRATION)
    sb = {
        "narration": NARRATION,
        "terms": ["Bloom filters", "false positive"],
        "scenes": [
            {"type": "headline", "say": "Bloom filters", "title": "BLOOM *FILTERS*"},
            # five words on screen (2.5 s to read) but the next scene starts 1.2 s later
            {"type": "step", "say": "They keep a few", "title": "a few bits per item"},
            {"type": "step", "say": "per item. Ask", "title": "Ask"},
            {"type": "step", "say": "All set means maybe", "title": "MAYBE"},
            {"type": "cta", "say": "Any bit clear", "title": "NO"},
        ],
    }
    out, checks = director.plan(sb, words, 14.0)
    assert out["scenes"][2]["say"] != "per item. Ask"  # moved later, onto a spoken word
    moved = next(c for c in checks if c["level"] == "PASS" and "reading" in c["check"])
    assert "scene 3" in moved["detail"]
    lv = _levels(checks)
    assert lv["plan: hook names the subject"] == "PASS"
    assert lv["plan: terms said"] == "PASS"
    assert lv["plan: caption speed"] == "PASS"


def test_what_cannot_be_fixed_and_missing_terms_are_reported() -> None:
    words = _words(NARRATION, every=0.25)  # 4 words a second: too fast to read along
    sb = {
        "narration": NARRATION,
        "terms": ["hash function"],
        "scenes": [
            {"type": "headline", "say": "", "title": "A VERY LONG HOOK LINE THAT NOBODY CAN READ"},
            {"type": "step", "say": "They keep a few", "title": "bits"},
        ],
    }
    _, checks = director.plan(sb, words, 10.0)
    lv = {c["check"]: c["level"] for c in checks if c["level"] != "PASS"}
    assert lv["plan: reading time"] == "WARN"
    assert lv["plan: hook names the subject"] == "WARN"
    assert lv["plan: terms said"] == "WARN"
    assert lv["plan: caption speed"] == "WARN"


def test_the_rules_ride_on_every_voice_led_writer() -> None:
    from rasika_worker import research, roundup, toon

    for prompt in (research.STORY_SYSTEM, toon.WRITER_SYSTEM, roundup.WRITER_SYSTEM):
        assert prompt.endswith(director.RULES)
