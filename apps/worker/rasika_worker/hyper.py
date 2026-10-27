"""
Explainer reels drawn as HyperFrames compositions (HTML + GSAP rendered to MP4 by the
`hyperframes` CLI, Apache-2.0, run locally): the format of the "how I made it" reels — a warm
paper stage with drifting light, heavy uppercase headlines with one accent word, step pills,
cards that slide in and settle (chat, code window, phone, browser, image grid, stat cards,
checklist, quote, before → after) and two-to-three-word captions on the voice.

  THEMES          the looks (the house "studio" look first; a reference reel dresses a theme)
  build_project() storyboard + word timings + narration + media → a HyperFrames project folder
  render()        `hyperframes render` → MP4

The storyboard is the writer's (research.py); every scene starts on the words it names, so the
picture changes with the voice. Every value on screen is a function of timeline time: the
renderer seeks a paused GSAP timeline frame by frame, so renders are identical.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

W, H = 1080, 1920


@dataclass
class Theme:
    bg: str = "#f1e9dd"
    glow1: str = "#f2b48c"  # the warm light
    glow2: str = "#a9d2cc"  # the cool light
    ink: str = "#1e1813"
    accent: str = "#c2571b"
    card: str = "#fbf6ee"
    dark: str = "#231d19"
    dark_ink: str = "#efe3d2"
    muted: str = "#7b6a5c"
    display: str = "Archivo Black"
    serif: str = "Playfair Display"
    mono: str = "Space Mono"
    ui: str = "Inter"


THEMES: dict[str, Theme] = {
    "studio": Theme(),
    "night": Theme(
        bg="#0d0f14",
        glow1="#3b2a6b",
        glow2="#0f5c56",
        ink="#f4f1ea",
        accent="#ffb347",
        card="#171a22",
        dark="#05070b",
        dark_ink="#d9e2f0",
        muted="#8a93a6",
    ),
    "pop": Theme(
        bg="#fff2b8",
        glow1="#ff8fb1",
        glow2="#7fc8ff",
        ink="#111111",
        accent="#e8361c",
        card="#ffffff",
        dark="#111111",
        dark_ink="#fff2b8",
        muted="#4a4a4a",
    ),
}

#: the families HyperFrames bundles (they resolve by name; anything else would need a font file)
FONTS = [
    "Inter",
    "Montserrat",
    "Outfit",
    "Nunito",
    "Oswald",
    "League Gothic",
    "Archivo Black",
    "Space Mono",
    "IBM Plex Mono",
    "JetBrains Mono",
    "EB Garamond",
    "Playfair Display",
    "Source Code Pro",
    "Roboto",
    "Open Sans",
    "Lato",
    "Poppins",
]


def _mix(a: str, b: str, t: float) -> str:
    pa = [int(a[i : i + 2], 16) for i in (1, 3, 5)]
    pb = [int(b[i : i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(pa, pb, strict=True))


def theme_for(name: str, reference: Any = None) -> Theme:
    """A built-in theme, or the studio layout dressed in a reference reel's colours and type."""
    base = THEMES.get(name, THEMES["studio"])
    if not isinstance(reference, dict):
        return base
    c = reference.get("colors") or {}
    f = reference.get("fonts") or {}
    hexes = {k: str(c.get(k) or "") for k in ("bg", "ink", "accent", "muted")}
    if not all(re.fullmatch(r"#[0-9a-fA-F]{6}", v) for v in hexes.values()):
        return base
    dark_bg = sum(int(hexes["bg"][i : i + 2], 16) for i in (1, 3, 5)) < 3 * 110
    return Theme(
        bg=hexes["bg"],
        glow1=_mix(hexes["bg"], hexes["accent"], 0.45),
        glow2=_mix(hexes["bg"], hexes["muted"], 0.35),
        ink=hexes["ink"],
        accent=hexes["accent"],
        card=_mix(hexes["bg"], "#ffffff" if not dark_bg else "#000000", 0.55),
        dark=hexes["ink"] if not dark_bg else _mix(hexes["bg"], "#000000", 0.6),
        dark_ink=hexes["bg"] if not dark_bg else hexes["ink"],
        muted=hexes["muted"],
        display=str(f.get("display")) if f.get("display") in FONTS else base.display,
        ui=str(f.get("ui")) if f.get("ui") in FONTS else base.ui,
        serif=base.serif,
        mono=base.mono,
    )


SCENE_TYPES = (
    "headline",
    "step",
    "compare",
    "cta",
)
CARD_TYPES = ("chat", "code", "phone", "browser", "grid", "stats", "list", "quote", "image")


def esc(s: Any) -> str:
    return html.escape(str(s or ""), quote=True)


def spread_accent(text: str) -> str:
    """`*two words*` → `*two* *words*`, so the accent survives splitting a line into words."""
    return re.sub(r"\*([^*]+)\*", lambda m: " ".join(f"*{w}*" for w in m.group(1).split()), text)


