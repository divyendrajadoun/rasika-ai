#!/usr/bin/env python3
"""
Turn Openverse candidates (fetch_openverse.py) into Rasika's real-sound library.

  measure   slice every candidate into single sounds and measure each one (length, attack, where it peaks,
            brightness, harshness, noise): .work-e2e/sfx/slices.json
  sheet     a contact sheet per role (spectrogram + waveform + numbers of the best slices) to look at
  build     process the picked slices (trim, fades, band, de-harsh, loudness per role) into
            apps/worker/rasika_worker/sfx_lib/ with manifest.json and CREDITS.md

Why each step: the sounds that "pinch" are bright noise with energy piled at 2.5-6 kHz (the ear's most
sensitive band) and no fall-off above it; a recording that starts after 200 ms of room noise lands late; two
whooshes from one file sound like one whoosh. The measurements catch these before anything is played.

  python tools/sfx/curate.py measure
  python tools/sfx/curate.py export                      # the best 30 slices per role, for earshot
  <earshot venv>/python tools/sfx/ears.py .work-e2e/sfx/slices
  python tools/sfx/curate.py pick                        # tools/sfx/picks.json
  python tools/sfx/curate.py sheet --role whoosh --top 24
  python tools/sfx/curate.py build
"""

from __future__ import annotations

import argparse
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000
ROOT = Path(__file__).resolve().parents[2]
CAND = ROOT / ".work-e2e" / "sfx" / "cand"
SLICES = ROOT / ".work-e2e" / "sfx" / "slices.json"
LIB = ROOT / "apps" / "worker" / "rasika_worker" / "sfx_lib"

#: what a good slice of each role looks like: length (s), attack (s), peak position (share of length),
#: brightness (Hz), the loudness it is stored at (dBFS RMS over its loud part) and the band it is kept in (Hz)
ROLES: dict[str, dict] = {
    "whoosh": {
        "dur": (0.35, 1.6),
        "attack": (0.06, 1.2),
        "peak": (0.2, 0.85),
        "bright": (350, 3200),
        "rms": -22,
        "band": (60, 11000),
    },
    "swish": {
        "dur": (0.1, 0.5),
        "attack": (0.02, 0.4),
        "peak": (0.15, 0.85),
        "bright": (700, 4500),
        "rms": -22,
        "band": (150, 12000),
    },
    "pop": {
        "dur": (0.04, 0.45),
        "attack": (0.0, 0.012),
        "peak": (0.0, 0.4),
        "bright": (250, 2600),
        "rms": -20,
        "band": (90, 9000),
    },
    "click": {
        "dur": (0.01, 0.2),
        "attack": (0.0, 0.006),
        "peak": (0.0, 0.4),
        "bright": (700, 5000),
        "rms": -22,
        "band": (200, 11000),
    },
    "tick": {
        "dur": (0.01, 0.15),
        "attack": (0.0, 0.006),
        "peak": (0.0, 0.4),
        "bright": (600, 4500),
        "rms": -24,
        "band": (250, 10000),
    },
    "tap": {
        "dur": (0.03, 0.35),
        "attack": (0.0, 0.01),
        "peak": (0.0, 0.4),
        "bright": (200, 2500),
        "rms": -20,
        "band": (70, 9000),
    },
    "thud": {
        "dur": (0.08, 0.7),
        "attack": (0.0, 0.025),
        "peak": (0.0, 0.4),
        "bright": (70, 900),
        "rms": -18,
        "band": (35, 6000),
    },
    "impact": {
        "dur": (0.5, 3.0),
        "attack": (0.0, 0.04),
        "peak": (0.0, 0.3),
        "bright": (60, 1500),
        "rms": -18,
        "band": (28, 9000),
    },
    "paper": {
        "dur": (0.15, 1.2),
        "attack": (0.0, 0.3),
        "peak": (0.0, 0.8),
        "bright": (600, 4500),
        "rms": -24,
        "band": (150, 11000),
    },
    "scribble": {
        "dur": (0.3, 2.0),
        "attack": (0.0, 0.3),
        "peak": (0.0, 0.9),
        "bright": (900, 5000),
        "rms": -26,
        "band": (200, 10000),
    },
    "chime": {
        "dur": (0.3, 2.5),
        "attack": (0.0, 0.03),
        "peak": (0.0, 0.35),
        "bright": (700, 4500),
        "rms": -24,
        "band": (200, 12000),
    },
    "riser": {
        "dur": (1.0, 4.0),
        "attack": (0.6, 4.0),
        "peak": (0.6, 1.0),
        "bright": (300, 4000),
        "rms": -24,
        "band": (50, 11000),
    },
    "sub": {
        "dur": (0.4, 2.5),
        "attack": (0.0, 0.08),
        "peak": (0.0, 0.4),
        "bright": (30, 350),
        "rms": -18,
        "band": (25, 2000),
    },
    "glitch": {
        "dur": (0.1, 0.8),
        "attack": (0.0, 0.05),
        "peak": (0.0, 0.9),
        "bright": (500, 5000),
        "rms": -26,
        "band": (100, 10000),
    },
    "key": {
        "dur": (0.02, 0.2),
        "attack": (0.0, 0.006),
        "peak": (0.0, 0.4),
        "bright": (500, 4500),
        "rms": -26,
        "band": (150, 10000),
    },
    "shutter": {
        "dur": (0.06, 0.6),
        "attack": (0.0, 0.01),
        "peak": (0.0, 0.6),
        "bright": (500, 5000),
        "rms": -24,
        "band": (150, 11000),
    },
    "stamp": {
        "dur": (0.05, 0.5),
        "attack": (0.0, 0.012),
        "peak": (0.0, 0.4),
        "bright": (150, 2500),
        "rms": -20,
        "band": (60, 9000),
    },
    "popper": {
        "dur": (0.2, 1.5),
        "attack": (0.0, 0.02),
        "peak": (0.0, 0.5),
        "bright": (500, 5000),
        "rms": -24,
        "band": (100, 11000),
    },
}


