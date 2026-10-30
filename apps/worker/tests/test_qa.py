"""The finished-reel check (qa.py) on small made-up videos: it finds a frozen stretch, a black first
frame and a quiet mix, and passes a moving, levelled one."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

from rasika_worker import media, qa

pytestmark = pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="needs ffmpeg")

SIZE = "270x480"


def _ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def _clip(tmp: Path, name: str, video: str, sec: float, tone_db: float = -14.0) -> Path:
    out = tmp / name
    _ff(
        "-f", "lavfi", "-i", f"{video}{':' if '=' in video else '='}s={SIZE}:r=30:d={sec}",
        "-f", "lavfi", "-i", f"sine=f=220:sample_rate=48000:d={sec}",
        "-filter_complex", f"[1:a]volume={tone_db}dB[a]", "-map", "0:v", "-map", "[a]",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(out),
    )  # fmt: skip
    return out


def _levels(rep: dict) -> dict[str, str]:
    return {c["check"]: c["level"] for c in rep["checks"]}


def test_a_moving_levelled_reel_passes(tmp_path: Path) -> None:
    raw = _clip(tmp_path, "raw.mp4", "testsrc2", 6)
    reel = tmp_path / "reel.mp4"
    media.level("ffmpeg", raw, reel)
    sheet = tmp_path / "sheet.jpg"
    rep = qa.check("ffmpeg", "ffprobe", reel, sheet)
    lv = _levels(rep)
    assert lv["first frame"] == lv["flashes"] == lv["frozen picture"] == "PASS"
    assert lv["loudness"] == "PASS" and lv["true peak"] == "PASS"
    assert rep["sheet"] and sheet.stat().st_size > 1000


def test_a_held_picture_a_black_start_and_a_quiet_mix_are_named(tmp_path: Path) -> None:
    black = _clip(tmp_path, "black.mp4", "color=c=black", 1, -40)
    moving = _clip(tmp_path, "moving.mp4", "testsrc2", 2, -40)
    # the middle: one frame of the test pattern held for 2.5 s
    still_png = tmp_path / "still.png"
    _ff("-i", str(moving), "-frames:v", "1", str(still_png))
    held = tmp_path / "held.mp4"
    _ff(
        "-loop", "1", "-i", str(still_png), "-f", "lavfi", "-i", "sine=f=220:sample_rate=48000:d=2.5",
        "-filter_complex", "[1:a]volume=-40dB[a]", "-map", "0:v", "-map", "[a]", "-t", "2.5",
        "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(held),
    )  # fmt: skip
    lst = tmp_path / "list.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in (black, moving, held, moving)))
    reel = tmp_path / "reel.mp4"
    _ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c:v", "libx264", "-c:a", "aac", str(reel))
    rep = qa.check("ffmpeg", "ffprobe", reel)
    lv = _levels(rep)
    assert lv["first frame"] == "FAIL"
    assert lv["frozen picture"] == "WARN"
    frozen = next(c for c in rep["checks"] if c["check"] == "frozen picture")["detail"]
    assert frozen.startswith("3.")  # the hold starts at 3 s (1 s black + 2 s moving)
    assert lv["loudness"] == "FAIL"
    assert rep["verdict"] == "FAIL"
