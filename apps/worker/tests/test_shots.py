"""One messy video: finding the joins, splitting the words, the shot checks (ffmpeg where needed)."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from rasika_worker import assemble, shots

FFMPEG = shutil.which("ffmpeg")


def _w(word: str, t: float, end: float) -> dict[str, object]:
    return {"w": word, "t": t, "end": end}


def test_a_weak_change_inside_a_word_is_not_a_cut() -> None:
    words = [_w("hello", 1.0, 1.6), _w("there", 2.0, 2.4)]
    scores = [(i / 30, 0.01) for i in range(90)]
    scores[39], scores[45], scores[54], scores[66] = (
        (1.3, 0.08),
        (1.5, 0.15),
        (1.8, 0.08),
        (2.2, 0.5),
    )
    # 1.3 is a faint change inside "hello" (a gesture); 1.5 is inside it too but a clear spike
    # (the word times are approximate); 1.8 is faint but between words; 2.2 is strong
    assert [t for t, _ in shots.find_cuts(scores, words)] == [1.5, 1.8, 2.2]


def test_a_weak_change_counts_only_as_a_spike() -> None:
    calm = [(i / 30, 0.01) for i in range(60)]
    busy = [(2 + i / 30, 0.05) for i in range(60)]
    scores = [*calm[:30], (1.0, 0.08), *calm[31:], *busy[:30], (3.0, 0.08), *busy[31:]]
    # 0.08 stands out from a still shot, not from one where the person moves a lot
    assert [t for t, _ in shots.find_cuts(scores, [])] == [1.0]


def test_segments_merge_close_cuts_and_keep_the_strongest() -> None:
    segs = shots.segments([(3.0, 0.4), (3.3, 0.9), (6.0, 0.5), (9.7, 0.6)], 10.0)
    # 3.0/3.3 is one transition (3.3 wins); 9.7 would leave a 0.3 s shot at the end
    assert segs == [(0.0, 3.3), (3.3, 6.0), (6.0, 10.0)]


def test_segments_cap_drops_the_weakest_cuts() -> None:
    cuts = [(float(i), 0.3 + i / 100) for i in range(1, 20)]
    segs = shots.segments(cuts, 20.0, max_shots=5)
    assert len(segs) == 5
    assert [a for a, _ in segs[1:]] == [16.0, 17.0, 18.0, 19.0]


def test_split_words_by_their_middle() -> None:
    words = [_w("a", 0.2, 0.5), _w("b", 2.9, 3.3), _w("c", 4.0, 4.4)]
    per = shots.split_words(words, [(0.0, 3.0), (3.0, 6.0)])
    assert [w["w"] for w in per[0]] == ["a"]
    assert [w["w"] for w in per[1]] == ["b", "c"]
    assert per[1][0]["t"] == 0.0 and per[1][1]["t"] == 1.0  # relative to the shot


def test_hints_and_drop_unusable() -> None:
    looks = {
        "s1": shots.Look(120, 400, 0.5),
        "s2": shots.Look(5, 380, 0.1),  # black
        "s3": shots.Look(22, 420, 0.2),  # very dark, nothing said
        "s4": shots.Look(110, 60, 0.3),  # blurry, but said something: the model's call
    }
    shots.hints(list(looks.values()))
    assert looks["s2"].flags == ["black"] and "blurry" in looks["s4"].flags
    clips = {
        "s1": assemble.Clip(
            "s1", "Shot 1", [_w("hi", 0.1, 0.3), _w("all", 0.3, 0.5), _w("you", 0.5, 0.7)], 3.0
        ),
        "s2": assemble.Clip("s2", "Shot 2", [], 2.0),
        "s3": assemble.Clip("s3", "Shot 3", [], 2.0),
        "s4": assemble.Clip(
            "s4", "Shot 4", [_w("ok", 0.1, 0.3), _w("so", 0.3, 0.5), _w("now", 0.5, 0.7)], 2.0
        ),
    }
    out = shots.drop_unusable(assemble.arrange_recorded(list(clips.values())), looks, clips)
    kept = {d.id for d in out if d.keep}
    assert kept == {"s1", "s4"}
    why = {d.id: d.why for d in out}
    assert why["s2"] == "black frames" and why["s3"] == "too dark, nothing said"


@pytest.mark.skipif(not FFMPEG, reason="needs ffmpeg")
def test_a_joined_video_splits_into_its_shots(tmp_path: Path) -> None:
    src = tmp_path / "joined.mp4"
    # three 2 s shots joined: a test pattern, black, a red frame
    subprocess.run(
        [FFMPEG, "-v", "error", "-y",
         "-f", "lavfi", "-i", "testsrc=size=360x640:rate=30:duration=2",
         "-f", "lavfi", "-i", "color=c=black:size=360x640:rate=30:duration=2",
         "-f", "lavfi", "-i", "color=c=red:size=360x640:rate=30:duration=2",
         "-filter_complex", "[0:v][1:v][2:v]concat=n=3:v=1[v]", "-map", "[v]",
         "-pix_fmt", "yuv420p", str(src)],
        check=True,
    )  # fmt: skip
    cuts = shots.find_cuts(shots.scene_scores(FFMPEG, src), [])
    segs = shots.segments(cuts, 6.0)
    assert len(segs) == 3
    assert abs(segs[1][0] - 2.0) < 0.1 and abs(segs[2][0] - 4.0) < 0.1
    looks = [shots.look(FFMPEG, src, a, b, tmp_path / f"{i}.jpg") for i, (a, b) in enumerate(segs)]
    shots.hints(looks)
    assert "black" in looks[1].flags and "black" not in looks[0].flags
    assert Path(looks[0].still).is_file()