def decode(path: Path) -> np.ndarray:
    raw = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-ac",
            "1",
            "-ar",
            str(SR),
            "-f",
            "f32le",
            "-",
        ],
        capture_output=True,
        check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def frames_db(x: np.ndarray, hop: int = 240) -> np.ndarray:
    """RMS in dB per 5 ms."""
    n = len(x) // hop
    if n == 0:
        return np.array([-120.0])
    r = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(r)


def slices_of(x: np.ndarray, hop: int = 240) -> list[tuple[int, int, float]]:
    """Separate sounds in a recording: (start, end, noise floor dB). A gap of 150 ms below the threshold splits."""
    db = frames_db(x, hop)
    floor = float(np.percentile(db, 10))
    peak = float(db.max())
    if peak - floor < 18:  # all noise, or a continuous bed
        return []
    thr = max(floor + 12, peak - 40)
    on = db > thr
    out: list[tuple[int, int, float]] = []
    i, n = 0, len(db)
    while i < n:
        if not on[i]:
            i += 1
            continue
        s = i
        gap = 0
        j = i
        while j < n and gap < 30:  # 30 frames = 150 ms
            gap = 0 if on[j] else gap + 1
            j += 1
        e = j - gap
        # extend the tail down to 45 dB under the slice's peak (or the floor), so nothing is chopped
        sp = float(db[s:e].max())
        while e < n and db[e] > max(floor + 4, sp - 45):
            e += 1
        out.append((max(0, s * hop - hop), min(len(x), e * hop + hop), floor))
        i = e + 1
    return out


def features(seg: np.ndarray, floor_db: float) -> dict:
    db = frames_db(seg, 48)  # 1 ms
    pk = int(np.argmax(db))
    peak_db = float(db[pk])
    # attack: first frame within 20 dB of the peak to the peak
    first = int(np.argmax(db > peak_db - 20))
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    f = np.fft.rfftfreq(len(seg), 1 / SR)
    tot = spec.sum() + 1e-12
    bright = float((spec * f).sum() / tot)
    pinch = float(spec[(f >= 2500) & (f < 6000)].sum() / tot)
    air = float(spec[f >= 8000].sum() / tot)
    low = float(spec[f < 150].sum() / tot)
    loud = db > peak_db - 20
    return {
        "dur": round(len(seg) / SR, 3),
        "attack": round((pk - first) / 1000, 4),
        "peak": round(pk / max(1, len(db)), 3),
        "bright": round(bright),
        "pinch": round(pinch, 3),
        "air": round(air, 3),
        "low": round(low, 3),
        "snr": round(peak_db - floor_db, 1),
        "rms_loud": round(float(10 * np.log10(np.mean(10 ** (db[loud] / 10)))), 1),
    }


