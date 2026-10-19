"""
Synthesised music beds for brief-driven films (no licensed audio anywhere).

Each mood is a small arrangement written in code — drums, bass, chords, a lead figure — rendered
with the same numpy toolkit as the sound effects. Deterministic: the same (mood, bpm, seed,
duration) always gives the same bed.

  launch    four-on-the-floor house: kick, off-beat hats, rolling bass, plucked chord stabs
  showreel  tighter and faster: punchy kick/snare, sidechained pad, bright arpeggio
  recipe    lounge: soft kick, brushed hats, warm electric-piano chords, walking bass
  versus    arcade chiptune: square-wave bass, fast arps, noise snare
  journey   a 3/4 waltz: pizzicato bass, music-box celesta, soft strings
  none      silence

Usage:  python -m rasika_worker.music <mood> <seconds> out.wav [bpm] [seed]
"""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

from rasika_worker.sfx import SR, noise

MOODS = ("launch", "showreel", "recipe", "versus", "journey", "none")
DEFAULT_BPM = {
    "launch": 122,
    "showreel": 128,
    "recipe": 94,
    "versus": 150,
    "journey": 108,
    "none": 100,
}

# I–V–vi–IV in C, as MIDI note numbers (root position triads), and a minor-key loop for drama
PROG_MAJOR = [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]]
PROG_WALTZ = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]]
PROG_ARCADE = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]]


def hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


def _t(d: float) -> np.ndarray:
    return np.arange(int(SR * d)) / SR


def kick(gain: float = 1.0) -> np.ndarray:
    t = _t(0.32)
    f = 110 * np.exp(-t * 28) + 42
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 10) * gain


def snare(seed: int, gain: float = 0.5) -> np.ndarray:
    t = _t(0.22)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (noise(len(t), seed) * np.exp(-t * 22) * 0.7 + body * 0.5) * gain


def hat(seed: int, gain: float = 0.18, d: float = 0.05) -> np.ndarray:
    t = _t(d)
    n = noise(len(t), seed)
    n = n - np.convolve(n, np.ones(6) / 6, mode="same")  # crude high-pass
    return n * np.exp(-t * 90) * gain


def pluck(m: float, d: float = 0.45, bright: float = 1.0) -> np.ndarray:
    t = _t(d)
    f = hz(m)
    x = (
        np.sin(2 * np.pi * f * t)
        + 0.4 * bright * np.sin(4 * np.pi * f * t)
        + 0.15 * bright * np.sin(6 * np.pi * f * t)
    )
    return x * np.exp(-t * 7) * np.clip(t / 0.003, 0, 1)


def square(m: float, d: float, duty: float = 0.5) -> np.ndarray:
    t = _t(d)
    ph = (t * hz(m)) % 1.0
    x = np.where(ph < duty, 1.0, -1.0)
    return x * np.clip(t / 0.004, 0, 1) * np.clip((d - t) / 0.02, 0, 1)


def epiano(m: float, d: float) -> np.ndarray:
    t = _t(d)
    f = hz(m)
    x = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3))
    return x * np.exp(-t * 1.8) * np.clip(t / 0.005, 0, 1)


def pad(chord: list[int], d: float) -> np.ndarray:
    t = _t(d)
    x = sum(
        np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(2 * np.pi * hz(m) * 1.003 * t) for m in chord
    )
    return x / len(chord) * np.clip(t / 0.25, 0, 1) * np.clip((d - t) / 0.3, 0, 1)


def celesta(m: float) -> np.ndarray:
    t = _t(1.2)
    f = hz(m)
    return (
        np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4.07 * t) * np.exp(-t * 6)
    ) * np.exp(-t * 3.2)


