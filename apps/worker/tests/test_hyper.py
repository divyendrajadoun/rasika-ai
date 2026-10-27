"""Researched explainer reels: the HyperFrames project and the storyboard checks (no network)."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from rasika_worker import hyper
from rasika_worker.research import check_storyboard

NARRATION = (
    "In 2025 India made sixty six crore payments a day. Here's how it works. First, link your bank. "
    "Next, you pay with a QR code. Comment UPI to get the full guide."
)


def _words(text: str, step: float = 0.35) -> list[dict[str, object]]:
    return [
        {"w": w, "t": round(i * step, 3), "end": round(i * step + 0.3, 3)}
        for i, w in enumerate(text.split())
    ]


def _board() -> dict[str, object]:
    return {
        "title": "UPI",
        "narration": NARRATION,
        "emphasis": ["bank", "QR"],
        "scenes": [
            {
                "type": "headline",
                "say": "In 2025",
                "title": "66 CRORE\nA *DAY*",
                "serif": "all on UPI",
                "card": {
                    "kind": "stats",
                    "stats": [
                        {"value": "66", "label": "crore a day"},
                        {"value": "2016", "label": "launched"},
                    ],
                },
            },
            {
                "type": "step",
                "say": "First, link your bank",
                "pill": "STEP 1 · LINK",
                "title": "Your *UPI ID*",
                "card": {"kind": "chat", "messages": [{"who": "me", "text": "How do I start?"}]},
            },
            {
                "type": "step",
                "say": "never said",
                "pill": "STEP 9",
                "card": {"kind": "list", "items": ["x"]},
            },
            {
                "type": "step",
                "say": "Next, you pay",
                "pill": "STEP 2 · PAY",
                "card": {"kind": "phone", "media": "nope", "tag": "Scan"},
            },
            {
                "type": "cta",
                "say": "Comment UPI",
                "word": "UPI",
                "tail": "to get the *full guide*.",
            },
        ],
    }


def test_check_storyboard_keeps_what_holds() -> None:
    sb = check_storyboard(_board(), {})
    says = [s["say"] for s in sb["scenes"]]
    assert "never said" not in says  # its words are not in the narration
    phone = next(s for s in sb["scenes"] if s["say"] == "Next, you pay")
    assert phone["card"]["kind"] == "list"  # no saved picture: said in words instead


def test_check_storyboard_needs_a_narration() -> None:
    with pytest.raises(ValueError):
        check_storyboard({"narration": "too short", "scenes": []}, {})


def test_caption_groups_never_overlap() -> None:
    w = [
        {"w": "Step", "t": 0.0, "end": 0.4},
        {"w": "two:", "t": 0.35, "end": 0.8},
        {"w": "to", "t": 0.7, "end": 0.9},
        {"w": "pay", "t": 0.85, "end": 1.2},
    ]
    groups = hyper.caption_groups(w, set(), 2)
    for a, b in zip(groups, groups[1:], strict=False):
        assert a["end"] < b["start"]


def test_accent_spreads_over_words() -> None:
    assert hyper.spread_accent("Your *UPI ID* today") == "Your *UPI* *ID* today"
    assert 'color:#c2571b">UPI<' in hyper.accent_html("*UPI ID*", "#c2571b")


def test_build_project_writes_a_valid_composition(tmp_path: Path) -> None:
    sb = check_storyboard(_board(), {})
    voice = tmp_path / "v.wav"
    voice.write_bytes(b"RIFF")
    idx = hyper.build_project(
        tmp_path / "p",
        sb,
        _words(NARRATION),
        12.0,
        [("voice", voice, 1.0)],
        {},
        hyper.THEMES["studio"],
    )
    html = idx.read_text(encoding="utf-8")
    assert 'data-composition-id="main"' in html and 'data-duration="12.0"' in html
    assert 'window.__timelines["main"] = tl' in html
    # every scene and caption is a timed clip, the first scene starts at 0 (the hook is frame 0)
    assert re.search(r'id="s0" class="clip scene" data-start="0\.0"', html)
    assert html.count('class="clip cap"') >= 5
    assert 'id="voice" class="clip"' in html
    # no Math.random / Date / network in the timeline script
    script = html.split("<script>", 2)[-1]
    assert "Math.random" not in script and "Date.now" not in script and "fetch(" not in script


def test_theme_for_a_reference_keeps_text_readable() -> None:
    th = hyper.theme_for(
        "studio",
        {
            "colors": {"bg": "#101010", "ink": "#f5f5f5", "accent": "#ff3366", "muted": "#999999"},
            "fonts": {"display": "Oswald", "ui": "Comic Sans"},
        },
    )
    assert th.bg == "#101010" and th.accent == "#ff3366" and th.display == "Oswald"
    assert th.ui == hyper.THEMES["studio"].ui  # not bundled → the theme's own
    assert hyper.theme_for("night", {"colors": {"bg": "bad"}}) == hyper.THEMES["night"]