def accent_html(text: str, accent: str) -> str:
    """`*word*` in the writer's text becomes the accent colour."""
    parts = re.split(r"(\*[^*]+\*)", esc(spread_accent(text)))
    out = []
    for p in parts:
        if p.startswith("*") and p.endswith("*") and len(p) > 2:
            out.append(f'<span style="color:{accent}">{p[1:-1]}</span>')
        else:
            out.append(p)
    return "".join(out)


def plain(text: str) -> str:
    return re.sub(r"\*", "", str(text or ""))


def fit(text: str, max_px: int, width: int, k: float = 0.62, lines: int = 1) -> int:
    """A font size that keeps the longest line of `text` inside `width`."""
    longest = max((len(x) for x in plain(text).split("\n")), default=1)
    per_line = max(1, longest if lines == 1 else (len(plain(text)) / lines))
    return int(max(36, min(max_px, width / (max(1.0, per_line) * k))))


# ───────────────────────────── scenes ─────────────────────────────


class Scene:
    """One scene: its markup (a column that flows top to bottom inside the title-safe band, so
    nothing overlaps whatever the text length) and the tweens that play it, at timeline times."""

    def __init__(
        self,
        idx: int,
        data: dict[str, Any],
        t0: float,
        t1: float,
        th: Theme,
        media: dict[str, str],
    ):
        self.i = idx
        self.d = data
        self.t0 = t0
        self.t1 = t1
        self.th = th
        self.media = media
        self.id = f"s{idx}"
        self.tw: list[str] = []
        # the first scene is already on screen at frame 0 (the thumbnail and the hook)
        self.instant = idx == 0

    def at(self, dt: float) -> float:
        return round(self.t0 + dt, 3)

    def tween(self, sel: str, frm: dict[str, Any], to: dict[str, Any], dt: float) -> None:
        if self.instant and dt < 0.5:
            return  # rest state: shown from frame 0
        self.tw.append(
            f"tl.fromTo({json.dumps(sel)},{json.dumps(frm)},{json.dumps(to)},{self.at(dt)});"
        )

    def html(self) -> str:
        t = str(self.d.get("type") or "headline")
        body = {
            "headline": self.headline,
            "step": self.step,
            "compare": self.compare,
            "cta": self.cta,
        }.get(t, self.headline)()
        dur = round(self.t1 - self.t0, 3)
        out = {"opacity": 0, "y": -40, "duration": 0.22, "ease": "power2.in"}
        self.tw.append(
            f"tl.fromTo({json.dumps(f'#{self.id} .col')},{{opacity:1,y:0}},{json.dumps(out)},{self.at(max(0.2, dur - 0.2))});"
        )
        return (
            f'<div id="{self.id}" class="clip scene" data-start="{self.t0}" data-duration="{dur}" '
            f'data-track-index="1"><div class="col">{body}</div></div>'
        )

    # ── the pieces of a column
    def pill(self) -> str:
        k = str(self.d.get("pill") or "")
        if not k:
            return ""
        head, _, tail = k.partition("·")
        inner = f'<b style="color:{self.th.accent}">{esc(head.strip())}</b>' + (
            f" · {esc(tail.strip())}" if tail else ""
        )
        self.tween(
            f"#{self.id} .pill",
            {"opacity": 0, "y": -24, "scale": 0.9},
            {"opacity": 1, "y": 0, "scale": 1, "duration": 0.4, "ease": "back.out(1.8)"},
            0.02,
        )
        return f'<div class="pill">{inner}</div>'

    def title_block(self, text: str, max_px: int, cls: str = "hl") -> tuple[str, int]:
        lines = [x for x in text.split("\n") if x.strip()][:3] or [" "]
        longest = max(len(plain(x)) for x in lines)
        # the heavy uppercase display face runs ~0.76 em a glyph: fit the longest line to 940 px
        size = max(56, min(max_px, int(940 / max(1, longest) / 0.76)))
        rows = []
        for line in lines:
            line = spread_accent(line)
            spans = " ".join(
                f'<span class="w" style="display:inline-block">{accent_html(w, self.th.accent)}</span>'
                for w in line.split()
            )
            rows.append(f'<div class="{cls}" style="font-size:{size}px">{spans}</div>')
        self.tween(
            f"#{self.id} .w",
            {"opacity": 0, "y": 60},
            {"opacity": 1, "y": 0, "duration": 0.45, "ease": "power4.out", "stagger": 0.06},
            0.0,
        )
        return f'<div class="tblock">{"".join(rows)}</div>', size

    def serif_line(self, size: int) -> str:
        serif = str(self.d.get("serif") or "")
        if not serif:
            return ""
        self.tween(
            f"#{self.id} .serif",
            {"opacity": 0, "y": 20},
            {"opacity": 1, "y": 0, "duration": 0.5, "ease": "power3.out"},
            0.35,
        )
        return f'<div class="serif" style="font-size:{max(40, min(64, int(size * 0.42)))}px">{esc(serif)}</div>'

    # ── scene types
    def headline(self) -> str:
        has_card = bool(self.d.get("card"))
        block, size = self.title_block(str(self.d.get("title") or ""), 150 if has_card else 170)
        return self.pill() + block + self.serif_line(size) + (self.card() if has_card else "")

    def step(self) -> str:
        title = str(self.d.get("title") or "")
        out = self.pill()
        if title:
            block, size = self.title_block(title, 104)
            out += block
        return out + self.card()

    def compare(self) -> str:
        th = self.th
        block, _ = self.title_block(str(self.d.get("title") or ""), 124)
        left = dict(self.d.get("left") or {})
        right = dict(self.d.get("right") or {})
        self.tween(
            f"#{self.id} .cl",
            {"opacity": 0, "x": -80, "rotation": -6},
            {"opacity": 1, "x": 0, "rotation": -2, "duration": 0.55, "ease": "back.out(1.4)"},
            0.2,
        )
        self.tween(
            f"#{self.id} .cr",
            {"opacity": 0, "x": 80, "rotation": 6},
            {"opacity": 1, "x": 0, "rotation": 2, "duration": 0.55, "ease": "back.out(1.4)"},
            0.55,
        )
        return (
            block
            + '<div class="pair">'
            + self._mini(left, "cl", th.card, False)
            + self._mini(right, "cr", th.dark, True)
            + "</div>"
        )

    def _mini(self, d: dict[str, Any], cls: str, bg: str, dark: bool) -> str:
        th = self.th
        img = self.media.get(str(d.get("media") or ""))
        ink = th.dark_ink if dark else th.ink
        inner = (
            f'<img src="{esc(img)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 0">'
            if img
            else f"<div style=\"padding:30px;font:400 30px/1.4 '{th.mono}',monospace;color:{ink}\">{esc(d.get('text') or '')}</div>"
        )
        tag = (
            f'<div class="tag"><span style="background:{th.accent if dark else th.dark};color:{th.card if dark else th.dark_ink}">{esc(d.get("tag"))}</span></div>'
            if d.get("tag")
            else ""
        )
        return f'<div class="{cls} side"><div class="mini" style="background:{bg};border:4px solid {th.dark}">{inner}</div>{tag}</div>'

    def cta(self) -> str:
        th = self.th
        word = str(self.d.get("word") or "FOLLOW").upper()[:16]
        lead = str(self.d.get("lead") or "comment")
        tail = str(self.d.get("tail") or "")
        size = max(90, min(160, int(900 / max(3, len(word) + 2) / 0.7)))
        self.tween(
            f"#{self.id} .serif",
            {"opacity": 0, "y": 20},
            {"opacity": 1, "y": 0, "duration": 0.4, "ease": "power3.out"},
            0.0,
        )
        self.tween(
            f"#{self.id} .cw",
            {"opacity": 0, "scale": 0.6},
            {"opacity": 1, "scale": 1, "duration": 0.5, "ease": "back.out(2)"},
            0.2,
        )
        self.tween(
            f"#{self.id} .cbox",
            {"opacity": 0, "y": 60},
            {"opacity": 1, "y": 0, "duration": 0.5, "ease": "power3.out"},
            0.5,
        )
        self.tween(
            f"#{self.id} .ctyped",
            {"text": ""},
            {"text": word, "duration": 0.6, "ease": "none"},
            0.9,
        )
        out = (
            f'<div class="serif" style="font-size:80px">{esc(lead)}</div>'
            f'<div class="hl cw" style="font-size:{size}px">“{esc(word)}”</div>'
            f'<div class="cbox"><div class="crow"><i style="background:{th.accent}"></i><span class="ctyped"></span>'
            f'<b style="color:#d6324b">♥</b></div><div class="cinput"><span></span><em style="background:{th.dark}">→</em></div></div>'
        )
        if tail:
            self.tween(f"#{self.id} .tailtxt", {"opacity": 0}, {"opacity": 1, "duration": 0.4}, 1.4)
            out += f'<div class="tailtxt">{accent_html(tail, th.accent)}</div>'
        return out

    # ── cards (in the column's flow; the card takes the room that is left)
    def card(self) -> str:
        c = dict(self.d.get("card") or {})
        fn = {
            "chat": self.c_chat,
            "code": self.c_code,
            "phone": self.c_phone,
            "browser": self.c_browser,
            "grid": self.c_grid,
            "stats": self.c_stats,
            "list": self.c_list,
            "quote": self.c_quote,
            "image": self.c_image,
        }.get(str(c.get("kind") or ""))
        return fn(c) if fn else ""

    def _enter(self, sel: str, dt: float = 0.15) -> None:
        self.tween(
            sel,
            {"opacity": 0, "y": 120, "scale": 0.92, "rotation": -1.5},
            {
                "opacity": 1,
                "y": 0,
                "scale": 1,
                "rotation": 0,
                "duration": 0.6,
                "ease": "back.out(1.3)",
            },
            dt,
        )
        # always moving: a slow drift for the rest of the scene
        self.tw.append(
            f"tl.fromTo({json.dumps(sel)},{{yPercent:0}},{{yPercent:-1.5,duration:{max(0.5, round(self.t1 - self.t0 - 0.8, 3))},ease:'sine.inOut'}},{self.at(0.75)});"
        )

    def c_chat(self, c: dict[str, Any]) -> str:
        th = self.th
        msgs = [m for m in c.get("messages") or [] if isinstance(m, dict)][:3]
        rows = []
        for k, m in enumerate(msgs):
            me = str(m.get("who") or "me") == "me"
            who = esc(m.get("name") or ("Me" if me else "Claude"))
            rows.append(
                f'<div class="msg m{k}" style="align-self:{"flex-end" if me else "flex-start"};background:{th.dark if me else th.card};'
                f'color:{th.dark_ink if me else th.ink};border:{"0" if me else f"3px solid {th.dark}"}">'
                f'<div class="who" style="color:{th.accent}">{who}</div>{esc(m.get("text") or "")}</div>'
            )
            self.tween(
                f"#{self.id} .m{k}",
                {"opacity": 0, "y": 30, "scale": 0.95},
                {"opacity": 1, "y": 0, "scale": 1, "duration": 0.4, "ease": "back.out(1.6)"},
                0.45 + k * 0.55,
            )
        self._enter(f"#{self.id} .chat")
        return f'<div class="card chat">{"".join(rows)}</div>'

    def c_code(self, c: dict[str, Any]) -> str:
        th = self.th
        lines = [str(x)[:48] for x in c.get("lines") or []][:8]
        body = "".join(
            f'<div class="cl{k}">{esc(x) or "&nbsp;"}</div>' for k, x in enumerate(lines)
        )
        for k in range(len(lines)):
            self.tween(
                f"#{self.id} .cl{k}",
                {"opacity": 0, "x": -20},
                {"opacity": 1, "x": 0, "duration": 0.25, "ease": "power2.out"},
                0.45 + k * 0.12,
            )
        self._enter(f"#{self.id} .code")
        return (
            f'<div class="card code" style="background:{th.dark};border:0">'
            f'<div class="bar"><i style="background:{th.accent}"></i><span>{esc(c.get("title") or "build.py")}</span></div>'
            f'<div class="src" style="color:{th.dark_ink}">{body}</div></div>'
        )

    def c_phone(self, c: dict[str, Any]) -> str:
        th = self.th
        src = self.media.get(str(c.get("media") or ""), "")
        is_video = src.lower().endswith((".mp4", ".webm", ".mov"))
        dur = round(self.t1 - self.t0, 3)
        media = (
            f'<video id="{self.id}v" class="clip" data-start="{self.t0}" data-duration="{dur}" data-track-index="2" '
            f'src="{esc(src)}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video>'
            if is_video and src
            else (
                f'<img src="{esc(src)}" style="width:100%;height:100%;object-fit:cover;object-position:50% 0">'
                if src
                else ""
            )
        )
        tag = ""
        if c.get("tag"):
            tag = f'<div class="tag"><span style="background:{th.accent};color:#fff">{esc(c.get("tag"))}</span></div>'
            self.tween(
                f"#{self.id} .tag",
                {"opacity": 0, "y": 16},
                {"opacity": 1, "y": 0, "duration": 0.3, "ease": "power2.out"},
                0.6,
            )
        self._enter(f"#{self.id} .phonewrap")
        self.tw.append(
            f"tl.fromTo({json.dumps(f'#{self.id} .phone img')},{{scale:1,y:0}},{{scale:1.06,y:-30,duration:{max(0.5, dur)},ease:'none'}},{self.at(0)});"
        )
        return f'<div class="phonewrap grow"><div class="phone" style="border-color:{th.dark}"><div class="scr">{media}</div></div>{tag}</div>'

    def c_browser(self, c: dict[str, Any]) -> str:
        src = self.media.get(str(c.get("media") or ""), "")
        self._enter(f"#{self.id} .browser")
        self.tw.append(
            f"tl.fromTo({json.dumps(f'#{self.id} .browser img')},{{y:0}},{{y:-90,duration:{max(0.5, round(self.t1 - self.t0, 3))},ease:'sine.inOut'}},{self.at(0)});"
        )
        return (
            f'<div class="card browser"><div class="bbar"><i></i><i></i><i></i><span>{esc(c.get("url") or "")}</span></div>'
            f'<div class="bview"><img src="{esc(src)}"></div></div>'
        )

    def c_image(self, c: dict[str, Any]) -> str:
        src = self.media.get(str(c.get("media") or ""), "")
        self._enter(f"#{self.id} .imgcard")
        self.tw.append(
            f"tl.fromTo({json.dumps(f'#{self.id} .imgcard img')},{{scale:1}},{{scale:1.08,duration:{max(0.5, round(self.t1 - self.t0, 3))},ease:'none'}},{self.at(0)});"
        )
        return f'<div class="card imgcard grow"><img src="{esc(src)}"></div>'

    def c_grid(self, c: dict[str, Any]) -> str:
        imgs = [self.media[m] for m in (c.get("media_list") or []) if m in self.media][:12]
        cols = 4 if len(imgs) > 6 else 3
        cells = "".join(
            f'<div class="gcell g{k}"><img src="{esc(src)}"></div>' for k, src in enumerate(imgs)
        )
        for k in range(len(imgs)):
            self.tween(
                f"#{self.id} .g{k}",
                {"opacity": 0, "scale": 0.6, "rotation": (k % 3 - 1) * 8},
                {"opacity": 1, "scale": 1, "rotation": 0, "duration": 0.4, "ease": "back.out(1.7)"},
                0.1 + k * 0.06,
            )
        return f'<div class="grid" style="grid-template-columns:repeat({cols},1fr)">{cells}</div>'

    def c_stats(self, c: dict[str, Any]) -> str:
        th = self.th
        stats = [s for s in c.get("stats") or [] if isinstance(s, dict)][:3]
        n = max(1, len(stats))
        w = (960 - (n - 1) * 24) // n
        boxes = []
        for k, s in enumerate(stats):
            dark = k % 2 == 1
            val = str(s.get("value") or "")
            m = re.match(r"^([^\d-]*)(-?[\d.,]+)(.*)$", val)
            sz = max(64, min(150, int(w / max(2, len(val)) / 0.62)))
            boxes.append(
                f'<div class="stat st{k}" style="background:{th.dark if dark else th.card};border:4px solid {th.dark}">'
                f'<div class="num n{k}" style="font-size:{sz}px;color:{th.accent if not dark else th.dark_ink}">{esc(val)}</div>'
                f'<div class="slab" style="color:{th.dark_ink if dark else th.muted}">{esc(s.get("label") or "")}</div></div>'
            )
            self.tween(
                f"#{self.id} .st{k}",
                {"opacity": 0, "y": 90, "rotation": (k - 0.5) * 6},
                {
                    "opacity": 1,
                    "y": 0,
                    "rotation": (k - (n - 1) / 2) * 2,
                    "duration": 0.55,
                    "ease": "back.out(1.6)",
                },
                0.15 + k * 0.18,
            )
            year = re.fullmatch(r"(19|20)\d\d", val.strip()) is not None
            # the number counts up (not in the opening scene: frame 0 is the thumbnail, it shows the real value)
            if m and not year and not self.instant:
                num = m.group(2).replace(",", "")
                dec = len(num.split(".")[1]) if "." in num else 0
                group = "true" if "," in m.group(2) else "false"
                self.tw.append(
                    f"(function(){{var o={{v:0}};tl.to(o,{{v:{float(num)},duration:0.9,ease:'power3.out',"
                    f"onUpdate:function(){{var e=document.querySelector('#{self.id} .n{k}');if(e)e.textContent="
                    f"{json.dumps(m.group(1))}+o.v.toLocaleString('en-US',{{minimumFractionDigits:{dec},maximumFractionDigits:{dec},useGrouping:{group}}})+{json.dumps(m.group(3))};}}}},{self.at(0.25 + k * 0.18)});}})();"
                )
        return f'<div class="stats">{"".join(boxes)}</div>'

    def c_list(self, c: dict[str, Any]) -> str:
        th = self.th
        items = [str(x) for x in c.get("items") or [] if str(x).strip()][:4]
        rows = "".join(
            f'<div class="li l{k}"><b style="background:{th.accent}">✓</b><span>{accent_html(x, th.accent)}</span></div>'
            for k, x in enumerate(items)
        )
        for k in range(len(items)):
            self.tween(
                f"#{self.id} .l{k}",
                {"opacity": 0, "x": 60},
                {"opacity": 1, "x": 0, "duration": 0.4, "ease": "power3.out"},
                0.35 + k * 0.3,
            )
        self._enter(f"#{self.id} .list")
        return f'<div class="card list">{rows}</div>'

    def c_quote(self, c: dict[str, Any]) -> str:
        th = self.th
        text = str(c.get("text") or "")
        size = max(40, min(64, int(5200 / max(20, len(text)))))
        self._enter(f"#{self.id} .quote")
        return (
            f'<div class="card quote"><div class="qm" style="color:{th.accent}">“</div>'
            f'<div class="qt" style="font-size:{size}px">{accent_html(text, th.accent)}</div>'
            f'<div class="qs">{esc(c.get("source") or "")}</div></div>'
        )


