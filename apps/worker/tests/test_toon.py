"""Toon explainers: what the writer's storyboard keeps, the project it becomes, the host."""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np
import pytest

from rasika_worker import toon, toonhost

NARRATION = (
    "Everyone is making reels with AI right now, but nobody shows you how. So I will show you every "
    "step. First, you need the desktop app. Next, make a folder. Now the fun part. That's the whole "
    "workflow. Comment GUIDE and I will send it to you."
)


def _words(text: str) -> list[dict[str, float | str]]:
    out = []
    t = 0.0
    for w in text.split():
        out.append({"w": w, "t": round(t, 2), "end": round(t + 0.28, 2)})
        t += 0.33
    return out


def _sb() -> dict:
    return {
        "title": "t",
        "narration": NARRATION,
        "accents": ["how.", "folder."],
        "steps": [{"title": "Desktop app", "sub": "get it"}, {"title": "Folder", "sub": "make one"}],
        "scenes": [
            {"type": "board", "say": "", "notes": ["AI", {"label": "x", "media": "m9"}], "stamp": "NOBODY|HOW?"},
            {"type": "roadmap", "say": "So I will show", "pose": "point"},
            {"type": "label", "say": "First, you need", "label": "GET *THE APP*", "badge": 1,
             "card": {"kind": "app", "rows": [{"text": "Node", "state": "done"}], "input": "check"},
             "props": [{"kind": "stamp"}, {"kind": "nope"}]},
            {"type": "label", "say": "Next, make a", "label": "A *FOLDER*", "badge": "2", "pose": "dance",
             "card": {"kind": "folder", "name": "AI", "files": ["SKILL.md"]}},
            {"type": "big", "say": "Now the fun", "big": "3", "props": [{"kind": "confetti"}]},
            {"type": "label", "say": "not in the narration", "label": "X"},
            {"type": "label", "say": "That's the whole", "card": {"kind": "image", "media": "missing"}},
            {"type": "cta", "say": "Comment GUIDE and", "word": "guide!"},
        ],
    }  # fmt: skip


def test_check_keeps_what_can_be_drawn() -> None:
    sb = toon.check(_sb(), {})
    says = [s.get("say") for s in sb["scenes"]]
    assert "not in the narration" not in says  # the voice never says it
    assert sb["scenes"][2]["props"] == [{"kind": "stamp"}]  # unknown prop dropped
    assert sb["scenes"][3]["pose"] == "explain" and sb["scenes"][3]["badge"] == 2
    assert "card" not in sb["scenes"][5]  # an image we do not have
    assert sb["scenes"][0]["notes"][1] == {"label": "x"}  # a note's missing picture becomes words
    assert len(sb["steps"]) == 2


def test_check_rejects_an_empty_storyboard() -> None:
    with pytest.raises(ValueError):
        toon.check({"narration": "too short", "scenes": []}, {})


def test_caption_groups_break_at_sentences() -> None:
    groups = toon.caption_groups(
        _words("One two three four. Five six, seven eight nine ten eleven twelve.")
    )  # type: ignore[arg-type]
    assert [len(g) for g in groups][0] == 4
    assert all(len(g) <= 8 for g in groups)


def _wav(path: Path, seconds: float = 2.0) -> Path:
    sr = 16000
    t = np.arange(int(sr * seconds)) / sr
    x = np.sin(2 * np.pi * 220 * t) * (t > 0.5) * (t < 1.5) * 12000
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(x.astype(np.int16).tobytes())
    return path


def test_mouth_follows_the_voice(tmp_path: Path) -> None:
    m = toonhost.mouth_track(_wav(tmp_path / "v.wav"), 30, 2.0)
    assert len(m) == 60
    assert set(m[:12]) == {0} and set(m[-12:]) == {0}  # silent: shut
    assert max(m[20:40]) >= 1  # speaking: open


def test_every_host_draws_with_its_parts() -> None:
    for hid in toonhost.HOSTS:
        svg = toonhost.svg(hid)
        for part in (
            'id="host"',
            'id="armr"',
            'id="arml"',
            'id="eyes"',
            'id="mouth2"',
            'id="brows"',
        ):
            assert part in svg, (hid, part)
    assert any("#up_r" in t for t in toonhost.pose_tweens("point", 1.0))


def test_build_project(tmp_path: Path) -> None:
    sb = toon.check(_sb(), {})
    voice = _wav(tmp_path / "voice.wav", 13.0)
    index, cues = toon.build_project(
        tmp_path / "p", sb, _words(NARRATION), 13.0, [("voice", voice, 1.0)], {}, "paper", "meera",
        voice_wav=voice,
    )  # fmt: skip
    doc = index.read_text(encoding="utf-8")
    assert 'data-composition-id="main"' in doc and 'window.__timelines["main"] = tl' in doc
    assert doc.count('class="clip scene"') == len(sb["scenes"])
    assert 'class="clip cap"' in doc and "hostshadow" in doc and "assets/voice.wav" in doc
    assert "Math.random" not in doc and "Date.now" not in doc  # a function of timeline time only
    kinds = {c["type"] for c in cues}
    assert {"pop", "whoosh", "thud", "impact"} <= kinds
    assert cues == sorted(cues, key=lambda c: c["t"])
