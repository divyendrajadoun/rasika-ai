"""Pure-logic tests for the Phase 4 pipeline (no ffmpeg, DB, S3 or Chromium needed)."""

from __future__ import annotations

import json
import pathlib
import shutil
import subprocess

import pytest

from rasika_worker import media
from rasika_worker.align import realign
from rasika_worker.render import plan_chunks, thumbnail_time
from rasika_worker.transcribe import Word, choose_language, language_score, script_ratio

ROOT = pathlib.Path(__file__).resolve().parents[3]


def test_plan_chunks_cover_every_frame_once_on_boundaries() -> None:
    chunks = plan_chunks(2703, parallelism=8, fps=30, target_sec=12)
    assert chunks[0][0] == 0 and chunks[-1][1] == 2703
    for (a0, a1), (b0, _) in zip(chunks, chunks[1:], strict=False):
        assert a1 == b0 and a1 > a0
    assert len(chunks) == 8  # 90 s / 12 s = 8 chunks, capped at parallelism
    assert plan_chunks(100, parallelism=24) == [(0, 100)]  # short clips: one chunk
    assert plan_chunks(0, 4) == []
    assert len(plan_chunks(2703, parallelism=2)) == 2


def test_thumbnail_time_prefers_the_reveal() -> None:
    plan = json.loads((ROOT / "plans" / "baisa_bling.json").read_text(encoding="utf-8"))
    assert thumbnail_time(plan) == pytest.approx(74.95 + 0.6)
    assert thumbnail_time({"meta": {"durationSec": 50}, "elements": []}) == 20.0


def test_language_verification_catches_garbage_decodes() -> None:
    good_en = [
        Word(w, 0.0, 0.1, 0.9)
        for w in ["how", "do", "you", "know", "your", "taste", "in", "jewellery"]
    ]
    garbage_hi = [Word(w, 0.0, 0.1, 0.3) for w in ["टेस्ट", "टेस्ट", "टेस्ट", "टेस्ट"]]
    assert language_score("en", good_en) > language_score("hi", garbage_hi)
    assert script_ratio("नमस्ते दुनिया", "hi") == 1.0
    assert script_ratio("hello", "hi") == 0.0
    scores = {"en": language_score("en", good_en), "hi": language_score("hi", garbage_hi)}
    # the reference lesson: detector said hi, the probe says en
    lang, why = choose_language("hi", 0.6, scores, "auto")
    assert lang == "en" and "overruled" in why
    assert choose_language("hi", 0.99, {"en": 0.5, "hi": 0.45}, "auto")[0] == "hi"
    assert choose_language("en", 0.9, {}, "hinglish")[0] == "hi"
    assert choose_language("en", 0.9, {}, "hi")[0] == "hi"


def test_realign_keeps_matched_timings_and_interpolates_edits() -> None:
    old = [
        {"w": "How", "t": 0.22, "end": 0.3},
        {"w": "do", "t": 0.3, "end": 0.46},
        {"w": "you", "t": 0.46, "end": 0.58},
        {"w": "know", "t": 0.58, "end": 0.78},
        {"w": "feet", "t": 0.78, "end": 0.94},
        {"w": "every", "t": 0.94, "end": 1.1},
        {"w": "day", "t": 1.1, "end": 1.3},
    ]
    new = realign(old, "How do you know your feed every day")
    assert [w["w"] for w in new] == ["How", "do", "you", "know", "your", "feed", "every", "day"]
    assert new[0]["t"] == 0.22 and new[3]["t"] == 0.58 and new[6]["t"] == 0.94
    # inserted "your" and corrected "feed" sit between their neighbours
    assert 0.58 < new[4]["t"] < new[5]["t"] < 0.94
    assert all(a["t"] <= b["t"] for a, b in zip(new, new[1:], strict=False))
    assert realign(old, "") == []


def test_encoder_settings_are_identical_across_chunks() -> None:
    a = media.encoder_cmd("ffmpeg", pathlib.Path("a.mp4"), preview=False)
    b = media.encoder_cmd("ffmpeg", pathlib.Path("b.mp4"), preview=False)
    assert a[:-1] == b[:-1]
    assert "-g" in a and a[a.index("-g") + 1] == "30"  # fixed GOP → clean concat points
    assert "scenecut=0:open-gop=0" in a
    p = media.encoder_cmd("ffmpeg", pathlib.Path("p.mp4"), preview=True)
    assert "ultrafast" in p


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not on PATH")
def test_probe_and_frames_on_a_synthetic_clip(tmp_path: pathlib.Path) -> None:
    clip = tmp_path / "clip.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            "testsrc=size=720x1280:rate=30:duration=1",
            "-f",
            "lavfi",
            "-i",
            "sine=frequency=440:duration=1",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-shortest",
            str(clip),
        ],
        check=True,
    )
    info = media.probe("ffprobe", clip)
    assert info.is_vertical and info.has_audio and info.codec == "h264"
    assert info.duration_sec == pytest.approx(1.0, abs=0.1)
    n = media.extract_frames("ffmpeg", clip, tmp_path / "frames")
    assert n == 30
    media.extract_audio("ffmpeg", clip, tmp_path / "voice.wav", tmp_path / "a16.wav")
    assert (tmp_path / "a16.wav").stat().st_size > 16000
    # the mix graph runs on this ffmpeg build (older builds lack amix normalize=0)
    media.mix("ffmpeg", tmp_path / "voice.wav", tmp_path / "voice.wav", tmp_path / "mix.wav")
    assert (tmp_path / "mix.wav").stat().st_size > 1000
