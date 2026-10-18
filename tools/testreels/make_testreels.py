#!/usr/bin/env python3
"""
Synthetic vertical talking-head test reels for the planner evaluation (docs/planner-eval.md).

Until the owner supplies real reels, each script below is spoken by the Windows SAPI voice
(or any wav you drop in), and a 1080×1920 30 fps "talking head" is drawn: warm wall, a figure
whose head bobs gently, a prop on the chest. Whisper transcribes it like real speech and the
planner designs the edit from the words alone — exactly the production path.

  python tools/testreels/make_testreels.py --out out/testreels
"""

from __future__ import annotations

import argparse
import math
import pathlib
import subprocess
import sys

from PIL import Image, ImageDraw

SCRIPTS = {
    "realtor_3bhk": {
        "voice": "Microsoft David Desktop",
        "industry": "real estate",
        "text": (
            "Stop scrolling if you are looking for a three bedroom flat in Pune under one crore twenty. "
            "This one just came on the market in Baner. First, the balcony. It faces east, so you get the morning sun and zero afternoon heat. "
            "Second, the kitchen. Modular, chimney included, and the window actually opens. "
            "Third, the society. Gym, pool, and a park where kids actually play. "
            "The price is one crore eighteen lakhs, all inclusive, and the owner is ready to move in thirty days. "
            "Here is the thing nobody tells you. In Baner, flats like this do not stay for more than two weeks. "
            "So if this is your budget, message me the word balcony and I will send you the full video tour today."
        ),
        "images": {"balcony": "BALCONY VIEW", "kitchen": "MODULAR KITCHEN", "pool": "SOCIETY POOL"},
        "brand": {"name": "Khanna Homes", "handle": "@khannahomes.pune"},
    },
    "doctor_sleep": {
        "voice": "Microsoft Zira Desktop",
        "industry": "healthcare",
        "text": (
            "Doctor, why do I wake up at three in the morning every single night? I get this question ten times a week. "
            "Here is the honest answer. It is usually one of three things. "
            "One, you are eating dinner too late, so your body is still digesting when it should be resting. "
            "Two, your room is too warm. Your core temperature needs to drop by about one degree to stay asleep. "
            "Three, and this is the big one, screens. The blue light at eleven pm tells your brain it is still afternoon. "
            "Fix these three things for two weeks before you reach for any tablet. "
            "If it still happens, come and see me, because sometimes three am is your thyroid talking. "
            "I am Doctor Mehra, and this is your two minute health check."
        ),
        "images": {"dinner": "LATE DINNER", "screens": "SCREENS AT 11 PM", "clinic": "DR MEHRA CLINIC"},
        "brand": {"name": "Dr. Mehra", "handle": "@drmehra.health"},
    },
}


def tts(text: str, voice: str, wav: pathlib.Path) -> None:
    ps = (
        "Add-Type -AssemblyName System.Speech; "
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
        f"$s.SelectVoice('{voice}'); $s.Rate = 0; "
        f"$s.SetOutputToWaveFile('{wav}'); $s.Speak([IO.File]::ReadAllText('{wav.with_suffix('.txt')}')); $s.Dispose()"
    )
    wav.with_suffix(".txt").write_text(text, encoding="utf-8")
    subprocess.run(["powershell", "-NoProfile", "-Command", ps], check=True)


def duration_of(wav: pathlib.Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(wav)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return float(out)


def frame(t: float, palette: tuple[int, int, int]) -> Image.Image:
    w, h = 1080, 1920
    img = Image.new("RGB", (w, h), palette)
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):  # vertical gradient wall
        k = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(c - 55 * k) for c in palette), width=4)
    bob = 12 * math.sin(t * 1.7)
    sway = 10 * math.sin(t * 0.9)
    # shoulders / body
    d.rounded_rectangle([200 + sway, 1140 + bob, 880 + sway, 1920], radius=140, fill=(44, 36, 52))
    # head
    d.ellipse([340 + sway, 640 + bob, 740 + sway, 1140 + bob], fill=(118, 82, 66))
    # mouth (opens with a pseudo-random rhythm so the frame is not static)
    mo = 6 + 10 * abs(math.sin(t * 9.1) * math.sin(t * 3.3))
    d.ellipse([505 + sway, 1000 + bob - mo, 575 + sway, 1000 + bob + mo], fill=(70, 30, 30))
    # prop (badge on the chest)
    d.ellipse([460 + sway, 1250 + bob, 620 + sway, 1370 + bob], fill=(230, 180, 80))
    return img


def make_video(wav: pathlib.Path, mp4: pathlib.Path, palette: tuple[int, int, int], fps: int = 30) -> None:
    dur = duration_of(wav)
    n = int(round(dur * fps))
    ff = subprocess.Popen(
        [
            "ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(fps), "-i", "-", "-i", str(wav),
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
            "-shortest", "-movflags", "+faststart", str(mp4),
        ],
        stdin=subprocess.PIPE,
    )
    assert ff.stdin
    for i in range(n):
        frame(i / fps, palette).save(ff.stdin, format="JPEG", quality=85)
    ff.stdin.close()
    ff.wait()
    if ff.returncode:
        sys.exit("ffmpeg failed")


def make_image(label: str, path: pathlib.Path, palette: tuple[int, int, int]) -> None:
    img = Image.new("RGB", (900, 1125), palette)
    d = ImageDraw.Draw(img)
    for i in range(0, 1125, 90):
        d.rectangle([0, i, 900, i + 45], fill=tuple(max(0, c - 18) for c in palette))
    d.rectangle([80, 80, 820, 1045], outline=(246, 236, 216), width=12)
    d.text((110, 120), label, fill=(246, 236, 216))
    img.save(path, quality=88)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=pathlib.Path, default=pathlib.Path("out/testreels"))
    args = ap.parse_args()
    palettes = {"realtor_3bhk": (196, 178, 150), "doctor_sleep": (168, 192, 196)}
    img_palettes = {"realtor_3bhk": (120, 90, 60), "doctor_sleep": (60, 100, 110)}
    for key, spec in SCRIPTS.items():
        d = args.out / key
        d.mkdir(parents=True, exist_ok=True)
        wav = d / "voice.wav"
        if not wav.exists():
            tts(spec["text"], spec["voice"], wav)
        mp4 = d / f"{key}.mp4"
        if not mp4.exists():
            make_video(wav, mp4, palettes[key])
        for stem, label in spec["images"].items():
            p = d / f"{stem}.jpg"
            if not p.exists():
                make_image(label, p, img_palettes[key])
        (d / "meta.txt").write_text(
            f"industry: {spec['industry']}\nbrand: {spec['brand']}\nimages: {spec['images']}\n", encoding="utf-8"
        )
        print(f"{key}: {duration_of(wav):.1f} s → {mp4}")


if __name__ == "__main__":
    main()
