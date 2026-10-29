#!/usr/bin/env python3
"""
SFX renderer (SPEC §6.3): a WAV from a cue list, every whoosh and hit on its frame.

The sounds are real recordings (sfx_lib/, public domain, found through Openverse and vetted by
tools/sfx/curate.py): several takes of each role, never the same take twice in a row, each nudged
in pitch and level, placed so a whoosh peaks on its cue, kept apart so they do not pile up, sat
under the voice (quieter while it speaks) and never pushed to full scale. A role with no
recordings falls back to the procedural sounds below; the music machine's notes and the pour are
always procedural.

The cue *types* are the engine's (whoosh impact tick pop riser glitch sub, plus the toon's thud
click scribble shimmer tap and the plain roles paper key shutter stamp popper chime swish); the
**kit** chosen by the style's `motion.sfxKit` decides which recordings each type plays:

  pop        the house kit — airy whoosh, pitched pop, sub impact (editorial, festive)
  click      soft UI: air swells, sine clicks, muted thuds (kinetic recap, clinic, wellness)
  marker     a marker on a board: scribbles, paper taps (whiteboard, collage)
  chalk      chalk ticks, soft air, shimmer (chalkboard)
  hype       zaps, bass drops, bright pops (retention cuts)
  cinematic  long swells, deep booms, shimmering risers (cinema, boardroom, launch films)
  none       silence

Usage:
  python -m rasika_worker.sfx cues.json out.wav

cues.json:
{
  "duration": 90.0,
  "kit": "pop",
  "voice": "voice.wav",        (optional: effects drop 4 dB while it speaks and sit under it)
  "cues": [
    {"t": 2.3, "type": "whoosh", "dur": 0.4},
    {"t": 3.0, "type": "pop"},
    {"t": 7.0, "type": "tick", "repeat": 8, "every": 0.12, "gain": 0.6},
    {"t": 60.5, "type": "riser", "dur": 1.5},
    {"t": 62.0, "type": "impact"}
  ]
}
"""

from __future__ import annotations

import json
import sys
import wave
from functools import cache
from pathlib import Path
from typing import Any

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


def highpass(x, k):
    return x - lowpass(x, k)


def _t(d):
    n = int(SR * d)
    return n, np.arange(n) / SR


# ── the house kit ──


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


def impact(d=None, seed=2):
    n, t = _t(1.2)
    f = 55 * np.exp(-t * 6) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.2)
    crack = lowpass(noise(n, seed), 3) * np.exp(-t * 40) * 0.6
    return body * 1.1 + crack


def tick(d=None, seed=3):
    n, t = _t(0.06)
    return (
        np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.5
        + noise(n, seed) * np.exp(-t * 200) * 0.15
    )


def pop(d=None, seed=4):
    n, t = _t(0.18)
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


def sub(d=None, seed=7):
    n, t = _t(0.9)
    return np.sin(2 * np.pi * 45 * t) * env(n, 0.02, 0.35) * 0.9


# ── soft / UI ──


def air(d=0.35, seed=8):
    """A breath of filtered noise — the quiet whoosh of a recap video."""
    n = int(SR * max(d, 0.1))
    t = np.linspace(0, 1, n)
    return lowpass(noise(n, seed), 18) * np.sin(np.pi * t) ** 2.2 * 0.5


def swell(d=0.7, seed=18):
    n = int(SR * max(d, 0.2))
    t = np.linspace(0, 1, n)
    x = lowpass(noise(n, seed), 26) * np.sin(np.pi * t) ** 1.4
    tone = np.sin(2 * np.pi * 110 * t * d) * np.sin(np.pi * t) ** 2 * 0.15
    return (x + tone) * 0.7


def click(d=None, seed=9):
    """A sine click: the sound of a UI element landing."""
    n, t = _t(0.05)
    return (
        np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 260)
        + 0.5 * np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 400)
    ) * 0.6 + noise(n, seed) * np.exp(-t * 600) * 0.08


