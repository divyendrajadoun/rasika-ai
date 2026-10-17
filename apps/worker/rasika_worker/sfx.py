#!/usr/bin/env python3
"""
Procedural sound design for code videos — no samples, no API keys.
Builds a WAV from a cue list so every whoosh/impact lands exactly on the beat sheet.

Usage:
  python sfx.py cues.json -o sfx.wav
  python sfx.py --demo -o demo.wav

cues.json:
{
  "duration": 15,
  "bpm": 120,                 # optional pulse bed (kick + sub); omit or 0 for none
  "bed_gain": 0.5,
  "cues": [
    {"t": 2.3, "type": "whoosh", "dur": 0.4},
    {"t": 11.0, "type": "impact"},
    {"t": 6.2, "type": "tick", "repeat": 5, "every": 0.62},
    {"t": 9.0, "type": "riser", "dur": 1.5},
    {"t": 1.6, "type": "glitch", "dur": 0.35}
  ]
}
Types: whoosh, impact, tick, riser, glitch, pop, sub
Mix it under a real music track with ffmpeg amix if you have one; this is a placeholder-to-good bed.
"""

import argparse
import json
import wave

import numpy as np

SR = 48000


def env(n, a=0.01, r=0.2):
    t = np.linspace(0, 1, n)
    att = np.clip(t / max(a, 1e-4), 0, 1)
    return att * np.exp(-t / max(r, 1e-4))


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def lowpass(x, k):
    k = max(1, int(k))
    return np.convolve(x, np.ones(k) / k, mode="same")


def whoosh(d=0.45, seed=1):
    n = int(SR * d)
    t = np.linspace(0, 1, n)
    x = noise(n, seed)
    # sweep: blur window shrinks → brighter toward the peak, then darkens
    out = np.zeros(n)
    seg = 12
    for i in range(seg):
        s, e = i * n // seg, (i + 1) * n // seg
        bright = np.sin(np.pi * (i + 0.5) / seg)
        out[s:e] = lowpass(x, 40 - 34 * bright)[s:e]
    shape = np.sin(np.pi * t) ** 1.6
    return out * shape * 0.9


def impact(seed=2):
    n = int(SR * 1.2)
    t = np.arange(n) / SR
    f = 55 * np.exp(-t * 6) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    crack = lowpass(noise(n, seed), 3) * np.exp(-t * 40) * 0.6
    return body * 1.1 + crack


def tick(seed=3):
    n = int(SR * 0.06)
    t = np.arange(n) / SR
    return (
        np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.5
        + noise(n, seed) * np.exp(-t * 200) * 0.15
    )


def pop(seed=4):
    n = int(SR * 0.18)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 25) + 300
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * 0.7


def riser(d=1.5, seed=5):
    n = int(SR * d)
    t = np.linspace(0, 1, n)
    x = noise(n, seed)
    out = np.zeros(n)
    seg = 16
    for i in range(seg):
        s, e = i * n // seg, (i + 1) * n // seg
        out[s:e] = lowpass(x, 40 - 36 * i / seg)[s:e]
    tone = np.sin(2 * np.pi * np.cumsum(200 + 800 * t**2) / SR) * 0.25
    return (out * 0.7 + tone) * t**2


def glitch(d=0.35, seed=6):
    n = int(SR * d)
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    i = 0
    while i < n:
        L = int(rng.integers(300, 2200))
        f = rng.choice([180, 440, 1200, 3100])
        seg = np.sign(np.sin(2 * np.pi * f * np.arange(min(L, n - i)) / SR)) * rng.uniform(
            0.15, 0.45
        )
        if rng.random() < 0.3:
            seg *= 0
        out[i : i + len(seg)] = seg
        i += L
    return out


def sub(seed=7):
    n = int(SR * 0.9)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * 45 * t) * env(n, 0.02, 0.35) * 0.9


GEN = {
    "whoosh": whoosh,
    "impact": impact,
    "tick": tick,
    "pop": pop,
    "riser": riser,
    "glitch": glitch,
    "sub": sub,
}


def kick(seed=0):
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    f = 120 * np.exp(-t * 30) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def build(spec):
    dur = spec["duration"]
    N = int(SR * (dur + 1.5))
    mix = np.zeros(N)

    def place(x, t, g=1.0):
        s = int(t * SR)
        e = min(N, s + len(x))
        if s < N:
            mix[s:e] += x[: e - s] * g

    bpm = spec.get("bpm", 0)
    if bpm:
        beat = 60 / bpm
        g = spec.get("bed_gain", 0.5)
        k = 0
        while k * beat < dur:
            place(kick(), k * beat, g * (1.0 if k % 2 == 0 else 0.7))
            k += 1
        # low pad drone
        t = np.arange(N) / SR
        pad = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * 0.06 * g
        mix += pad
    for i, c in enumerate(spec.get("cues", [])):
        fn = GEN[c["type"]]
        kw = {"seed": 100 + i}
        if "dur" in c and c["type"] in ("whoosh", "riser", "glitch"):
            kw["d"] = c["dur"]
        x = fn(**kw)
        rep = c.get("repeat", 1)
        every = c.get("every", 0.5)
        for r in range(rep):
            # whoosh/riser are centred so the peak lands on t
            off = (
                len(x) / SR / 2
                if c["type"] == "whoosh"
                else (len(x) / SR if c["type"] == "riser" else 0)
            )
            place(x, c["t"] + r * every - off, c.get("gain", 1.0))
    mix = mix[: int(SR * dur)]
    fade = int(SR * 0.6)
    mix[-fade:] *= np.linspace(1, 0, fade)
    peak = np.max(np.abs(mix)) or 1
    mix = np.tanh(mix / peak * 1.4) * 0.89  # soft-clip glue
    return mix


def write(path, x):
    st = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cues", nargs="?")
    ap.add_argument("-o", "--out", default="sfx.wav")
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    spec = (
        {
            "duration": 8,
            "bpm": 120,
            "cues": [
                {"t": 1, "type": "whoosh"},
                {"t": 3, "type": "impact"},
                {"t": 4, "type": "tick", "repeat": 4, "every": 0.25},
                {"t": 7, "type": "riser", "dur": 1.5},
            ],
        }
        if a.demo
        else json.load(open(a.cues))
    )
    write(a.out, build(spec))
    print("wrote", a.out)
