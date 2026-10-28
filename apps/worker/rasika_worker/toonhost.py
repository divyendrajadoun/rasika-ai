"""
The host of a toon explainer: a half-length cartoon presenter drawn in SVG, standing in the bottom
right of the frame like the creator in the "AI-animated reels" format. Drawn, not generated, so it
can move: the arms tween between poses (point up, present, both hands up, shrug, think, thumbs up,
wave, calm), the mouth follows the loudness of the voice, the eyes blink, the body breathes.

  HOSTS            the built-in hosts (look parameters)
  svg(host)        the markup: a <svg> whose parts carry ids the timeline animates
  POSES            arm angles + hand shape for every pose
  mouth_track()    the voice's loudness → a mouth shape (0 shut, 1 half, 2 open) per frame

Coordinates: viewBox -110 0 820 760 (room for the arms), the head centred at (300, 250), the shoulders at y 500; the
frame cuts the body at the bottom. Angles are degrees, 0 = the arm hanging straight down,
positive = away from the body and up (each side is mirrored).
"""

from __future__ import annotations

import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

INK = "#2a211c"


@dataclass(frozen=True)
class Host:
    id: str
    name: str
    skin: str
    skin_shade: str
    hair: str  # beanie | short | long | bun | curly
    hair_color: str
    beard: bool
    glasses: bool
    top: str  # the jacket / cardigan
    top_shade: str
    tee: str
    hat: str = "#34343a"
    voice: str = "aura-2-apollo-en"


HOSTS: dict[str, Host] = {
    "arjun": Host(
        "arjun", "Arjun", "#f0c4a0", "#d9a27c", "beanie", "#3a2a20", True, True,
        "#8c7d70", "#6f6156", "#f6f3ee", voice="aura-2-apollo-en",
    ),
    "meera": Host(
        "meera", "Meera", "#d9a07a", "#bf825d", "long", "#241a16", False, False,
        "#c2571b", "#9c4314", "#f6f3ee", voice="aura-2-thalia-en",
    ),
    "kabir": Host(
        "kabir", "Kabir", "#c98d65", "#ab7049", "short", "#1d1714", True, False,
        "#2f4a6b", "#22374f", "#f6f3ee", voice="aura-2-orion-en",
    ),
    "zoe": Host(
        "zoe", "Zoe", "#f3d0b4", "#dcae8c", "curly", "#7a3b1e", False, True,
        "#3f6b4f", "#2e5039", "#f6f3ee", voice="aura-2-luna-en",
    ),
}  # fmt: skip

DEFAULT_HOST = "arjun"

#: pose → (right upper, right fore, right hand, left upper, left fore, left hand). "right" is the
#: host's right (the viewer's left). Hands: point, palm, thumb, fist, wave.
POSES: dict[str, tuple[float, float, str, float, float, str]] = {
    "calm": (8, 10, "fist", 8, 10, "fist"),
    "point": (38, 132, "point", 10, 14, "fist"),
    "present": (52, 44, "palm", 8, 12, "fist"),
    "both": (70, 95, "palm", 70, 95, "palm"),
    "shrug": (30, 70, "palm", 30, 70, "palm"),
    "think": (22, 150, "fist", 8, 12, "fist"),
    "thumbs": (30, 118, "thumb", 10, 14, "fist"),
    "wave": (48, 140, "wave", 8, 12, "fist"),
    "explain": (30, 92, "palm", 8, 12, "fist"),
}
POSE_NAMES = tuple(POSES)

SHOULDER_R = (172, 520)  # the host's right shoulder (viewer's left)
SHOULDER_L = (428, 520)
UPPER = 150
FORE = 128