# ───────────────────────────── captions ─────────────────────────────


def caption_groups(
    words: list[dict[str, Any]], emphasis: set[str], max_words: int = 3
) -> list[dict[str, Any]]:
    """Two-to-three-word groups, broken at sentence ends and pauses ≥ 0.15 s."""
    groups: list[dict[str, Any]] = []
    cur: list[dict[str, Any]] = []
    for i, w in enumerate(words):
        cur.append(w)
        nxt = words[i + 1] if i + 1 < len(words) else None
        end_sentence = bool(re.search(r"[.!?…]$", str(w.get("w") or "")))
        pause = nxt is not None and float(nxt["t"]) - float(w.get("end") or w["t"]) >= 0.15
        if len(cur) >= max_words or end_sentence or pause or nxt is None:
            groups.append(
                {
                    "start": float(cur[0]["t"]),
                    "end": float(cur[-1].get("end") or cur[-1]["t"]) + 0.05,
                    "words": [
                        {
                            "text": str(x.get("w") or "").strip(),
                            "hot": re.sub(r"[^\w']", "", str(x.get("w") or "")).lower() in emphasis
                            or bool(re.search(r"\d", str(x.get("w") or ""))),
                        }
                        for x in cur
                    ],
                }
            )
            cur = []
    # each group holds until the next starts (no flicker between words)
    for a, b in zip(groups, groups[1:], strict=False):
        # hold until the next group starts (no flicker), never past it (no two at once)
        a["end"] = min(max(a["end"], min(b["start"], a["end"] + 0.4)), b["start"] - 0.01)
    return groups


