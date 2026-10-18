"""Pure-logic tests for the Phase 5 pieces (no API, no Chromium)."""

from __future__ import annotations

import json
import pathlib

import pytest

from rasika_worker.face import free_zone_for, prop_point_for, subject_from_keyframes
from rasika_worker.planner import PlannerInput, compact_words, load_plan_schema
from rasika_worker.transcript_fix import merge_fixes

ROOT = pathlib.Path(__file__).resolve().parents[3]


def test_merge_fixes_applies_safe_changes_and_keeps_timings() -> None:
    words = [
        {"w": "how", "t": 0.2, "end": 0.3, "conf": 0.9},
        {"w": "do", "t": 0.3, "end": 0.4, "conf": 0.9},
        {"w": "you", "t": 0.4, "end": 0.5, "conf": 0.9},
        {"w": "know", "t": 0.5, "end": 0.7, "conf": 0.9},
        {"w": "jewelry", "t": 0.7, "end": 1.1, "conf": 0.9},
        {"w": "2000", "t": 1.1, "end": 1.5, "conf": 0.9},
    ]
    merged, applied, rejected = merge_fixes(
        words, ["How", "do", "you", "know", "jewellery?", "2000"]
    )
    assert [w["w"] for w in merged] == ["How", "do", "you", "know", "jewellery?", "2000"]
    assert merged[4]["t"] == 0.7 and merged[4]["end"] == 1.1  # timings untouched
    assert len(applied) == 2 and rejected == 0
    # a completely different word is rejected, never applied
    merged2, applied2, rejected2 = merge_fixes(
        words, ["How", "do", "you", "know", "necklace", "2000"]
    )
    assert merged2[4]["w"] == "jewelry" and rejected2 == 1 and len(applied2) == 1
    with pytest.raises(ValueError):
        merge_fixes(words, ["How", "do"])


def test_free_zone_and_prop_point_follow_the_face() -> None:
    face = {"x": 300, "y": 700, "w": 480, "h": 560}
    fz = free_zone_for(face)
    assert fz["y"] == 150 and fz["y"] + fz["h"] == 660  # ends 40 px above the face
    low = free_zone_for({"x": 300, "y": 300, "w": 480, "h": 560})
    assert low["h"] == 260  # never thinner than 260 px
    pp = prop_point_for(face)
    assert 300 < pp["x"] < 780 and pp["y"] > face["y"] + face["h"]


def test_subject_falls_back_without_keyframes() -> None:
    s = subject_from_keyframes([])
    assert s.detections == 0 and s.face_box["w"] > 0 and s.free_zone["h"] >= 260
    plan_subject = s.as_plan_subject()
    assert set(plan_subject) == {"faceBox", "freeZone", "prop"}


def test_compact_words_and_schema_tool() -> None:
    assert (
        compact_words([{"w": "How", "t": 0.22}, {"w": "do", "t": 0.3}]) == "0|0.22|How\n1|0.30|do"
    )
    schema = load_plan_schema()
    assert schema["type"] == "object" and "elements" in schema["properties"]
    assert "PosterText" in schema["$defs"]
    inp = PlannerInput(10, "en", [], {}, {}, None, {}, [], [])
    assert inp.duration_sec == 10


def test_fewshot_plan_is_the_golden_plan() -> None:
    plan = json.loads((ROOT / "plans" / "baisa_bling.json").read_text(encoding="utf-8"))
    assert len(plan["elements"]) == 47