def thud(d=None, seed=10):
    n, t = _t(0.3)
    f = 95 * np.exp(-t * 14) + 48
    return (
        np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * 0.9
        + lowpass(noise(n, seed), 6) * np.exp(-t * 90) * 0.25
    )


# ── board / paper ──


def scribble(d=0.3, seed=11):
    """A marker scribbling: bright noise chopped at hand speed."""
    n = int(SR * max(d, 0.12))
    t = np.arange(n) / SR
    tn = np.linspace(0, 1, n)
    x = highpass(noise(n, seed), 5)
    mod = np.abs(np.sin(2 * np.pi * 13 * t)) ** 0.6 * (
        0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 3.1 * t + 1))
    )
    return x * mod * np.sin(np.pi * tn) ** 0.8 * 0.45


def tap(d=None, seed=12):
    """A knuckle on the board / a card slapped on paper."""
    n, t = _t(0.07)
    return (
        lowpass(noise(n, seed), 9) * np.exp(-t * 110) * 0.9
        + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 70) * 0.35
    )


def chalk(d=None, seed=13):
    n, t = _t(0.06)
    return highpass(noise(n, seed), 3) * np.exp(-t * 95) * 0.4


# ── hype ──


def drop(d=0.55, seed=14):
    """A bass drop: pitch falls from 240 Hz to the sub."""
    n, t = _t(max(d, 0.2))
    f = 240 * np.exp(-t * 7) + 36
    return (
        np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 3.5)
        + lowpass(noise(n, seed), 4) * np.exp(-t * 50) * 0.4
    )


def zap(d=0.25, seed=15):
    n, t = _t(max(d, 0.1))
    f = 1900 * np.exp(-t * 14) + 260
    saw = 2 * ((np.cumsum(f) / SR) % 1) - 1
    return saw * np.exp(-t * 9) * 0.35 * env(n, 0.005, 0.5)


# ── cinematic ──


def shimmer(d=1.2, seed=16):
    """A detuned chord that swells in — the riser of a film trailer, not a game."""
    n = int(SR * max(d, 0.3))
    t = np.arange(n) / SR
    tn = np.linspace(0, 1, n)
    tones = sum(
        np.sin(2 * np.pi * f * t) * w for f, w in ((440, 1), (443.5, 0.8), (659, 0.5), (880.5, 0.3))
    )
    x = tones * 0.12 + lowpass(noise(n, seed), 30) * 0.25
    tail = np.ones(n)
    k = max(1, n // 10)
    tail[-k:] = np.linspace(1, 0, k)
    return x * tn**2.2 * tail


def boom(d=None, seed=17):
    n, t = _t(2.0)
    f = 52 * np.exp(-t * 2.5) + 34
    return (
        np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.9) * 1.1
        + lowpass(noise(n, seed), 3) * np.exp(-t * 30) * 0.5
    )


# ── kits: cue type → (generator, gain) ──

# ── tonal and liquid cues (brief films): the same in every kit ──


def note(pitch=0, seed=19):
    """A marimba-like struck note: `pitch` semitones above C5. The music machine's keys play these."""
    n, t = _t(1.1)
    f = 523.25 * 2 ** (pitch / 12)
    body = (
        np.sin(2 * np.pi * f * t) * np.exp(-t * 4.2)
        + 0.32 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 14)
        + 0.12 * np.sin(2 * np.pi * f * 9.9 * t) * np.exp(-t * 40)
    )
    attack = np.clip(t / 0.002, 0, 1)
    knock = noise(n, seed) * np.exp(-t * 300) * 0.08
    return (body * attack + knock) * 0.9


