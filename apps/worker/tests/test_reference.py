"""Reference matching: cut parsing, shot statistics and the fidelity merge (no ffmpeg, no network)."""

from __future__ import annotations

from rasika_worker.reference import merge_by_fidelity, parse_cuts, parse_json, shot_stats

SHOWINFO = """
[Parsed_showinfo_1 @ 0x1] n:   0 pts:  36036 pts_time:1.2012  pos: 1 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   1 pts:  39039 pts_time:1.3013  pos: 2 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   2 pts: 120120 pts_time:4.004   pos: 3 fmt:yuv420p
[Parsed_showinfo_1 @ 0x1] n:   3 pts: 270270 pts_time:9.009   pos: 4 fmt:yuv420p
"""


def test_parse_cuts_merges_flicker_within_200ms() -> None:
    assert parse_cuts(SHOWINFO) == [1.2012, 4.004, 9.009]


def test_shot_stats() -> None:
    lengths, mean, med, cpm = shot_stats([2.0, 5.0, 9.0], 12.0)
    assert lengths == [2.0, 3.0, 4.0, 3.0]
    assert mean == 3.0 and med == 3.0
    assert cpm == 15.0


def test_shot_stats_without_cuts_is_one_shot() -> None:
    lengths, mean, _med, cpm = shot_stats([], 20.0)
    assert lengths == [20.0] and mean == 20.0 and cpm == 0.0


PRESET = {
    "id": "noir-minimal",
    "name": "Noir",
    "tagline": "t",
    "palette": {"stage": "#000000", "mar": "#eeeeee", "ter": "#ff0000", "gold": "#ffcc00", "goldd": "#aa8800", "iv": "#ffffff", "ink": "#000000"},
    "fonts": {"poster": "Anton", "accent": "Instrument Serif", "ui": "Inter", "devanagari": "Mukta", "caption": "Inter"},
    "grain": 0.1,
    "pace": 0.5,
    "captionStyle": "karaoke",
    "captionSize": 70,
    "endCardShape": "arch",
    "pattern": "none",
    "preferredElements": [],
    "motion": {"family": "editorial", "enter": "rise", "exit": "lift", "easing": "spring", "speed": 1, "camera": "glide", "sfxKit": "pop", "texture": "none", "direction": "", "avoidElements": []},
}
PROPOSED = {
    "name": "Ref look",
    "palette": {**PRESET["palette"], "ter": "#2b59ff"},
    "fonts": {"poster": "Space Grotesk", "devanagari": "Noto", "caption": "Comic Sans"},
    "captionStyle": "box",
    "motion": {"direction": "cut every 1.4 s", "enter": "slam", "camera": "cut", "texture": "grid", "family": "hype"},
}


def test_pace_only_changes_direction() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "pace")
    assert out["motion"]["direction"] == "cut every 1.4 s"
    assert out["motion"]["enter"] == "rise" and out["palette"]["ter"] == "#ff0000"
    assert out["name"] == "Noir"


def test_camera_adds_motion_but_not_look() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "camera")
    assert out["motion"]["enter"] == "slam" and out["motion"]["camera"] == "cut"
    assert out["motion"]["texture"] == "none" and out["palette"]["ter"] == "#ff0000"


def test_look_changes_everything_but_keeps_devanagari_and_known_fonts() -> None:
    out = merge_by_fidelity(PRESET, PROPOSED, "look")
    assert out["palette"]["ter"] == "#2b59ff" and out["captionStyle"] == "box"
    assert out["motion"]["texture"] == "grid" and out["motion"]["family"] == "hype"
    assert out["fonts"]["poster"] == "Space Grotesk"
    assert out["fonts"]["caption"] == "Inter"  # unknown font rejected
    assert out["fonts"]["devanagari"] == "Mukta"


def test_parse_json_strips_fences() -> None:
    assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