def score(role: str, ft: dict) -> float:
    """Higher is better: inside the role's ranges, clean, not harsh."""
    r = ROLES[role]
    s = 0.0
    for k in ("dur", "attack", "peak", "bright"):
        lo, hi = r[k]
        v = ft[k]
        if v < lo:
            s -= (lo - v) / max(hi - lo, 1e-3) * 4
        elif v > hi:
            s -= (v - hi) / max(hi - lo, 1e-3) * 4
    s -= max(0.0, ft["pinch"] - 0.25) * 8  # energy piled where the ear is most sensitive
    s -= max(0.0, ft["air"] - 0.15) * 6  # hiss
    s += min(ft["snr"], 60) / 20  # clean recordings
    return round(s, 3)


def cmd_measure(_a: argparse.Namespace) -> None:
    rows = []
    for role_dir in sorted(p for p in CAND.iterdir() if p.is_dir()):
        role = role_dir.name
        for meta_f in sorted(role_dir.glob("*.json")):
            if meta_f.name.startswith("_"):
                continue
            meta = json.loads(meta_f.read_text(encoding="utf-8"))
            audio = role_dir / meta["file"]
            if not audio.exists():
                continue
            try:
                x = decode(audio)
            except subprocess.CalledProcessError:
                continue
            if len(x) < SR * 0.01:
                continue
            for k, (s, e, floor) in enumerate(slices_of(x)[:6]):
                seg = x[s:e]
                if len(seg) < 240:
                    continue
                ft = features(seg, floor)
                rows.append(
                    {
                        "role": role,
                        "id": meta["id"],
                        "slice": k,
                        "start": round(s / SR, 3),
                        "end": round(e / SR, 3),
                        **ft,
                        "score": score(role, ft),
                    }
                )
        print(role, sum(1 for r in rows if r["role"] == role), "slices")
    SLICES.write_text(json.dumps(rows, indent=0), encoding="utf-8")
    print("wrote", SLICES, len(rows))