def pour(d=1.2, seed=20):
    """Liquid pouring into a glass: band-limited rush with bubbling, swelling in and settling."""
    n, t = _t(d + 0.25)
    rush = highpass(lowpass(noise(n, seed), 6), 70) * 0.5
    rng = np.random.default_rng(seed)
    bubbles = np.zeros(n)
    for _ in range(int(14 * d)):
        at = int(rng.uniform(0, d) * SR)
        f0 = rng.uniform(500, 1400)
        m, tt = _t(0.05)
        b = np.sin(2 * np.pi * (f0 + 3000 * tt) * tt) * np.exp(-tt * 70)
        e = min(n, at + m)
        bubbles[at:e] += b[: e - at] * 0.35
    shape = np.clip(t / 0.12, 0, 1) * np.clip((d + 0.25 - t) / 0.3, 0, 1)
    return (rush + bubbles) * shape


#: cue types every kit plays the same way (except the silent kit)
UNIVERSAL = {"note": (note, 1.0), "pour": (pour, 0.9)}

KITS = {
    "pop": {
        "whoosh": (whoosh, 1.0),
        "impact": (impact, 1.0),
        "tick": (tick, 1.0),
        "pop": (pop, 1.0),
        "riser": (riser, 1.0),
        "glitch": (glitch, 1.0),
        "sub": (sub, 1.0),
    },
    # toon explainers: a sound for everything that moves on screen
    "toon": {
        "whoosh": (whoosh, 0.8),
        "impact": (impact, 0.8),
        "tick": (click, 0.5),
        "pop": (pop, 1.0),
        "thud": (thud, 1.0),
        "click": (click, 1.0),
        "scribble": (scribble, 0.8),
        "shimmer": (shimmer, 0.6),
        "tap": (tap, 0.9),
        "riser": (riser, 0.7),
        # stand-ins when the library has no recordings of these
        "stamp": (thud, 1.0),
        "popper": (pop, 1.0),
        "key": (click, 0.5),
    },
    "click": {
        "whoosh": (air, 0.6),
        "impact": (thud, 0.7),
        "tick": (click, 0.6),
        "pop": (click, 0.8),
        "riser": (shimmer, 0.4),
        "glitch": (click, 0.5),
        "sub": (thud, 0.5),
    },
    "marker": {
        "whoosh": (scribble, 0.8),
        "impact": (tap, 1.0),
        "tick": (tap, 0.6),
        "pop": (scribble, 0.7),
        "riser": (air, 0.5),
        "glitch": (scribble, 0.6),
        "sub": (thud, 0.5),
    },
    "chalk": {
        "whoosh": (air, 0.4),
        "impact": (tap, 0.7),
        "tick": (chalk, 0.8),
        "pop": (chalk, 0.9),
        "riser": (shimmer, 0.3),
        "glitch": (chalk, 0.5),
        "sub": (thud, 0.4),
    },
    "hype": {
        "whoosh": (zap, 0.9),
        "impact": (drop, 1.0),
        "tick": (tick, 1.0),
        "pop": (pop, 1.1),
        "riser": (riser, 1.0),
        "glitch": (glitch, 1.0),
        "sub": (drop, 0.8),
    },
    "cinematic": {
        "whoosh": (swell, 0.7),
        "impact": (boom, 1.0),
        "tick": (click, 0.4),
        "pop": (air, 0.5),
        "riser": (shimmer, 0.8),
        "glitch": (air, 0.4),
        "sub": (boom, 0.7),
    },
    "none": {},
}
# generators whose peak should land on t (centred) and whose *end* should land on t (leading)
CENTRED = {whoosh, air, scribble, zap, swell}
LEADING = {riser, shimmer}
# the engine's cue types that carry a `dur`
TAKES_DUR = {whoosh, riser, glitch, air, swell, scribble, drop, zap, shimmer, pour}

GEN = {k: v[0] for k, v in KITS["pop"].items()}  # back-compat for callers of the old table


def kick(seed=0):
    n, t = _t(0.35)
    f = 120 * np.exp(-t * 30) + 45
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


# ── the real-sound library ──

LIB = Path(__file__).with_name("sfx_lib")