def _hand(kind: str, skin: str, shade: str) -> str:
    """A hand at the end of a forearm pointing down the local +y axis (origin = the wrist)."""
    s = f'fill="{skin}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"'
    if kind == "point":
        return (
            f'<path d="M-22 4 Q-26 34 -10 44 L14 44 Q26 36 24 10 Q20 0 0 0 Z" {s}/>'
            f'<path d="M-6 40 L-6 92 Q0 102 8 92 L10 40" {s}/>'
            f'<path d="M14 18 Q34 22 30 36" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        )
    if kind == "thumb":
        return (
            f'<path d="M-24 4 Q-28 40 -8 48 L16 48 Q30 40 26 10 Q20 0 0 0 Z" {s}/>'
            f'<path d="M8 40 Q2 70 10 86 Q22 94 28 82 Q30 62 24 40" {s}/>'
            f'<path d="M-14 24 L16 24 M-14 36 L14 36" stroke="{shade}" stroke-width="4" stroke-linecap="round"/>'
        )
    if kind in ("palm", "wave"):
        fingers = "".join(
            f'<path d="M{x} 30 Q{x - 4 + dx} {64 + dy} {x + dx} {80 + dy} Q{x + 8 + dx} {86 + dy} {x + 10} 32" {s}/>'
            for x, dx, dy in ((-22, -10, -6), (-8, -4, 4), (6, 2, 4), (18, 8, -6))
        )
        return (
            f"{fingers}"
            f'<path d="M-26 0 Q-30 40 -12 46 L18 46 Q32 38 28 2 Q20 -6 0 -6 Z" {s}/>'
            f'<path d="M26 10 Q50 14 52 34 Q48 42 38 34 Q30 26 22 26" {s}/>'
        )
    # a relaxed fist
    return (
        f'<path d="M-22 2 Q-26 38 -6 46 L14 46 Q28 38 24 6 Q18 -2 0 -2 Z" {s}/>'
        f'<path d="M-12 22 L12 22 M-12 34 L12 34" stroke="{shade}" stroke-width="4" stroke-linecap="round"/>'
    )


def _arm(side: str, h: Host) -> str:
    """An arm whose upper part turns at the shoulder and forearm at the elbow (ids the timeline
    rotates); every hand shape is drawn and only the pose's one is shown."""
    x, y = SHOULDER_R if side == "r" else SHOULDER_L
    sleeve = f'fill="{h.top}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"'
    hands = "".join(
        f'<g id="hand_{side}_{k}" class="hand" opacity="{1 if k == "fist" else 0}">{_hand(k, h.skin, h.skin_shade)}</g>'
        for k in ("fist", "point", "palm", "thumb", "wave")
    )
    # local frame: shoulder at (0,0), the arm hanging along +y; a mirrored copy for the left
    flip = "" if side == "r" else ' transform="scale(-1,1)"'
    return (
        f'<g transform="translate({x},{y})"><g{flip}>'
        f'<g id="up_{side}">'
        f'<path d="M-34 -10 Q-40 {UPPER / 2} -30 {UPPER + 4} L30 {UPPER + 4} Q36 {UPPER / 2} 32 -14 Z" {sleeve}/>'
        f'<g id="fo_{side}" transform="translate(0,{UPPER})">'
        f'<path d="M-30 -6 Q-32 {FORE / 2} -24 {FORE} L24 {FORE} Q30 {FORE / 2} 30 -6 Z" {sleeve}/>'
        f'<path d="M-24 {FORE - 14} L24 {FORE - 14}" stroke="{h.top_shade}" stroke-width="6"/>'
        f'<g transform="translate(0,{FORE - 2}) scale(1.3)">{hands}</g>'
        f"</g></g></g></g>"
    )


def _hair_back(h: Host) -> str:
    if h.hair == "long":
        return (
            f'<path d="M168 230 Q150 420 190 520 L410 520 Q450 420 432 230 Q420 110 300 104 Q180 110 168 230 Z" '
            f'fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
        )
    if h.hair == "curly":
        bumps = "".join(
            f'<circle cx="{300 + 135 * np.cos(a):.0f}" cy="{235 + 140 * np.sin(a):.0f}" r="44" fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
            for a in np.linspace(np.pi * 0.95, np.pi * 2.05, 11)
        )
        return bumps
    return ""


def _hair_front(h: Host) -> str:
    if h.hair == "beanie":
        ribs = "".join(
            f'<path d="M{x} 184 L{x} 222" stroke="#232327" stroke-width="4"/>'
            for x in range(190, 420, 16)
        )
        return (
            f'<path d="M176 200 Q170 92 300 84 Q430 92 424 200 Z" fill="{h.hat}" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M210 120 Q300 100 390 122" fill="none" stroke="#45454c" stroke-width="5" stroke-linecap="round"/>'
            f'<rect x="168" y="176" width="264" height="52" rx="22" fill="{h.hat}" stroke="{INK}" stroke-width="5"/>'
            f"{ribs}"
            f'<rect x="222" y="190" width="30" height="16" rx="3" fill="#d6322b" stroke="{INK}" stroke-width="3"/>'
        )
    if h.hair == "short":
        return (
            f'<path d="M180 222 Q172 120 300 108 Q428 120 420 222 Q400 160 300 158 Q200 160 180 222 Z" '
            f'fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
        )
    if h.hair == "bun":
        return (
            f'<circle cx="300" cy="96" r="44" fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M178 230 Q172 120 300 112 Q428 120 422 230 Q396 150 300 154 Q204 150 178 230 Z" '
            f'fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
        )
    if h.hair == "long":
        return (
            f'<path d="M180 236 Q176 120 300 112 Q424 120 420 236 Q380 150 300 160 Q236 168 180 236 Z" '
            f'fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
        )
    if h.hair == "curly":
        return (
            f'<path d="M184 226 Q176 124 300 116 Q424 124 416 226 Q390 168 300 166 Q210 168 184 226 Z" '
            f'fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
        )
    return ""


def svg(host: Host | str = DEFAULT_HOST) -> str:
    """The host's markup: `#host` (breathes), `#armr`/`#arml` parts, `#eyes` (blinks),
    `#mouth0..2` (talks), `#brows` (raises)."""
    h = HOSTS.get(host, HOSTS[DEFAULT_HOST]) if isinstance(host, str) else host
    sk = f'fill="{h.skin}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"'
    beard = ""
    if h.beard:
        beard = (
            f'<path d="M176 262 Q178 360 236 404 Q270 430 300 432 Q330 430 364 404 Q422 360 424 262 '
            f'Q408 330 380 326 Q350 300 300 304 Q250 300 220 326 Q192 330 176 262 Z" fill="{h.hair_color}" stroke="{INK}" stroke-width="5"/>'
            f'<path d="M244 318 Q272 300 300 310 Q328 300 356 318 Q330 326 300 322 Q270 326 244 318 Z" fill="{h.hair_color}" stroke="{INK}" stroke-width="4"/>'
        )
    glasses = ""
    if h.glasses:
        glasses = (
            '<g fill="none" stroke="#1b1512" stroke-width="7">'
            '<circle cx="254" cy="256" r="36"/><circle cx="346" cy="256" r="36"/>'
            '<path d="M290 252 Q300 244 310 252"/><path d="M218 250 L182 240"/><path d="M382 250 L418 240"/></g>'
            '<path d="M232 236 Q244 228 256 230" stroke="#fff" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>'
        )
    lips = "#a2402f"
    mouths = (
        f'<g id="mouth0"><path d="M274 338 Q300 358 326 338 Q300 346 274 338 Z" fill="{lips}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/></g>'
        f'<g id="mouth1" opacity="0"><path d="M274 334 Q300 362 326 334 Q300 342 274 334 Z" fill="{lips}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
        f'<path d="M282 337 Q300 341 318 337" stroke="#fff" stroke-width="5" fill="none"/></g>'
        f'<g id="mouth2" opacity="0"><path d="M270 330 Q300 382 330 330 Q300 340 270 330 Z" fill="{lips}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
        f'<path d="M280 334 Q300 340 320 334" stroke="#fff" stroke-width="6" fill="none"/>'
        f'<path d="M288 362 Q300 352 312 362" fill="#e07a6a"/></g>'
    )
    torso = (
        # the tee, the jacket's two fronts, the neck
        f'<path d="M250 420 L350 420 L360 470 L240 470 Z" {sk}/>'
        f'<path d="M120 560 Q130 480 196 462 L404 462 Q470 480 480 560 L500 780 L100 780 Z" fill="{h.tee}" stroke="{INK}" stroke-width="5"/>'
        f'<path d="M120 560 Q130 480 196 462 L244 456 Q262 560 252 780 L100 780 Z" fill="{h.top}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
        f'<path d="M480 560 Q470 480 404 462 L356 456 Q338 560 348 780 L500 780 Z" fill="{h.top}" stroke="{INK}" stroke-width="5" stroke-linejoin="round"/>'
        f'<path d="M150 600 Q190 640 236 620" fill="none" stroke="{h.top_shade}" stroke-width="6" stroke-linecap="round"/>'
        f'<path d="M450 600 Q410 640 364 620" fill="none" stroke="{h.top_shade}" stroke-width="6" stroke-linecap="round"/>'
    )
    head = (
        f'<ellipse cx="180" cy="270" rx="22" ry="30" {sk}/><ellipse cx="420" cy="270" rx="22" ry="30" {sk}/>'
        f'<path d="M180 230 Q178 120 300 116 Q422 120 420 230 Q424 330 380 390 Q340 432 300 434 '
        f'Q260 432 220 390 Q176 330 180 230 Z" {sk}/>'
        f'<path d="M392 250 Q404 320 372 380 Q356 400 340 410 Q396 360 392 250 Z" fill="{h.skin_shade}" opacity=".55"/>'
        f"{beard}"
        f'<path d="M292 270 Q286 300 296 306 Q304 308 310 300" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        f'<g id="brows"><path d="M222 208 Q250 194 280 206" fill="none" stroke="{h.hair_color if h.hair != "beanie" else "#2b2019"}" stroke-width="11" stroke-linecap="round"/>'
        f'<path d="M320 206 Q350 194 378 208" fill="none" stroke="{h.hair_color if h.hair != "beanie" else "#2b2019"}" stroke-width="11" stroke-linecap="round"/></g>'
        f'<g id="eyes"><circle cx="254" cy="258" r="10" fill="{INK}"/><circle cx="346" cy="258" r="10" fill="{INK}"/>'
        f'<circle cx="258" cy="254" r="3.5" fill="#fff"/><circle cx="350" cy="254" r="3.5" fill="#fff"/></g>'
        f"{glasses}"
        f"{mouths}"
        f'<ellipse cx="226" cy="306" rx="18" ry="9" fill="#e58f7a" opacity="{0 if h.beard else 0.45}"/>'
        f'<ellipse cx="374" cy="306" rx="18" ry="9" fill="#e58f7a" opacity="{0 if h.beard else 0.45}"/>'
    )
    return (
        f'<svg class="hostsvg" viewBox="-110 0 820 760" width="820" height="760" xmlns="http://www.w3.org/2000/svg">'
        f'<g id="host">'
        f"{_hair_back(h)}"
        f"{torso}"
        f'<g id="armr">{_arm("r", h)}</g><g id="arml">{_arm("l", h)}</g>'
        f'<g id="headg">{head}{_hair_front(h)}</g>'
        f"</g></svg>"
    )


def pose_tweens(name: str, at: float, dur: float = 0.38, instant: bool = False) -> list[str]:
    """GSAP calls that move the arms to `name` at time `at` (the hand shape swaps mid-move)."""
    ru, rf, rh, lu, lf, lh = POSES.get(name, POSES["calm"])
    out = []
    for side, up, fo, hand in (("r", ru, rf, rh), ("l", lu, lf, lh)):
        d = 0.0 if instant else dur
        ease = "back.out(1.6)"
        out.append(
            f'tl.to("#up_{side}",{{rotation:{up},svgOrigin:"0 0",duration:{d},ease:"{ease}"}},{at:.3f});'
        )
        out.append(
            f'tl.to("#fo_{side}",{{rotation:{fo},svgOrigin:"0 {UPPER}",duration:{d},ease:"{ease}"}},{at:.3f});'
        )
        swap = at + (0 if instant else d * 0.35)
        out.append(f'tl.set("#arm{side} .hand",{{opacity:0}},{swap:.3f});')
        out.append(f'tl.set("#hand_{side}_{hand}",{{opacity:1}},{swap:.3f});')
    return out


def mouth_track(wav: Path, fps: int = 30, duration: float | None = None) -> list[int]:
    """Loudness of the voice per frame → 0 (shut), 1 (half), 2 (open), with a little hold so the
    mouth does not flutter."""
    with wave.open(str(wav), "rb") as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        raw = w.readframes(n)
        width = w.getsampwidth()
    dtype = {2: np.int16, 4: np.int32}.get(width, np.int16)
    x = np.frombuffer(raw, dtype=dtype).astype(np.float32)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    hop = sr // fps
    frames = int(np.ceil((duration if duration else len(x) / sr) * fps))
    rms = np.array(
        [float(np.sqrt(np.mean(x[i * hop : (i + 1) * hop] ** 2) + 1e-9)) for i in range(frames)]
    )
    talk = rms[rms > np.percentile(rms, 30)] if len(rms) else rms
    ref = float(np.percentile(talk, 80)) if len(talk) else 1.0
    lv = rms / max(ref, 1e-6)
    out: list[int] = []
    for i, v in enumerate(lv):
        m = 2 if v > 0.75 else 1 if v > 0.28 else 0
        # alternate open/half on long vowels so a held sound still looks like talking
        if m == 2 and i % 6 in (4, 5):
            m = 1
        out.append(m)
    # hold each shape at least 2 frames
    for i in range(1, len(out) - 1):
        if out[i] != out[i - 1] and out[i] != out[i + 1]:
            out[i] = out[i - 1]
    return out