def cmd_sheet(a: argparse.Namespace) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    rows = [r for r in json.loads(SLICES.read_text(encoding="utf-8")) if r["role"] == a.role]
    rows.sort(key=lambda r: -r["score"])
    rows = rows[: a.top]
    cols = 4
    n = (len(rows) + cols - 1) // cols
    fig, axes = plt.subplots(
        n * 2,
        cols,
        figsize=(cols * 3.4, n * 3.0),
        gridspec_kw={"height_ratios": [2, 1] * n},
    )
    axes = np.atleast_2d(axes)
    for i, r in enumerate(rows):
        meta = json.loads((CAND / a.role / f"{r['id']}.json").read_text(encoding="utf-8"))
        x = decode(CAND / a.role / meta["file"])[int(r["start"] * SR) : int(r["end"] * SR)]
        ax = axes[(i // cols) * 2, i % cols]
        ax.specgram(x + 1e-9, NFFT=512, Fs=SR, noverlap=384, cmap="magma", vmin=-130)
        ax.set_ylim(0, 16000)
        ax.set_title(f"#{i} {r['id'][:6]}/{r['slice']} s={r['score']}", fontsize=7)
        ax.tick_params(labelsize=5)
        ax2 = axes[(i // cols) * 2 + 1, i % cols]
        ax2.plot(np.arange(len(x)) / SR, x, lw=0.4)
        ax2.set_title(
            f"{r['dur']}s att{r['attack']} pk{r['peak']} br{r['bright']} pinch{r['pinch']} air{r['air']} snr{r['snr']}",
            fontsize=5.5,
        )
        ax2.tick_params(labelsize=5)
    for j in range(len(rows), n * cols):
        axes[(j // cols) * 2, j % cols].axis("off")
        axes[(j // cols) * 2 + 1, j % cols].axis("off")
    fig.tight_layout()
    out = ROOT / ".work-e2e" / "sfx" / f"sheet_{a.role}.png"
    fig.savefig(out, dpi=110)
    (ROOT / ".work-e2e" / "sfx" / f"sheet_{a.role}.json").write_text(
        json.dumps(rows, indent=0), encoding="utf-8"
    )
    print("wrote", out)


def _band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    from scipy.signal import butter, sosfiltfilt

    sos = butter(2, [lo, min(hi, SR / 2 - 100)], btype="band", fs=SR, output="sos")
    return sosfiltfilt(sos, x)


def _deharsh(x: np.ndarray) -> np.ndarray:
    """A gentle 3 dB dip at 3.5 kHz (Q ~1): takes the pinch out without dulling the attack."""
    from scipy.signal import lfilter

    f0, q, gain_db = 3500.0, 1.0, -3.0
    amp = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * amp, -2 * np.cos(w0), 1 - al * amp])
    a = np.array([1 + al / amp, -2 * np.cos(w0), 1 - al / amp])
    return lfilter(b / a[0], a / a[0], x)


def cmd_build(a: argparse.Namespace) -> None:
    picks = json.loads(Path(a.picks).read_text(encoding="utf-8"))
    rows = {
        (r["role"], r["id"], r["slice"]): r for r in json.loads(SLICES.read_text(encoding="utf-8"))
    }
    LIB.mkdir(parents=True, exist_ok=True)
    for old in LIB.glob("*.wav"):
        old.unlink()
    manifest: dict[str, list[dict]] = {}
    credits = []
    for role, items in picks.items():
        spec = ROLES[role]
        for n, it in enumerate(items):
            r = rows[(role, it["id"], it.get("slice", 0))]
            meta = json.loads((CAND / role / f"{r['id']}.json").read_text(encoding="utf-8"))
            x = decode(CAND / role / meta["file"])
            s = int((r["start"] + it.get("trim_in", 0.0)) * SR)
            e = int((it.get("end") or r["end"]) * SR)
            seg = x[s:e].copy()
            seg = _band(seg, *spec["band"])
            if r["pinch"] > 0.18 or it.get("deharsh"):
                seg = _deharsh(seg)
            # start on the sound: drop what is more than 30 dB under the peak before the first loud ms
            db = frames_db(seg, 48)
            first = int(np.argmax(db > db.max() - 30))
            seg = seg[max(0, first * 48 - 48) :]
            fin = min(len(seg), int(0.002 * SR))
            seg[:fin] *= np.linspace(0, 1, fin)
            fout = min(len(seg) // 3, int(0.04 * SR))
            seg[-fout:] *= np.linspace(1, 0, fout) ** 2
            # loudness per role, measured over the loud part, then a peak ceiling of -3 dBFS
            db = frames_db(seg, 48)
            loud = db > db.max() - 20
            cur = float(10 * np.log10(np.mean(10 ** (db[loud] / 10))))
            seg *= 10 ** ((spec["rms"] - cur) / 20)
            pk = float(np.max(np.abs(seg)))
            if pk > 0.708:
                seg *= 0.708 / pk
            name = f"{role}_{n + 1:02d}.wav"
            with wave.open(str(LIB / name), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SR)
                w.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
            db = frames_db(seg, 48)
            manifest.setdefault(role, []).append(
                {
                    "file": name,
                    "dur": round(len(seg) / SR, 3),
                    # where the sound's peak is (s): a whoosh is placed so its peak lands on the cue
                    "peak_t": round(int(np.argmax(db)) / 1000, 3),
                    "source": meta["foreign_landing_url"],
                    "creator": meta["creator"],
                    "license": meta["license"],
                    "title": meta["title"],
                }
            )
            credits.append(
                f"| {name} | {meta['title']} | {meta['creator']} | {meta['license'].upper()} | {meta['foreign_landing_url']} |"
            )
    (LIB / "manifest.json").write_text(json.dumps(manifest, indent=1), encoding="utf-8")
    (LIB / "CREDITS.md").write_text(
        "# Sound credits\n\nEvery sound here is a real recording found through Openverse (openverse.org), released into "
        "the public domain (CC0 or the Public Domain Mark): free to use in any reel, no credit required. Thank you to "
        "the people who recorded them.\n\n| file | title | by | licence | source |\n| --- | --- | --- | --- | --- |\n"
        + "\n".join(credits)
        + "\n",
        encoding="utf-8",
    )
    print("wrote", sum(len(v) for v in manifest.values()), "sounds to", LIB)


EXPORT = ROOT / ".work-e2e" / "sfx" / "slices"
#: how many takes of each role the library keeps
KEEP = {"whoosh": 10, "swish": 6, "pop": 8, "click": 6, "tick": 6, "tap": 6, "thud": 6, "impact": 5, "paper": 6,
        "scribble": 5, "chime": 6, "riser": 4, "sub": 4, "glitch": 4, "key": 8, "shutter": 3, "stamp": 4, "popper": 3}  # fmt: skip


def cmd_export(a: argparse.Namespace) -> None:
    """The best slices of each role by measurement, as WAVs for earshot to listen to (ears.py)."""
    rows = json.loads(SLICES.read_text(encoding="utf-8"))
    for role in ROLES:
        mine = sorted((r for r in rows if r["role"] == role), key=lambda r: -r["score"])[: a.top]
        d = EXPORT / role
        d.mkdir(parents=True, exist_ok=True)
        for old in d.glob("*.wav"):
            old.unlink()
        for r in mine:
            meta = json.loads((CAND / role / f"{r['id']}.json").read_text(encoding="utf-8"))
            x = decode(CAND / role / meta["file"])[int(r["start"] * SR) : int(r["end"] * SR)]
            with wave.open(str(d / f"{r['id']}_{r['slice']}.wav"), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(SR)
                w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
        print(role, len(mine))


#: what earshot's "sounds most like" says when a slice is the right kind of sound
LIKE = {
    "whoosh": ("whoosh", "swung", "swoosh", "swipe"),
    "swish": ("whoosh", "swung", "swish", "swipe", "whip"),
    "pop": ("pop", "bubble", "cork", "pluck", "drip"),
    "click": ("click", "button", "switch"),
    "tick": ("tick", "click", "clock", "tap"),
    "tap": ("tap", "knock", "wood", "knuckle"),
    "thud": ("thud", "thump", "knock", "drop", "landing", "kick"),
    "impact": ("impact", "hit", "boom", "slam"),
    "paper": ("paper", "page", "sheet", "rustl"),
    "scribble": ("writ", "scribbl", "pen", "pencil", "marker", "chalk"),
    "chime": ("chime", "bell", "ding", "glocken", "ting", "celesta"),
    "riser": ("rising", "riser", "build", "swell"),
    "sub": ("bass", "sub", "boom", "drop", "rumble"),
    "glitch": ("glitch", "digital", "static"),
    "key": ("key", "typing", "keyboard", "typewriter"),
    "shutter": ("shutter", "camera"),
    "stamp": ("stamp", "thud", "knock", "slam"),
    "popper": ("popper", "pop", "confetti", "burst"),
}


def cmd_pick(a: argparse.Namespace) -> None:
    """picks.json from the measurements and earshot's ears: a slice must sound like its role (earshot z) and be a
    real recording; the rest is ordered by measured fit; one slice per source recording, at most two per creator."""
    rows = json.loads(SLICES.read_text(encoding="utf-8"))
    ears = json.loads((EXPORT / "ears.json").read_text(encoding="utf-8"))
    picks: dict[str, list[dict]] = {}
    report = []
    for role in ROLES:
        cands = []
        for r in rows:
            e = ears.get(f"{role}/{r['id']}_{r['slice']}.wav")
            if r["role"] != role or not e:
                continue
            fits = e["verdict"] in ("strong", "plausible") or any(
                w in e["like"] for w in LIKE[role]
            )
            if not fits or (e["p_real"] is not None and e["p_real"] < 0.35):
                continue
            total = r["score"] + 0.6 * float(e["z"]) + (float(e["p_real"] or 0.5) - 0.5) * 2
            cands.append((total, r, e))
        cands.sort(key=lambda c: -c[0])
        seen_src: set[str] = set()
        by_creator: dict[str, int] = {}
        out = []
        for total, r, e in cands:
            meta = json.loads((CAND / role / f"{r['id']}.json").read_text(encoding="utf-8"))
            who = str(meta.get("creator"))
            if r["id"] in seen_src or by_creator.get(who, 0) >= 2:
                continue
            seen_src.add(r["id"])
            by_creator[who] = by_creator.get(who, 0) + 1
            out.append({"id": r["id"], "slice": r["slice"]})
            report.append(
                f"{role:8s} {total:6.2f} z{e['z']:+.1f} real{e['p_real']} {r['dur']}s br{r['bright']} pinch{r['pinch']}  {meta['title'][:40]} ({who})  ~ {e['like'][:50]}"
            )
            if len(out) >= KEEP[role]:
                break
        picks[role] = out
        print(f"{role}: {len(out)} of {len(cands)} that pass")
    Path(a.out).write_text(json.dumps(picks, indent=1), encoding="utf-8")
    (ROOT / ".work-e2e" / "sfx" / "picks_report.txt").write_text(
        "\n".join(report), encoding="utf-8"
    )
    print("wrote", a.out)


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("measure")
    s = sub.add_parser("sheet")
    s.add_argument("--role", required=True)
    s.add_argument("--top", type=int, default=24)
    e = sub.add_parser("export")
    e.add_argument("--top", type=int, default=30)
    pk = sub.add_parser("pick")
    pk.add_argument("--out", default=str(Path(__file__).with_name("picks.json")))
    b = sub.add_parser("build")
    b.add_argument("--picks", default=str(Path(__file__).with_name("picks.json")))
    a = ap.parse_args()
    {
        "measure": cmd_measure,
        "sheet": cmd_sheet,
        "export": cmd_export,
        "pick": cmd_pick,
        "build": cmd_build,
    }[a.cmd](a)


if __name__ == "__main__":
    main()