#: kit → cue type → (library role, level in dB). Types a kit does not name play their own role
#: at 0 dB when the library has it (paper, key, stamp …).
REAL = {
    "pop": {
        "whoosh": ("whoosh", -2), "impact": ("impact", 0), "tick": ("tick", -4), "pop": ("pop", 0),
        "riser": ("riser", -3), "glitch": ("glitch", -4), "sub": ("sub", -2),
    },
    "toon": {
        "whoosh": ("whoosh", -4), "impact": ("impact", -3), "tick": ("tick", -6), "pop": ("pop", -2),
        "thud": ("thud", -2), "click": ("click", -4), "scribble": ("scribble", -3),
        "shimmer": ("chime", -7), "tap": ("tap", -3), "riser": ("riser", -5),
    },
    "click": {
        "whoosh": ("swish", -6), "impact": ("thud", -3), "tick": ("click", -6), "pop": ("click", -3),
        "riser": ("chime", -9), "glitch": ("click", -6), "sub": ("thud", -5),
    },
    "marker": {
        "whoosh": ("paper", -2), "impact": ("tap", 0), "tick": ("tap", -5), "pop": ("scribble", -3),
        "riser": ("paper", -6), "glitch": ("scribble", -5), "sub": ("thud", -5),
    },
    "chalk": {
        "whoosh": ("paper", -6), "impact": ("tap", -3), "tick": ("tick", -3), "pop": ("tick", -2),
        "riser": ("chime", -9), "glitch": ("tick", -5), "sub": ("thud", -6),
    },
    "hype": {
        "whoosh": ("swish", 0), "impact": ("impact", 0), "tick": ("tick", 0), "pop": ("pop", 1),
        "riser": ("riser", 0), "glitch": ("glitch", -2), "sub": ("sub", -1),
    },
    "cinematic": {
        "whoosh": ("whoosh", -3), "impact": ("impact", 0), "tick": ("click", -8), "pop": ("tap", -6),
        "riser": ("riser", -2), "glitch": ("swish", -6), "sub": ("sub", -2),
    },
}  # fmt: skip
#: a role with no recordings borrows a close one
ALIAS = {
    "stamp": "thud",
    "popper": "pop",
    "shutter": "click",
    "key": "click",
    "tap": "thud",
    "paper": "swish",
}
#: roles placed so their peak lands on the cue, and so their end lands on it
PEAK_ON_CUE = {"whoosh", "swish", "paper"}
END_ON_CUE = {"riser"}
#: the closest two sounds of one role may be (s): closer ones are dropped, not stacked
MIN_GAP = {
    "whoosh": 0.7, "swish": 0.3, "impact": 1.5, "sub": 1.5, "riser": 3.0, "chime": 0.8,
    "thud": 0.25, "pop": 0.1, "stamp": 0.5, "popper": 2.0, "paper": 0.4, "scribble": 0.4,
}  # fmt: skip
#: at most this many sounds start in any one second (a run of ticks or keys counts once)
PER_SECOND = 3
#: which of two sounds close together plays: the higher number
PRIORITY = {
    "impact": 9, "sub": 8, "riser": 8, "popper": 7, "stamp": 7, "whoosh": 6, "swish": 6, "chime": 5,
    "thud": 5, "shutter": 5, "paper": 4, "scribble": 4, "pop": 3, "tap": 3, "click": 2, "key": 2,
    "tick": 1, "glitch": 2,
}  # fmt: skip
#: where a role at 0 dB sits (dBFS RMS of its loud part) before the mixer's own effects gain
NOMINAL_DB = -22.0