def captions_html(groups: list[dict[str, Any]], th: Theme, y: int) -> tuple[str, list[str]]:
    els, tw = [], []
    for k, g in enumerate(groups):
        text = " ".join(w["text"].upper() for w in g["words"])
        size = max(40, min(72, int(900 / max(1, len(text)) / 0.74)))
        spans = " ".join(
            f'<span style="color:{th.accent if w["hot"] else th.ink}">{esc(w["text"].upper())}</span>'
            for w in g["words"]
        )
        start, end = round(g["start"], 3), round(max(g["end"], g["start"] + 0.2), 3)
        els.append(
            f'<div id="cap{k}" class="clip cap" data-start="{start}" data-duration="{round(end - start, 3)}" data-track-index="3" '
            f'style="top:{y}px"><div class="capi" style="font-size:{size}px">{spans}</div></div>'
        )
        tw.append(
            f'tl.fromTo("#cap{k} .capi",{{opacity:0,y:18,scale:0.92}},{{opacity:1,y:0,scale:1,duration:0.14,ease:"back.out(2)",immediateRender:false}},{start});'
        )
        tw.append(f'tl.set("#cap{k} .capi",{{opacity:0}},{end});')
    return "".join(els), tw


# ───────────────────────────── the project ─────────────────────────────

CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--bg)}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:var(--bg);font-family:'%(ui)s',sans-serif}
.blob{position:absolute;border-radius:50%%;filter:blur(90px);opacity:.7}
.grain{position:absolute;inset:0;opacity:.35;background-image:radial-gradient(rgba(0,0,0,.05) 1px,transparent 1.2px);background-size:22px 22px}
.scene{position:absolute;inset:0}
.col{position:absolute;left:60px;right:60px;top:190px;height:990px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}
.pill{flex:none;background:var(--dark);color:var(--dark-ink);font:900 26px/1 '%(display)s',sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:16px 26px;border-radius:999px}
.tblock{flex:none;width:100%%;text-align:center}
.hl{font-family:'%(display)s',sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;line-height:1.02;color:var(--ink)}
.serif{flex:none;width:100%%;text-align:center;font-family:'%(serif)s',serif;font-style:italic;font-weight:400;color:var(--accent);line-height:1.15;margin-top:-12px}
.grow{flex:1 1 auto;min-height:0}
.card{flex:none;width:100%%;background:var(--card);border:4px solid var(--dark);border-radius:30px;padding:30px;box-shadow:0 40px 70px -30px rgba(60,35,20,.45)}
.chat{display:flex;flex-direction:column;gap:22px}
.msg{max-width:88%%;padding:24px 28px;border-radius:22px;font:400 36px/1.38 '%(mono)s',monospace}
.who{font:900 20px/1 '%(display)s',sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px}
.code .bar{display:flex;align-items:center;gap:14px;font:400 24px/1 '%(mono)s',monospace;color:var(--dark-ink);opacity:.85;margin-bottom:24px}
.code .bar i{width:14px;height:14px;border-radius:50%%}
.src{font:400 27px/1.6 '%(mono)s',monospace;white-space:pre;overflow:hidden}
.phonewrap{display:flex;flex-direction:column;align-items:center;gap:22px;max-height:820px}
.phone{position:relative;flex:1 1 auto;min-height:0;aspect-ratio:9/16;border:12px solid #111;border-radius:56px;overflow:hidden;background:#000;box-shadow:0 50px 90px -30px rgba(40,25,10,.55)}
.phone .scr{position:absolute;inset:0;overflow:hidden;border-radius:44px}
.tag{flex:none;display:flex;justify-content:center}
.tag span{font:900 26px/1 '%(display)s',sans-serif;letter-spacing:.05em;text-transform:uppercase;padding:14px 26px;border-radius:999px}
.browser{padding:0;overflow:hidden;display:flex;flex-direction:column;flex:1 1 auto;min-height:0;max-height:660px}
.bbar{height:56px;background:#ece5da;display:flex;align-items:center;gap:10px;padding:0 22px}
.bbar i{width:14px;height:14px;border-radius:50%%;background:#d8cdbd}
.bbar span{margin-left:12px;font:400 22px/1 '%(mono)s',monospace;color:#6b5d50}
.bview{flex:1 1 auto;min-height:0;overflow:hidden;background:#fff}
.bview img{width:100%%;display:block}
.imgcard{padding:0;overflow:hidden;max-height:780px}
.imgcard img{width:100%%;height:100%%;object-fit:cover;display:block}
.grid{flex:none;width:100%%;display:grid;gap:14px}
.gcell{aspect-ratio:1/1;border-radius:16px;overflow:hidden;border:3px solid var(--dark);background:#000}
.gcell img{width:100%%;height:100%%;object-fit:cover;object-position:50%% 0}
.stats{flex:none;width:100%%;display:flex;gap:24px}
.stat{flex:1;border-radius:28px;padding:34px 20px 30px;text-align:center;box-shadow:0 30px 60px -28px rgba(60,35,20,.5)}
.num{font-family:'%(display)s',sans-serif;font-weight:900;line-height:1}
.slab{margin-top:16px;font:900 24px/1.2 '%(display)s',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.list{display:flex;flex-direction:column;gap:26px}
.li{display:flex;align-items:center;gap:22px;font:900 42px/1.15 '%(display)s',sans-serif;text-transform:uppercase;color:var(--ink)}
.li b{flex:none;width:54px;height:54px;border-radius:50%%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px}
.quote{text-align:left}
.qm{font:400 160px/0.7 '%(serif)s',serif}
.qt{font-family:'%(serif)s',serif;font-style:italic;color:var(--ink);line-height:1.2}
.qs{margin-top:22px;font:900 22px/1 '%(display)s',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.pair{flex:1 1 auto;min-height:0;max-height:760px;width:100%%;display:flex;gap:40px}
.side{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;gap:22px}
.mini{position:relative;width:100%%;flex:1 1 auto;min-height:0;border-radius:30px;overflow:hidden;box-shadow:0 40px 70px -30px rgba(60,35,20,.45)}
.cbox{flex:none;width:860px}
.crow{display:flex;align-items:center;gap:18px;background:var(--card);border:3px solid var(--dark);border-radius:24px;padding:22px 26px;font:900 34px/1 '%(display)s',sans-serif;color:var(--ink)}
.crow i{width:44px;height:44px;border-radius:50%%}
.crow b{margin-left:auto;font-size:36px}
.cinput{margin-top:18px;display:flex;align-items:center;justify-content:space-between;background:var(--card);border:3px solid var(--dark);border-radius:999px;padding:14px 14px 14px 30px}
.cinput span{width:3px;height:34px;background:var(--ink)}
.cinput em{font-style:normal;width:54px;height:54px;border-radius:50%%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px}
.tailtxt{flex:none;font:900 34px/1.2 '%(display)s',sans-serif;color:var(--ink);text-align:center}
.cap{position:absolute;left:0;right:0;text-align:center;overflow:visible}
.capi{opacity:0;font-family:'%(display)s',sans-serif;font-weight:900;letter-spacing:.01em;line-height:1.05;text-shadow:0 2px 0 rgba(255,255,255,.35)}
"""


def build_project(
    out: Path,
    storyboard: dict[str, Any],
    words: list[dict[str, Any]],
    duration: float,
    audio: list[tuple[str, Path, float]],
    media: dict[str, Path],
    theme: Theme,
    gsap_js: Path | None = None,
    caption_y: int = 1250,
) -> Path:
    """Write `index.html` (+ assets) for the storyboard. Scenes start on their `say` words."""
    from rasika_worker.roundup import when

    out.mkdir(parents=True, exist_ok=True)
    assets = out / "assets"
    assets.mkdir(exist_ok=True)
    rel: dict[str, str] = {}
    for mid, p in media.items():
        dest = assets / f"{re.sub(r'[^A-Za-z0-9_-]', '_', mid)}{p.suffix.lower()}"
        if not dest.exists():
            shutil.copy(p, dest)
        rel[mid] = f"assets/{dest.name}"
    audio_tags = []
    for k, (aid, p, vol) in enumerate(audio):
        dest = assets / f"{aid}{p.suffix.lower()}"
        shutil.copy(p, dest)
        audio_tags.append(
            f'<audio id="{aid}" class="clip" data-start="0" data-duration="{round(duration, 3)}" data-track-index="{10 + k}" data-volume="{vol}" src="assets/{dest.name}"></audio>'
        )

    scenes_in = [s for s in storyboard.get("scenes") or [] if isinstance(s, dict)]
    starts: list[float] = []
    for i, s in enumerate(scenes_in):
        t = when(words, str(s.get("say") or ""), starts[-1] + 0.6 if starts else 0.0) if i else 0.0
        if t is None:
            t = (starts[-1] + 2.5) if starts else 0.0
        starts.append(min(t, duration - 0.6))
    scenes_html, tweens = [], []
    for i, s in enumerate(scenes_in):
        t0 = starts[i]
        t1 = starts[i + 1] if i + 1 < len(scenes_in) else duration
        if t1 - t0 < 0.4:
            continue
        sc = Scene(i, s, round(t0, 3), round(t1, 3), theme, rel)
        scenes_html.append(sc.html())
        tweens.extend(sc.tw)
    emphasis = {re.sub(r"[^\w']", "", w).lower() for w in storyboard.get("emphasis") or []}
    caps, cap_tw = captions_html(caption_groups(words, emphasis), theme, caption_y)

    # the light drifts the whole film long (no repeats: a function of time)
    d = round(duration, 3)
    bg_tw = [
        f'tl.fromTo("#b1",{{x:-260,y:-120}},{{x:120,y:260,duration:{d},ease:"sine.inOut"}},0);',
        f'tl.fromTo("#b2",{{x:220,y:900}},{{x:-160,y:620,duration:{d},ease:"sine.inOut"}},0);',
        f'tl.fromTo("#b3",{{x:600,y:1300,scale:1}},{{x:380,y:1100,scale:1.2,duration:{d},ease:"sine.inOut"}},0);',
    ]
    th = asdict(theme)
    css = CSS % th
    gsap_src = "assets/gsap.min.js"
    if gsap_js and gsap_js.exists():
        shutil.copy(gsap_js, assets / "gsap.min.js")
    else:
        gsap_src = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"
    text_plugin = gsap_src.replace("gsap.min.js", "TextPlugin.min.js")
    if gsap_js and (gsap_js.parent / "TextPlugin.min.js").exists():
        shutil.copy(gsap_js.parent / "TextPlugin.min.js", assets / "TextPlugin.min.js")
    doc = f"""<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="{gsap_src}"></script>
<script src="{text_plugin}"></script>
<style>
:root{{--bg:{theme.bg};--ink:{theme.ink};--accent:{theme.accent};--card:{theme.card};--dark:{theme.dark};--dark-ink:{theme.dark_ink};--muted:{theme.muted}}}
{css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{d}" data-width="1080" data-height="1920">
  <div id="bg" class="clip" data-start="0" data-duration="{d}" data-track-index="0" style="position:absolute;inset:0">
    <div id="b1" class="blob" style="width:900px;height:900px;background:{theme.glow1}"></div>
    <div id="b2" class="blob" style="width:820px;height:820px;background:{theme.glow2}"></div>
    <div id="b3" class="blob" style="width:700px;height:700px;background:{theme.glow1};opacity:.45"></div>
    <div class="grain"></div>
  </div>
  {"".join(scenes_html)}
  {caps}
  {"".join(audio_tags)}
</div>
<script>
if (window.TextPlugin) gsap.registerPlugin(TextPlugin);
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(bg_tw)}
{chr(10).join(tweens)}
{chr(10).join(cap_tw)}
window.__timelines = window.__timelines || {{}};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
"""
    (out / "index.html").write_text(doc, encoding="utf-8")
    (out / "hyperframes.json").write_text(
        json.dumps(
            {
                "paths": {
                    "blocks": "compositions",
                    "components": "compositions/components",
                    "assets": "assets",
                }
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return out / "index.html"


def render(
    project: Path,
    dest: Path,
    cli: list[str] | None = None,
    timeout: float = 1800,
    browser: str = "",
) -> Path:
    """`hyperframes render` → MP4 (telemetry off)."""
    cmd = (cli or ["npx", "-y", "hyperframes@0.8.206"]) + ["render", str(project), "-o", str(dest)]
    env = {
        "HYPERFRAMES_NO_TELEMETRY": "1",
        "DO_NOT_TRACK": "1",
        "HYPERFRAMES_NO_UPDATE_CHECK": "1",
        "HYPERFRAMES_NO_AUTO_INSTALL": "1",
    }
    if browser:
        env["HYPERFRAMES_BROWSER_PATH"] = browser
    import os

    p = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        env={**os.environ, **env},
        shell=os.name == "nt",
    )
    if p.returncode != 0 or not dest.exists():
        raise RuntimeError(f"hyperframes render failed: {(p.stderr or p.stdout)[-1500:]}")
    return dest