def compose(
    mood: str, duration: float, bpm: int | None = None, seed: int = 7, start: float = 0.0
) -> np.ndarray:
    """A bed of `duration` seconds; it is silent before `start` and rings out at the end."""
    mood = mood if mood in MOODS else "launch"
    n = int(SR * (duration + 1.0))
    mix = np.zeros(n)
    if mood == "none":
        return mix[: int(SR * duration)]
    bpm = bpm or DEFAULT_BPM[mood]
    beat = 60.0 / bpm
    rng = np.random.default_rng(seed)

    def place(x: np.ndarray, t: float, g: float = 1.0) -> None:
        s = int((t + start) * SR)
        if s >= n:
            return
        e = min(n, s + len(x))
        mix[s:e] += x[: e - s] * g

    length = duration - start
    bars = int(length / (beat * (3 if mood == "journey" else 4))) + 1

    if mood in ("launch", "showreel"):
        prog = PROG_MAJOR
        for b in range(bars):
            chord = prog[b % 4]
            t0 = b * 4 * beat
            for k in range(4):
                place(kick(), t0 + k * beat, 0.9)
                place(hat(seed + b * 8 + k, 0.16), t0 + k * beat + beat / 2)
                if mood == "showreel" and k % 2 == 1:
                    place(snare(seed + b * 4 + k, 0.45), t0 + k * beat)
            for k in range(8):  # rolling eighth-note bass, ducked under the kick
                place(
                    pluck(chord[0] - 24, beat / 2, 0.4) * (0.55 if k % 2 else 0.25),
                    t0 + k * beat / 2,
                    0.6,
                )
            for k in (1, 3) if mood == "launch" else (0, 1, 2, 3):
                for m in chord:
                    place(pluck(m, 0.35, 1.0), t0 + k * beat + beat * 0.5, 0.16)
            if mood == "showreel":
                arp = chord + [chord[1] + 12]
                for k in range(16):
                    place(pluck(arp[k % 4] + 12, 0.18, 1.2), t0 + k * beat / 4, 0.07)
                place(pad(chord, 4 * beat), t0, 0.12)
    elif mood == "recipe":
        prog = PROG_MAJOR
        for b in range(bars):
            chord = prog[b % 4]
            t0 = b * 4 * beat
            place(kick(0.7), t0)
            place(kick(0.5), t0 + 2.5 * beat)
            for k in range(8):
                swing = beat / 2 * (0.62 if k % 2 else 0)
                place(hat(seed + b * 8 + k, 0.08, 0.08), t0 + (k // 2) * beat + swing)
            for k, step in enumerate([0, 4, 7, 9]):
                place(pluck(chord[0] - 24 + step, beat, 0.2), t0 + k * beat, 0.45)
            for m in chord + [chord[0] + 11]:
                place(epiano(m, 4 * beat), t0, 0.14)
    elif mood == "versus":
        prog = PROG_ARCADE
        for b in range(bars):
            chord = prog[b % 4]
            t0 = b * 4 * beat
            for k in range(4):
                place(kick(0.8), t0 + k * beat)
                if k % 2:
                    place(snare(seed + b * 4 + k, 0.4), t0 + k * beat)
            for k in range(8):
                place(square(chord[0] - 12, beat / 2 * 0.9, 0.25), t0 + k * beat / 2, 0.09)
            for k in range(16):
                place(square(chord[k % 3] + 12, beat / 4 * 0.85, 0.5), t0 + k * beat / 4, 0.045)
    elif mood == "journey":
        prog = PROG_WALTZ
        melody = [72, 76, 79, 77, 76, 74, 72, 71, 72, 76, 79, 84]
        for b in range(bars):
            chord = prog[b % 4]
            t0 = b * 3 * beat
            place(pluck(chord[0] - 12, 0.5, 0.3), t0, 0.5)  # oom
            for k in (1, 2):  # pah pah
                for m in chord:
                    place(pluck(m, 0.25, 0.6), t0 + k * beat, 0.12)
            place(celesta(melody[b % len(melody)]), t0 + rng.choice([0, beat]), 0.22)
            place(pad([m - 12 for m in chord], 3 * beat), t0, 0.08)

    out = mix[: int(SR * duration)]
    fade = int(SR * 0.8)
    if len(out) > fade:
        out[-fade:] *= np.linspace(1, 0, fade)
    peak = float(np.max(np.abs(out))) or 1.0
    return np.tanh(out / peak * 1.2) * 0.6  # a bed sits under voice and effects


def write(path: Path, x: np.ndarray) -> None:
    st = (np.stack([x, x], 1) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(st.tobytes())


if __name__ == "__main__":
    mood, secs, out = sys.argv[1], float(sys.argv[2]), Path(sys.argv[3])
    bpm = int(sys.argv[4]) if len(sys.argv) > 4 else None
    seed = int(sys.argv[5]) if len(sys.argv) > 5 else 7
    write(out, compose(mood, secs, bpm, seed))