@cache
def library() -> dict[str, list[dict]]:
    """The manifest: role → takes ({file, dur, peak_t, …}). Empty without the library."""
    try:
        return json.loads((LIB / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


@cache
def _take(file: str) -> np.ndarray:
    with wave.open(str(LIB / file), "rb") as w:
        raw = w.readframes(w.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0


def _role(role: str, lib: dict[str, list[dict]]) -> str:
    return role if role in lib or ALIAS.get(role) not in lib else ALIAS[role]


def _repitch(x: np.ndarray, semis: float) -> np.ndarray:
    """Resample by a fraction of a semitone: a take never sounds twice the same."""
    if abs(semis) < 0.01:
        return x
    r = 2 ** (semis / 12)
    n = max(2, int(len(x) / r))
    return np.interp(np.arange(n) * r, np.arange(len(x)), x)


class _Picker:
    """Takes of a role in random order, never the same take twice in a row; a cue with a length
    prefers the takes closest to it."""

    def __init__(self, rng: np.random.Generator):
        self.rng = rng
        self.last: dict[str, str] = {}

    def __call__(self, role: str, want_dur: float | None = None) -> dict:
        takes = library()[role]
        pool = [t for t in takes if t["file"] != self.last.get(role)] or takes
        if want_dur:
            pool = sorted(pool, key=lambda t: abs(t["dur"] - want_dur))[: max(2, len(pool) // 2)]
        t = pool[int(self.rng.integers(len(pool)))]
        self.last[role] = t["file"]
        return t


def _speech(path: str | None) -> tuple[np.ndarray, float] | None:
    """The voice's loudness per 50 ms (dB) and the level of its loud part, or None."""
    if not path:
        return None
    try:
        with wave.open(str(path), "rb") as w:
            ch, sw, sr = w.getnchannels(), w.getsampwidth(), w.getframerate()
            raw = w.readframes(w.getnframes())
    except (OSError, wave.Error, EOFError):
        return None
    if sw != 2:
        return None
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    x = x.reshape(-1, ch).mean(axis=1) if ch > 1 else x
    hop = max(1, sr // 20)
    n = len(x) // hop
    if n == 0:
        return None
    db = 10 * np.log10(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    loud = db[db > db.max() - 20]
    return db, float(10 * np.log10(np.mean(10 ** (loud / 10))))


def build(spec: dict[str, Any]) -> np.ndarray:
    dur = spec["duration"]
    N = int(SR * (dur + 1.5))
    mix = np.zeros(N)
    kit_id = spec.get("kit") or "pop"
    kit = KITS.get(kit_id, KITS["pop"])
    real = REAL.get(kit_id, REAL["pop"]) if kit else {}
    lib = library() if kit else {}
    rng = np.random.default_rng(int(spec.get("seed", 7)))
    pick = _Picker(rng)
    speech = _speech(spec.get("voice"))
    # the voice decides where 0 dB sits: 1 dB under its loud part once the mixer's 0.45 is applied;
    # with the kit levels and the cues' own gains (softened: they were set for the old full-scale
    # track) the effects land about 11 dB under the voice
    nominal = speech[1] + 7 - 1 if speech else NOMINAL_DB

    def place(x, t, g=1.0):
        s = int(t * SR)
        e = min(N, s + len(x))
        if s < N and s + len(x) > 0:
            if s < 0:
                x = x[-s:]
                s = 0
                e = min(N, len(x))
            mix[s:e] += x[: e - s] * g

    def talking(t: float) -> bool:
        if speech is None:
            return False
        db, lvl = speech
        i = int(t * 20)
        seg = db[max(0, i - 2) : i + 3]
        return bool(len(seg)) and float(seg.max()) > lvl - 18

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
    # which cues sound: the important ones first (a hit over a whoosh over a pop), none closer than
    # 0.25 s to another, none closer than its role allows to the last of its kind, at most
    # PER_SECOND starting in any second (one fewer under a voice)
    cues = list(enumerate(spec.get("cues", [])))
    cap = PER_SECOND - 1 if speech else PER_SECOND
    kept: set[int] = set()
    taken: list[tuple[float, str]] = []
    for i, c in sorted(
        cues,
        key=lambda ic: (
            -PRIORITY.get(real.get(ic[1]["type"], (ic[1]["type"], 0))[0], 1),
            ic[1]["t"],
        ),
    ):
        role = _role(real.get(c["type"], (c["type"], 0))[0], lib)
        if role not in lib:
            kept.add(i)
            continue
        t0 = float(c["t"])
        near = [(t, r) for t, r in taken if abs(t0 - t) < 1.0]
        if any(abs(t0 - t) < 0.25 for t, _ in near):
            continue
        if any(r == role and abs(t0 - t) < MIN_GAP.get(role, 0.06) for t, r in near):
            continue
        if sum(1 for t, _ in near if t <= t0) >= cap or sum(1 for t, _ in near if t > t0) >= cap:
            continue
        taken.append((t0, role))
        kept.add(i)
    for i, c in sorted((ic for ic in cues if ic[0] in kept), key=lambda ic: ic[1]["t"]):
        typ = c["type"]
        role, lvl = real.get(typ, (typ, 0))
        role = _role(role, lib)
        if role in lib:
            t0 = float(c["t"])
            timed = role in PEAK_ON_CUE | END_ON_CUE
            take = pick(role, c.get("dur") if timed else None)
            src = _take(take["file"])
            x = _repitch(src, float(rng.uniform(-0.8, 0.8)))
            stretch = len(x) / max(1, len(src))
            want = c.get("dur")
            if want and not timed and len(x) > want * SR * 1.5:
                x = x[: int(want * SR * 1.5)].copy()
                k = min(len(x) // 3, int(0.05 * SR))
                x[-k:] *= np.linspace(1, 0, k)
            db = nominal - NOMINAL_DB + lvl + float(rng.uniform(-1.5, 1.5))
            if talking(t0):
                db -= 4
            gain = 10 ** (db / 20) * float(c.get("gain", 1.0)) ** 0.5
            if role in PEAK_ON_CUE:
                off = take["peak_t"] * stretch
            elif role in END_ON_CUE:
                off = len(x) / SR
            else:
                off = 0.0
            rep = int(c.get("repeat", 1))
            every = float(c.get("every", 0.5))
            for k in range(rep):
                if k:  # a run of ticks or keys: a fresh take each time
                    x = _repitch(_take(pick(role)["file"]), float(rng.uniform(-0.8, 0.8)))
                place(x, t0 + k * every - off, gain * (1.0 if k % 2 == 0 else 0.8))
            continue
        entry = kit.get(typ) or (UNIVERSAL.get(typ) if kit else None)
        if entry is None:
            continue
        fn, kit_gain = entry
        kw = {"seed": 100 + i}
        if "dur" in c and fn in TAKES_DUR:
            kw["d"] = c["dur"]
        if fn is note:
            kw["pitch"] = int(c.get("pitch", 0))
        x = fn(**kw)
        if lib and fn not in (note, pour):
            # a procedural stand-in among real sounds: down to the library's level
            x = x * 10 ** ((nominal - NOMINAL_DB - 6) / 20) * 0.2
        elif lib:
            x = x * 10 ** ((nominal - NOMINAL_DB) / 20) * 0.3
        rep = c.get("repeat", 1)
        every = c.get("every", 0.5)
        off = len(x) / SR / 2 if fn in CENTRED else (len(x) / SR if fn in LEADING else 0)
        for r_ in range(rep):
            place(x, c["t"] + r_ * every - off, c.get("gain", 1.0) * kit_gain)
    mix = mix[: int(SR * dur)]
    fade = int(SR * 0.6)
    if len(mix) > fade:
        mix[-fade:] *= np.linspace(1, 0, fade)
    if not lib:
        # the procedural kits alone: normalised and soft-clipped as they always were
        peak = np.max(np.abs(mix)) or 1
        return np.tanh(mix / peak * 1.4) * 0.89
    # real sounds keep their level; only peaks above -1 dBFS are rounded off
    over = np.abs(mix) > 0.89
    if over.any():
        mix[over] = np.sign(mix[over]) * (0.89 + 0.1 * np.tanh((np.abs(mix[over]) - 0.89) / 0.1))
    return mix


def write(path: str, x: np.ndarray) -> None:
    st = np.stack([x, x], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    spec = json.loads(open(sys.argv[1], encoding="utf-8").read())
    write(sys.argv[2], build(spec))
    print("wrote", sys.argv[2])
