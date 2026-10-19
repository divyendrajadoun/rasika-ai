"""Script splitting and narration assembly for script-only reels (no network)."""

from __future__ import annotations

import wave
from pathlib import Path

from rasika_worker.tts import (
    MAX_CHARS,
    SAMPLE_RATE,
    estimate_seconds,
    narrate,
    split_script,
)


def test_split_keeps_sentences_and_paragraphs() -> None:
    text = "One. Two! Three?\n\nFour. Five."
    assert split_script(text) == [["One. Two! Three?"], ["Four. Five."]]


def test_split_respects_the_request_cap() -> None:
    text = " ".join(f"Sentence number {i} is here." for i in range(400))
    chunks = split_script(text)[0]
    assert len(chunks) > 1
    assert all(len(c) <= MAX_CHARS for c in chunks)
    assert " ".join(chunks) == text


def test_split_hard_cuts_a_monster_sentence() -> None:
    text = "word " * 1200  # no sentence end at all
    chunks = split_script(text)[0]
    assert all(len(c) <= MAX_CHARS for c in chunks)
    assert " ".join(chunks).split() == text.split()


def test_split_handles_devanagari_danda() -> None:
    assert split_script("पहला वाक्य। दूसरा वाक्य।") == [["पहला वाक्य। दूसरा वाक्य।"]]


def test_narrate_joins_chunks_with_pauses(tmp_path: Path) -> None:
    calls: list[str] = []

    def fake(text: str) -> bytes:
        calls.append(text)
        return b"\x01\x00" * SAMPLE_RATE  # exactly one second of PCM

    dest = tmp_path / "voice.wav"
    sec = narrate("Hello there.\n\nSecond paragraph.", dest, fake)
    assert calls == ["Hello there.", "Second paragraph."]
    with wave.open(str(dest)) as w:
        assert w.getframerate() == SAMPLE_RATE
        assert w.getnchannels() == 1
        frames = w.getnframes()
    # 2 s of speech + 0.45 s paragraph pause + 0.6 s tail
    assert abs(frames / SAMPLE_RATE - 3.05) < 0.01
    assert abs(sec - 3.05) < 0.01


def test_narrate_drops_a_stray_odd_byte(tmp_path: Path) -> None:
    sec = narrate("Hi.", tmp_path / "v.wav", lambda _t: b"\x00" * 2401)
    assert sec > 0.6


def test_estimate_is_roughly_wpm() -> None:
    s = estimate_seconds(" ".join(["word"] * 150))
    assert 59 < s < 62
