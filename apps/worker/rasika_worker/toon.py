"""
Toon explainers: the "AI-animated reel" format drawn as a HyperFrames composition. A linen-paper
stage, a cartoon host in the bottom right who talks (mouth on the voice), points, presents and
celebrates; the words of the voice writing themselves top left with one accent word in red
italic serif; a big condensed label with a numbered step badge; real-looking cards (app window,
browser, phone, folder, chat, code, checklist, numbers) that pop in, get circled, clicked,
stamped; a roadmap of the steps that ticks off as the reel goes; a cork-board hook; halftone
wipes between parts; a comment call to action. Sound: the voice, a quiet music bed, a pop or a
whoosh or a click on everything that moves (returned as cues for sfx.py).

  build_project()  storyboard + word timings + narration → a HyperFrames project (+ sound cues)
  check()          keep what the renderer can draw from a writer's storyboard
  WRITER_SYSTEM    how the writer scripts and boards one of these reels

Every value on screen is a function of timeline time (the renderer seeks a paused GSAP timeline),
so a render is the same every time.
"""

from __future__ import annotations

import html
import json
import random
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from rasika_worker import toonhost
from rasika_worker.director import RULES

W, H = 1080, 1920


@dataclass
class Look:
    bg: str = "#eeebe5"
    ink: str = "#16130f"
    accent: str = "#e0322b"
    muted: str = "#8b857c"
    card: str = "#ffffff"
    dark: str = "#1d1c20"
    dark_ink: str = "#f2efe9"
    blue: str = "#5aa3e8"
    cork: str = "#7a5634"
    caption: str = "Outfit"
    serif: str = "EB Garamond"
    label: str = "Oswald"
    mono: str = "Space Mono"
    ui: str = "Inter"


LOOKS: dict[str, Look] = {
    "paper": Look(),
    "night": Look(
        bg="#141418", ink="#f4f1ea", accent="#ff5a4e", muted="#8d8a93", card="#22222a",
        dark="#0b0b0e", dark_ink="#f4f1ea", cork="#3a2c22",
    ),
    "mint": Look(
        bg="#e7f0ea", ink="#10201a", accent="#e2502b", muted="#6f8378", card="#ffffff",
        dark="#14211b", dark_ink="#eef6f0", cork="#6b5236",
    ),
}  # fmt: skip

POSES = toonhost.POSE_NAMES
SCENES = ("board", "roadmap", "label", "big", "cta")
CARDS = (
    "app", "browser", "phone", "chat", "list", "stats", "code", "folder", "image", "compare",
)  # fmt: skip
PROPS = ("sticker", "stamp", "check", "bubble", "circle", "cursor", "confetti", "box", "envelope")


def esc(s: Any) -> str:
    return html.escape(str(s or ""), quote=True)


def plain(s: Any) -> str:
    return re.sub(r"\*", "", str(s or ""))


def _accented(text: str, cls: str = "acc") -> str:
    """`*word*` → the accent span."""
    out = []
    for p in re.split(r"(\*[^*]+\*)", esc(text)):
        if len(p) > 2 and p.startswith("*") and p.endswith("*"):
            out.append(f'<span class="{cls}">{p[1:-1]}</span>')
        else:
            out.append(p)
    return "".join(out)


def _norm(w: str) -> str:
    return re.sub(r"[^\w']", "", w).lower()


# ───────────────────────────── captions ─────────────────────────────


def caption_groups(
    words: list[dict[str, Any]], max_words: int = 8, max_chars: int = 38
) -> list[list[dict[str, Any]]]:
    """Phrases of the voice as they show top left: broken at sentence ends, at commas once a
    phrase has 4 words, at pauses ≥ 0.35 s and at about two short lines."""
    groups: list[list[dict[str, Any]]] = []
    cur: list[dict[str, Any]] = []
    for i, w in enumerate(words):
        cur.append(w)
        text = str(w.get("w") or "")
        nxt = words[i + 1] if i + 1 < len(words) else None
        chars = sum(len(str(x.get("w") or "")) + 1 for x in cur)
        pause = nxt is not None and float(nxt["t"]) - float(w.get("end") or w["t"]) >= 0.35
        if (
            nxt is None
            or re.search(r"[.!?…]$", text)
            or (re.search(r"[,;:]$", text) and len(cur) >= 4)
            or pause
            or len(cur) >= max_words
            or chars >= max_chars
        ):
            groups.append(cur)
            cur = []
    return groups


# ───────────────────────────── the builder ─────────────────────────────


class Builder:
    def __init__(self, sb: dict[str, Any], words: list[dict[str, Any]], duration: float, look: Look,
                 media: dict[str, str], host: str) -> None:  # fmt: skip
        self.sb = sb
        self.words = words
        self.D = round(duration, 3)
        self.lk = look
        self.media = media
        self.host = host
        self.tw: list[str] = []
        self.cues: list[dict[str, Any]] = []
        self.rng = random.Random(7)
        self.steps = [s for s in sb.get("steps") or [] if isinstance(s, dict)][:7]

    # timeline helpers
    def ft(self, sel: str, frm: dict[str, Any], to: dict[str, Any], at: float) -> None:
        self.tw.append(f"tl.fromTo({json.dumps(sel)},{json.dumps(frm)},{json.dumps(to)},{at:.3f});")

    def to(self, sel: str, to: dict[str, Any], at: float) -> None:
        self.tw.append(f"tl.to({json.dumps(sel)},{json.dumps(to)},{at:.3f});")

    def put(self, sel: str, to: dict[str, Any], at: float) -> None:
        self.tw.append(f"tl.set({json.dumps(sel)},{json.dumps(to)},{at:.3f});")

    def cue(self, t: float, kind: str, gain: float = 0.5, **kw: Any) -> None:
        self.cues.append({"t": round(max(0.0, t), 3), "type": kind, "gain": gain, **kw})

    def pop(
        self, sel: str, at: float, rot: float = 0.0, sound: bool = True, scale: float = 0.6
    ) -> None:
        self.ft(sel, {"opacity": 0, "scale": scale, "rotation": rot - 6},
                {"opacity": 1, "scale": 1, "rotation": rot, "duration": 0.42, "ease": "back.out(2.2)"}, at)  # fmt: skip
        if sound:
            self.cue(at, "pop", 0.45)

    def typed(self, sel: str, text: str, at: float, cps: float = 18.0) -> float:
        """Text that types itself; returns when it is done."""
        d = round(max(0.25, len(text) / cps), 3)
        self.ft(sel, {"text": ""}, {"text": text, "duration": d, "ease": "none"}, at)
        self.cue(at, "key", 0.25, repeat=max(1, int(d / 0.09)), every=0.09)
        return at + d

    # ── the pieces
    def kicker(self, sid: str, s: dict[str, Any], dark: bool) -> str:
        k = str(s.get("kicker") or "")
        if not k:
            return ""
        return f'<div class="kick" style="color:{"#cbb89f" if dark else self.lk.muted}">// {esc(k)}</div>'

    def badge(self, n: int, total: int, cls: str = "badge") -> str:
        dots = "".join(
            f'<i style="background:{self.lk.accent if k + 1 == n else ("#fff" if k + 1 < n else "#6c6a70")}"></i>'
            for k in range(max(1, total))
        )
        return f'<div class="{cls}"><b>{n}</b><span class="dots">{dots}</span></div>'

    def label(self, sid: str, s: dict[str, Any], t0: float, same: bool) -> str:
        text = str(s.get("label") or "")
        if not text:
            return ""
        words = re.findall(r"\*[^*]+\*|\S+", text)
        spans = []
        for k, w in enumerate(words):
            hot = w.startswith("*") and w.endswith("*") and len(w) > 2
            # a later beat of the same step: the label is already there, filled
            filled = f' style="color:{self.lk.accent if hot else self.lk.ink}"' if same else ""
            spans.append(
                f'<span class="lw lw{k}{" hot" if hot else ""}"{filled}>{esc(plain(w).upper())}</span>'
            )
        n = len(plain(text))
        size = max(84, min(150, int(880 / max(6, n) / 0.5)))
        kick = str(s.get("label_kick") or "")
        badge = ""
        if s.get("badge"):
            badge = self.badge(int(s["badge"]), max(len(self.steps), int(s["badge"])))
        if not same:
            for k in range(len(words)):
                at = t0 + 0.12 + k * 0.16
                # each word lands as an outline, then fills
                self.ft(f"#{sid} .lw{k}", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0, "duration": 0.22, "ease": "power3.out"}, at)  # fmt: skip
                self.ft(f"#{sid} .lw{k}", {"color": "rgba(0,0,0,0)"}, {"color": self.lk.accent if "hot" in spans[k] else self.lk.ink, "duration": 0.18}, at + 0.18)  # fmt: skip
            self.cue(t0 + 0.12, "whoosh", 0.35, dur=0.3)
            if badge:
                self.pop(f"#{sid} .badge", t0 + 0.3 + len(words) * 0.12, rot=0)
        return (
            '<div class="lrow">'
            + (f'<div class="lkick">// {esc(kick)}</div>' if kick else "")
            + f'<div class="lline"><div class="label" style="font-size:{size}px">{" ".join(spans)}</div>{badge}</div></div>'
        )

    # ── cards
    def card(self, sid: str, c: dict[str, Any], t0: float) -> str:
        kind = str(c.get("kind") or "")
        fn = getattr(self, f"c_{kind}", None)
        if not fn:
            return ""
        out: str = fn(sid, c, t0)
        return out

    def _enter(self, sel: str, at: float, rot: float = 0.0) -> None:
        self.ft(sel, {"opacity": 0, "y": 90, "scale": 0.88, "rotation": rot - 3},
                {"opacity": 1, "y": 0, "scale": 1, "rotation": rot, "duration": 0.5, "ease": "back.out(1.5)"}, at)  # fmt: skip
        self.cue(at, "pop", 0.4)

    def c_app(self, sid: str, c: dict[str, Any], t0: float) -> str:
        lk = self.lk
        rows = [r for r in c.get("rows") or [] if isinstance(r, dict)][:5]
        title = esc(c.get("title") or "AI Video Editor")
        status = str(c.get("status") or "")
        body = []
        at = t0 + 0.6
        icons = {"done": "✓", "run": "", "need": "!", "todo": ""}
        for k, r in enumerate(rows):
            st = str(r.get("state") or "done")
            tag = f"<em>{esc(r.get('tag'))}</em>" if r.get("tag") else ""
            meta = f"<u>{esc(r.get('meta'))}</u>" if r.get("meta") else ""
            need = (
                f'<strong style="background:{lk.accent}">needs you</strong>' if st == "need" else ""
            )
            body.append(
                f'<div class="arow ar{k} {st}"><i class="ico">{icons.get(st, "")}</i><span>{esc(r.get("text"))}</span>{tag}{need}{meta}</div>'
            )
            self.ft(f"#{sid} .ar{k}", {"opacity": 0, "x": -24}, {"opacity": 1, "x": 0, "duration": 0.25, "ease": "power2.out"}, at)  # fmt: skip
            if st == "done":
                self.ft(f"#{sid} .ar{k} .ico", {"scale": 0}, {"scale": 1, "duration": 0.25, "ease": "back.out(3)"}, at + 0.15)  # fmt: skip
                self.cue(at + 0.15, "tick", 0.3)
            at += 0.32
        inp = str(c.get("input") or "")
        input_html = ""
        if inp:
            input_html = '<div class="ainput"><span class="atyped"></span><i class="caret"></i><b>↑</b></div>'
            self.typed(f"#{sid} .atyped", inp, at + 0.1)
        st_html = ""
        if status:
            st_html = f'<div class="astatus"><i class="spark">✳</i>{esc(status)}<span class="aprog">{esc(c.get("progress") or "")}</span></div>'
        empty = ""
        if not rows and not status:
            empty = f'<div class="aempty"><i class="spark big">✳</i><div>{esc(c.get("prompt") or "What should we build?")}</div></div>'
        self._enter(f"#{sid} .app", t0 + 0.25)
        return (
            f'<div class="card app"><div class="atop"><i></i><i></i><i></i><span>{title} ⌄</span></div>'
            f'<div class="asub">{esc(c.get("sub") or "Started on this computer")}</div>'
            f"{st_html}{''.join(body)}{empty}{input_html}</div>"
        )

    def c_browser(self, sid: str, c: dict[str, Any], t0: float) -> str:
        src = self.media.get(str(c.get("media") or ""), "")
        view = (
            f'<img src="{esc(src)}">'
            if src
            else f'<div class="bempty"><i class="spark big" style="color:{self.lk.accent}">✳</i>'
            f'<div class="bq">{esc(c.get("prompt") or "How can I help you today?")}</div>'
            f'<div class="bin">{esc(c.get("input") or "Ask anything")}</div></div>'
        )
        self._enter(f"#{sid} .browser", t0 + 0.25)
        if src:
            self.ft(f"#{sid} .browser img", {"y": 0}, {"y": -80, "duration": 3.0, "ease": "sine.inOut"}, t0 + 0.6)  # fmt: skip
        return (
            f'<div class="card browser"><div class="btab"><i></i><i></i><i></i><span class="tab">{esc(c.get("tab") or c.get("url") or "")}</span></div>'
            f'<div class="burl">⟵ ⟶ ⟳ <span>🔒 {esc(c.get("url") or "")}</span></div><div class="bview">{view}</div></div>'
        )

    def c_phone(self, sid: str, c: dict[str, Any], t0: float) -> str:
        src = self.media.get(str(c.get("media") or ""), "")
        if src:
            inner = f'<img src="{esc(src)}">'
        else:
            title = _accented(str(c.get("title") or ""), "pacc")
            big = esc(c.get("big") or "")
            inner = (
                f'<div class="ptitle">{title}</div>'
                + (f'<div class="pbig">{big}</div>' if big else "")
                + '<div class="pwave">'
                + "".join(f'<i style="height:{self.rng.randint(14, 70)}px"></i>' for _ in range(22))
                + "</div>"
            )
            if big:
                self.pop(f"#{sid} .pbig", t0 + 0.8, rot=-3)
            self.ft(f"#{sid} .pwave i", {"scaleY": 0.2}, {"scaleY": 1, "duration": 0.3, "stagger": 0.03, "ease": "power2.out"}, t0 + 0.7)  # fmt: skip
        self._enter(f"#{sid} .phone", t0 + 0.25, rot=-2)
        return f'<div class="phone"><div class="notch"></div><div class="pscr">{inner}</div></div>'

    def c_chat(self, sid: str, c: dict[str, Any], t0: float) -> str:
        msgs = [m for m in c.get("messages") or [] if isinstance(m, dict)][:3]
        rows = []
        for k, m in enumerate(msgs):
            me = str(m.get("who") or "me") == "me"
            rows.append(f'<div class="msg m{k} {"me" if me else "ai"}">{esc(m.get("text"))}</div>')
            self.ft(f"#{sid} .m{k}", {"opacity": 0, "y": 30, "scale": 0.9}, {"opacity": 1, "y": 0, "scale": 1, "duration": 0.35, "ease": "back.out(1.8)"}, t0 + 0.5 + k * 0.6)  # fmt: skip
            self.cue(t0 + 0.5 + k * 0.6, "pop", 0.3)
        self._enter(f"#{sid} .chat", t0 + 0.2)
        return f'<div class="card chat">{"".join(rows)}</div>'

    def c_list(self, sid: str, c: dict[str, Any], t0: float) -> str:
        items = [str(x) for x in c.get("items") or [] if str(x).strip()][:5]
        rows = "".join(
            f'<div class="li l{k}"><b>✓</b><span>{_accented(x)}</span></div>'
            for k, x in enumerate(items)
        )
        for k in range(len(items)):
            at = t0 + 0.5 + k * 0.35
            self.ft(f"#{sid} .l{k}", {"opacity": 0, "x": 50}, {"opacity": 1, "x": 0, "duration": 0.3, "ease": "power3.out"}, at)  # fmt: skip
            self.ft(f"#{sid} .l{k} b", {"scale": 0}, {"scale": 1, "duration": 0.3, "ease": "back.out(3)"}, at + 0.15)  # fmt: skip
            self.cue(at + 0.15, "tick", 0.3)
        self._enter(f"#{sid} .list", t0 + 0.2)
        return f'<div class="card list">{rows}</div>'

    def c_stats(self, sid: str, c: dict[str, Any], t0: float) -> str:
        stats = [x for x in c.get("stats") or [] if isinstance(x, dict)][:3]
        boxes = []
        for k, x in enumerate(stats):
            val = str(x.get("value") or "")
            sz = max(70, min(140, int(260 / max(2, len(val)) / 0.5)))
            boxes.append(
                f'<div class="stat st{k}{" dk" if k % 2 else ""}"><div class="num" style="font-size:{sz}px">{esc(val)}</div><div class="slab">{esc(x.get("label"))}</div></div>'
            )
            self.pop(f"#{sid} .st{k}", t0 + 0.3 + k * 0.2, rot=(k - 1) * 2.5)
        return f'<div class="stats">{"".join(boxes)}</div>'

    def c_code(self, sid: str, c: dict[str, Any], t0: float) -> str:
        lines = [str(x)[:44] for x in c.get("lines") or []][:8]
        body = "".join(
            f'<div class="cl{k}">{esc(x) or "&nbsp;"}</div>' for k, x in enumerate(lines)
        )
        for k in range(len(lines)):
            self.ft(f"#{sid} .cl{k}", {"opacity": 0, "x": -16}, {"opacity": 1, "x": 0, "duration": 0.2}, t0 + 0.5 + k * 0.12)  # fmt: skip
        self._enter(f"#{sid} .code", t0 + 0.2)
        return f'<div class="card code app"><div class="atop"><i></i><i></i><i></i><span>{esc(c.get("title") or "")}</span></div><div class="src">{body}</div></div>'

    def c_folder(self, sid: str, c: dict[str, Any], t0: float) -> str:
        files = [str(x)[:18] for x in c.get("files") or []][:5]
        sheets = "".join(
            f'<div class="sheet sh{k}" style="left:{70 + k * 105}px;transform:rotate({(k - len(files) / 2) * 5:.1f}deg)">'
            f"<b>{esc(x)}</b><i></i><i></i><i></i></div>"
            for k, x in enumerate(files)
        )
        for k in range(len(files)):
            self.ft(f"#{sid} .sh{k}", {"y": 160, "opacity": 0}, {"y": 0, "opacity": 1, "duration": 0.4, "ease": "back.out(1.6)"}, t0 + 0.7 + k * 0.18)  # fmt: skip
            self.cue(t0 + 0.7 + k * 0.18, "pop", 0.3)
        self._enter(f"#{sid} .folder", t0 + 0.2)
        return f'<div class="folder"><div class="fback"></div>{sheets}<div class="ffront"><div class="fname">🗂 {esc(c.get("name") or "My folder")}</div></div></div>'

    def c_image(self, sid: str, c: dict[str, Any], t0: float) -> str:
        src = self.media.get(str(c.get("media") or ""), "")
        if not src:
            return ""
        self._enter(f"#{sid} .imgcard", t0 + 0.2, rot=-1.5)
        self.ft(f"#{sid} .imgcard img", {"scale": 1}, {"scale": 1.07, "duration": 3.5, "ease": "none"}, t0)  # fmt: skip
        cap = f'<div class="icap">{esc(c.get("caption"))}</div>' if c.get("caption") else ""
        return f'<div class="card imgcard"><img src="{esc(src)}">{cap}</div>'

    def c_compare(self, sid: str, c: dict[str, Any], t0: float) -> str:
        b, a = dict(c.get("before") or {}), dict(c.get("after") or {})

        def side(d: dict[str, Any], cls: str, tag: str) -> str:
            src = self.media.get(str(d.get("media") or ""), "")
            inner = (
                f'<img src="{esc(src)}">'
                if src
                else f'<div class="ctext">{_accented(str(d.get("text") or ""))}</div>'
            )
            return f'<div class="cside {cls}"><div class="ctag">{tag}</div>{inner}</div>'

        self._enter(f"#{sid} .cb", t0 + 0.2, rot=-3)
        self._enter(f"#{sid} .ca", t0 + 0.75, rot=2)
        return f'<div class="cmp">{side(b, "cb", esc(c.get("before_tag") or "BEFORE"))}{side(a, "ca", esc(c.get("after_tag") or "AFTER"))}</div>'

    # ── props (over a scene)
    def props(self, sid: str, s: dict[str, Any], t0: float, t1: float) -> str:
        out = []
        lk = self.lk
        for k, p in enumerate([p for p in s.get("props") or [] if isinstance(p, dict)][:3]):
            kind = str(p.get("kind") or "")
            at = t0 + float(p.get("at") or (0.9 + k * 0.4))
            at = min(at, max(t0 + 0.2, t1 - 0.4))
            pid = f"{sid}p{k}"
            text = str(p.get("text") or "")
            if kind == "sticker":
                lines = "".join(f"<div>{_accented(x)}</div>" for x in text.split("\n")[:3])
                out.append(f'<div id="{pid}" class="sticker">{lines}</div>')
                self.pop(f"#{pid}", at, rot=-5)
            elif kind == "stamp":
                out.append(
                    f'<div id="{pid}" class="stamp"><svg viewBox="0 0 100 100"><path d="M18 18 L82 82 M82 18 L18 82" stroke="{lk.accent}" stroke-width="14" stroke-linecap="round"/></svg></div>'
                )
                self.ft(f"#{pid}", {"opacity": 0, "scale": 2.2, "rotation": -20}, {"opacity": 1, "scale": 1, "rotation": -8, "duration": 0.28, "ease": "power4.in"}, at)  # fmt: skip
                self.cue(at + 0.26, "stamp", 0.6)
            elif kind == "check":
                out.append(f'<div id="{pid}" class="checkb">✓</div>')
                self.pop(f"#{pid}", at)
                self.cue(at, "tick", 0.4)
            elif kind == "bubble":
                out.append(
                    f'<div id="{pid}" class="bubble"><div class="bk">// {esc(p.get("kick") or "you, out loud")}</div><div class="bt"></div></div>'
                )
                self.pop(f"#{pid}", at, rot=0, scale=0.7)
                self.typed(f"#{pid} .bt", plain(text)[:60], at + 0.3, cps=16)
            elif kind == "circle":
                out.append(
                    f'<svg id="{pid}" class="ring" viewBox="0 0 300 200"><ellipse cx="150" cy="100" rx="136" ry="84" fill="none" stroke="{lk.accent}" stroke-width="7" stroke-dasharray="760" stroke-dashoffset="760" transform="rotate(-6 150 100)"/></svg>'
                )
                self.ft(f"#{pid} ellipse", {"strokeDashoffset": 760}, {"strokeDashoffset": 0, "duration": 0.5, "ease": "power2.inOut"}, at)  # fmt: skip
                self.cue(at, "scribble", 0.4, dur=0.45)
            elif kind == "cursor":
                out.append(
                    f'<div id="{pid}" class="cursor"><svg viewBox="0 0 40 52"><path d="M4 2 L4 42 L14 32 L22 50 L30 46 L22 29 L36 29 Z" fill="#fff" stroke="#111" stroke-width="3" stroke-linejoin="round"/></svg><i class="ripple"></i></div>'
                )
                self.ft(f"#{pid}", {"opacity": 0, "x": 260, "y": 260}, {"opacity": 1, "x": 0, "y": 0, "duration": 0.55, "ease": "power3.out"}, at)  # fmt: skip
                self.ft(f"#{pid} svg", {"scale": 1}, {"scale": 0.82, "duration": 0.08, "yoyo": True, "repeat": 1}, at + 0.62)  # fmt: skip
                self.ft(f"#{pid} .ripple", {"scale": 0.2, "opacity": 0.9}, {"scale": 2.4, "opacity": 0, "duration": 0.45}, at + 0.64)  # fmt: skip
                self.cue(at + 0.64, "click", 0.6)
            elif kind == "confetti":
                bits = []
                for j in range(26):
                    ang = self.rng.uniform(-2.6, -0.5)
                    dist = self.rng.uniform(260, 620)
                    col = self.rng.choice([lk.accent, lk.ink, "#f2b632", "#ffffff"])
                    bits.append(
                        f'<i class="cf cf{j}" style="background:{col};width:{self.rng.randint(10, 22)}px;height:{self.rng.randint(8, 30)}px"></i>'
                    )
                    import math

                    self.ft(f"#{pid} .cf{j}", {"x": 0, "y": 0, "rotation": 0, "opacity": 1},
                            {"x": round(math.cos(ang) * dist), "y": round(math.sin(ang) * dist + 420), "rotation": self.rng.randint(-540, 540),
                             "opacity": 0, "duration": 1.6, "ease": "power2.out"}, at)  # fmt: skip
                out.append(f'<div id="{pid}" class="confetti">{"".join(bits)}</div>')
                self.cue(at, "popper", 0.7)
                self.cue(at + 0.05, "shimmer", 0.35, dur=0.9)
            elif kind in ("box", "envelope"):
                body = (
                    f'<div class="boxp"><div class="lid"></div><div class="bx"><b>{esc(text or "tools")}</b></div></div>'
                    if kind == "box"
                    else f'<div class="env"><div class="flap"></div><b>{esc(text or "HOW?")}</b></div>'
                )
                out.append(f'<div id="{pid}" class="prop">{body}</div>')
                self.pop(f"#{pid}", at, rot=-4)
        return "".join(out)

    # ── scenes
    def scene(
        self, i: int, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        sid = f"s{i}"
        kind = str(s.get("type") or "label")
        dark = kind == "board"
        dur = round(t1 - t0, 3)
        body = getattr(self, f"sc_{kind}", self.sc_label)(sid, s, t0, t1, prev)
        bg = ""
        if dark:
            bg = '<div class="cork"></div>'
        return (
            f'<div id="{sid}" class="clip scene" data-start="{t0:.3f}" data-duration="{dur}" data-track-index="1">'
            f'{bg}{self.kicker(sid, s, dark)}<div class="stage">{body}</div>{self.props(sid, s, t0, t1)}</div>'
        )

    def sc_label(
        self, sid: str, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        same = bool(
            prev
            and prev.get("label")
            and prev.get("label") == s.get("label")
            and prev.get("badge") == s.get("badge")
        )
        out = self.label(sid, s, t0, same)
        c = s.get("card")
        if isinstance(c, dict):
            out += self.card(sid, c, t0)
        return out

    def sc_big(
        self, sid: str, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        text = str(s.get("big") or "")
        sub = str(s.get("sub") or "")
        if re.fullmatch(r"\d{1,2}", text.strip()):
            n = int(text)
            total = max(len(self.steps), n)
            self.pop(f"#{sid} .bigtile", t0 + 0.1, rot=0, scale=0.3)
            self.ft(f"#{sid} .bigring ellipse", {"strokeDashoffset": 1300}, {"strokeDashoffset": 0, "duration": 0.6, "ease": "power2.inOut"}, t0 + 0.3)  # fmt: skip
            self.cue(t0 + 0.1, "impact", 0.5)
            return (
                f'<div class="bigwrap"><svg class="bigring" viewBox="0 0 440 440"><ellipse cx="220" cy="220" rx="205" ry="205" fill="none" stroke="{self.lk.accent}" stroke-width="5" stroke-dasharray="1300" stroke-dashoffset="1300"/></svg>'
                f"{self.badge(n, total, 'bigtile')}</div>"
                + (f'<div class="bigsub">{_accented(sub)}</div>' if sub else "")
            )
        words = re.findall(r"\*[^*]+\*|\S+", text)
        spans = " ".join(
            f'<span class="bw bw{k}{" hot" if w.startswith("*") and len(w) > 2 else ""}">{esc(plain(w).upper())}</span>'
            for k, w in enumerate(words)
        )
        for k in range(len(words)):
            self.ft(f"#{sid} .bw{k}", {"opacity": 0, "scale": 1.6, "y": -30}, {"opacity": 1, "scale": 1, "y": 0, "duration": 0.3, "ease": "power4.out"}, t0 + 0.1 + k * 0.18)  # fmt: skip
            self.cue(t0 + 0.1 + k * 0.18, "impact" if k == 0 else "thud", 0.4)
        size = max(110, min(230, int(900 / max(4, len(plain(text))) / 0.48)))
        return f'<div class="bigtext" style="font-size:{size}px">{spans}</div>' + (
            f'<div class="bigsub">{_accented(sub)}</div>' if sub else ""
        )

    def sc_roadmap(
        self, sid: str, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        steps = self.steps or [{"title": str(x)} for x in s.get("items") or []]
        n = len(steps)
        active = int(s.get("active") or 0)
        done = int(s.get("done") or 0)
        title = str(s.get("title") or f"*{n}* STEPS")
        tiles = []
        # a snake: 1 2 / 4 3 / 5 6 … like the reel's roadmap
        order = []
        for r in range((n + 1) // 2):
            pair = [2 * r, 2 * r + 1]
            if r % 2:
                pair.reverse()
            order.extend(pair)
        for k in order:
            if k >= n:
                tiles.append('<div class="tile ghost"></div>')
                continue
            st = steps[k]
            cls = "tile" + (" on" if k + 1 == active else "") + (" done" if k + 1 <= done else "")
            check = '<span class="tcheck">✓</span>' if k + 1 <= done else ""
            tiles.append(
                f'<div class="{cls} t{k}"><b>{k + 1}</b><div><div class="tt">{esc(st.get("title"))}</div>'
                f'<div class="ts">// {esc(st.get("sub") or "")}</div></div>{check}</div>'
            )
            at = t0 + 0.35 + k * 0.14
            self.pop(f"#{sid} .t{k}", at, rot=0, sound=k % 2 == 0)
            if k + 1 <= done:
                self.ft(f"#{sid} .t{k} .tcheck", {"scale": 0}, {"scale": 1, "duration": 0.25, "ease": "back.out(3)"}, at + 0.5 + k * 0.1)  # fmt: skip
                self.cue(at + 0.5 + k * 0.1, "tick", 0.35)
        if active:
            self.ft(f"#{sid} .t{active - 1}", {"scale": 1}, {"scale": 1.08, "duration": 0.25, "yoyo": True, "repeat": 1}, t0 + 0.4 + n * 0.14)  # fmt: skip
        self.ft(f"#{sid} .snake path", {"strokeDashoffset": 3000}, {"strokeDashoffset": 0, "duration": 0.9, "ease": "power2.inOut"}, t0 + 0.2)  # fmt: skip
        rows = (n + 1) // 2
        hgt = rows * 150
        path = "M-40 75 " + " ".join(
            (f"L1000 {75 + r * 150} " if r % 2 == 0 else f"L-20 {75 + r * 150} ")
            + (
                f"Q1080 {75 + r * 150} 1080 {150 + r * 150} Q1080 {225 + r * 150} 1000 {225 + r * 150} "
                if r % 2 == 0 and r + 1 < rows
                else ""
            )
            + (
                f"Q-100 {75 + r * 150} -100 {150 + r * 150} Q-100 {225 + r * 150} -20 {225 + r * 150} "
                if r % 2 == 1 and r + 1 < rows
                else ""
            )
            for r in range(rows)
        )
        head = self._label_html(sid, title, t0)
        return (
            head
            + f'<div class="road" style="height:{hgt}px"><svg class="snake" viewBox="-120 0 1320 {hgt}" preserveAspectRatio="none">'
            f'<path d="{path}" fill="none" stroke="{self.lk.accent}" stroke-width="10" stroke-linecap="round" stroke-dasharray="3000" stroke-dashoffset="3000" opacity=".9"/></svg>'
            f'<div class="tiles">{"".join(tiles)}</div></div>'
        )

    def _label_html(self, sid: str, text: str, t0: float) -> str:
        words = re.findall(r"\*[^*]+\*|\S+", text)
        spans = " ".join(
            f'<span class="lw lw{k}{" hot" if w.startswith("*") and len(w) > 2 else ""}">{esc(plain(w).upper())}</span>'
            for k, w in enumerate(words)
        )
        for k, w in enumerate(words):
            at = t0 + 0.05 + k * 0.12
            hot = w.startswith("*") and len(w) > 2
            self.ft(f"#{sid} .lw{k}", {"opacity": 0, "y": 40}, {"opacity": 1, "y": 0, "duration": 0.25, "ease": "power3.out"}, at)  # fmt: skip
            self.ft(f"#{sid} .lw{k}", {"color": "rgba(0,0,0,0)"}, {"color": self.lk.accent if hot else self.lk.ink, "duration": 0.18}, at + 0.16)  # fmt: skip
        return f'<div class="lline center"><div class="label" style="font-size:120px">{spans}</div></div>'

    def sc_board(
        self, sid: str, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        notes = [n for n in s.get("notes") or [] if isinstance(n, (str, dict))][:6]
        spots = [
            (40, 0, -6),
            (360, -30, 4),
            (650, 10, -3),
            (20, 380, 3),
            (640, 360, -5),
            (60, 720, -2),
        ]
        cells = []
        for k, n in enumerate(notes):
            d = n if isinstance(n, dict) else {"label": n}
            x, y, r = spots[k]
            src = self.media.get(str(d.get("media") or ""), "")
            pic = (
                f'<img src="{esc(src)}">'
                if src
                else f'<div class="pblank" style="background:{["#2d3a4a", "#e9e2d4", "#3b3f2f", "#1f2430", "#4a2f2a", "#253b3a"][k]}"><span>{esc(plain(d.get("label"))[:16])}</span></div>'
            )
            cells.append(
                f'<div class="polar pl{k}" style="left:{x}px;top:{y}px;transform:rotate({r}deg)"><div class="pp">{pic}</div><div class="plab">{esc(plain(d.get("label"))[:18])}</div><i class="pin"></i></div>'
            )
            self.ft(f"#{sid} .pl{k}", {"opacity": 0, "y": -60, "scale": 1.15}, {"opacity": 1, "y": 0, "scale": 1, "duration": 0.35, "ease": "power3.out"}, t0 + 0.05 + k * 0.12)  # fmt: skip
        self.cue(t0 + 0.05, "tap", 0.4)
        sticky = str(s.get("sticky") or "")
        st_html = ""
        if sticky:
            st_html = f'<div class="sticky"><i class="pin" style="background:#e6c23a"></i>{esc(sticky)}</div>'
            self.pop(f"#{sid} .sticky", t0 + 0.7, rot=-4)
        stamp = str(s.get("stamp") or "")
        stamp_html = ""
        if stamp:
            top, _, big = stamp.partition("|")
            stamp_html = f'<div class="bstamp"><div class="bs1">{esc(top)}</div><div class="bs2">{esc(big or "")}</div></div>'
            at = t0 + float(s.get("stamp_at") or max(0.6, (t1 - t0) * 0.45))
            self.ft(f"#{sid} .bstamp", {"opacity": 0, "scale": 2.4, "rotation": -14}, {"opacity": 1, "scale": 1, "rotation": -3, "duration": 0.3, "ease": "power4.in"}, at)  # fmt: skip
            self.cue(at + 0.28, "impact", 0.7)
        lens = '<div class="lens"></div>'
        self.ft(f"#{sid} .lens", {"x": 640, "y": 40}, {"x": 330, "y": 420, "duration": max(1.0, t1 - t0), "ease": "sine.inOut"}, t0)  # fmt: skip
        return f'<div class="board">{"".join(cells)}{st_html}{lens}{stamp_html}</div>'

    def sc_cta(
        self, sid: str, s: dict[str, Any], t0: float, t1: float, prev: dict[str, Any] | None
    ) -> str:
        word = re.sub(r"[^A-Za-z0-9]", "", str(s.get("word") or "GUIDE")).upper()[:14] or "GUIDE"
        self.pop(f"#{sid} .cmtag", t0 + 0.1, rot=-3)
        self.pop(f"#{sid} .cbar", t0 + 0.3, rot=0, scale=0.8)
        self.typed(f"#{sid} .cword", word, t0 + 0.6, cps=9)
        self.ft(f"#{sid} .send", {"scale": 1}, {"scale": 1.25, "duration": 0.12, "yoyo": True, "repeat": 1}, t0 + 0.7 + len(word) / 9)  # fmt: skip
        self.cue(t0 + 0.7 + len(word) / 9, "click", 0.6)
        hearts = "".join(
            f'<i class="heart h{k}" style="left:{self.rng.randint(60, 820)}px">♥</i>'
            for k in range(8)
        )
        for k in range(8):
            at = t0 + 1.0 + k * 0.18
            self.ft(f"#{sid} .h{k}", {"y": 0, "opacity": 0, "scale": 0.5}, {"y": -self.rng.randint(260, 520), "opacity": 1, "scale": 1.2, "duration": 1.2, "ease": "power2.out"}, at)  # fmt: skip
        lead = esc(s.get("lead") or "comment")
        return (
            f'<div class="ctawrap"><div class="cmtag">{lead.upper()} ↓</div><div class="cbar"><i class="cav"></i>'
            f'<span class="cword"></span><i class="caret"></i><b class="send">↑</b></div>'
            f'<div class="ctail">{_accented(str(s.get("tail") or ""))}</div>{hearts}</div>'
        )

    # ── the host
    def host_track(
        self, scenes: list[tuple[dict[str, Any], float, float]], mouth: list[int]
    ) -> str:
        dd = self.D
        last = None
        for s, t0, _ in scenes:
            p = str(s.get("pose") or "explain")
            if p not in toonhost.POSES:
                p = "explain"
            if p != last:
                self.tw.extend(toonhost.pose_tweens(p, max(0.0, t0 - 0.05), instant=last is None))
                if last is not None:
                    self.ft("#hostwrap", {"y": 0}, {"y": -16, "duration": 0.12, "yoyo": True, "repeat": 1, "ease": "power2.out"}, t0)  # fmt: skip
                last = p
            if s.get("type") == "board":
                self.put("#hostwrap", {"filter": "drop-shadow(0 0 0 transparent)"}, t0)
        # breathing
        t, k = 0.0, 0
        while t < dd:
            d = min(1.9, dd - t)
            self.to("#host", {"scaleY": 1.012 if k % 2 == 0 else 1.0, "svgOrigin": "300 760", "duration": round(d, 3), "ease": "sine.inOut"}, t)  # fmt: skip
            t += 1.9
            k += 1
        # blinks
        t = 1.4
        while t < dd - 0.3:
            self.to("#eyes", {"scaleY": 0.1, "svgOrigin": "300 258", "duration": 0.06}, t)
            self.to("#eyes", {"scaleY": 1, "svgOrigin": "300 258", "duration": 0.08}, t + 0.1)
            t += 2.6 + self.rng.random() * 1.9
        # brows lift on every new scene
        for _, t0, _ in scenes[1:]:
            self.ft("#brows", {"y": 0}, {"y": -10, "duration": 0.15, "yoyo": True, "repeat": 1}, t0)  # fmt: skip
        # the mouth follows the voice
        return (
            "(function(){var m=" + json.dumps(mouth) + ";var o={t:0};var last=-1;"
            "function show(k){if(k===last)return;last=k;for(var j=0;j<3;j++){var e=document.getElementById('mouth'+j);if(e)e.setAttribute('opacity',j===k?1:0);}}"
            f"tl.to(o,{{t:{dd},duration:{dd},ease:'none',onUpdate:function(){{var i=Math.floor(o.t*30);show(i<m.length?m[i]:0);}}}},0);}})();"
        )

    # ── captions
    def captions(
        self,
        groups: list[list[dict[str, Any]]],
        accents: set[str],
        dark_spans: list[tuple[float, float]],
    ) -> str:
        out = []
        for g_i, g in enumerate(groups):
            if not g:
                continue
            start = float(g[0]["t"])
            end = (
                float(groups[g_i + 1][0]["t"])
                if g_i + 1 < len(groups) and groups[g_i + 1]
                else self.D
            )
            spans = []
            for k, w in enumerate(g):
                txt = str(w.get("w") or "").strip()
                hot = _norm(txt) in accents
                spans.append(
                    f'<span class="cw c{g_i}w{k}{" acc" if hot else ""}">{esc(txt)}</span>'
                )
                t = float(w["t"])
                e = max(t + 0.08, float(w.get("end") or t + 0.2))
                self.ft(f".c{g_i}w{k}", {"opacity": 0, "y": 14}, {"opacity": 0.32, "y": 0, "duration": 0.1, "ease": "power2.out"}, t - 0.02)  # fmt: skip
                self.to(f".c{g_i}w{k}", {"opacity": 1, "duration": 0.12}, e - 0.08)
            dark = any(a <= start < b for a, b in dark_spans)
            colour = ' style="color:#fff"' if dark else ""
            out.append(
                f'<div id="cap{g_i}" class="clip cap" data-start="{start - 0.02:.3f}" data-duration="{max(0.2, end - start):.3f}" data-track-index="3"'
                f"{colour}>{' '.join(spans)}</div>"
            )
        return "".join(out)

    # ── halftone wipes between parts
    def wipes(self, times: list[float]) -> str:
        els = []
        for k, t in enumerate(times):
            els.append(
                f'<div id="wipe{k}" class="clip wipe" data-start="{max(0, t - 0.35):.3f}" data-duration="0.8" data-track-index="5"></div>'
            )
            self.ft(f"#wipe{k}", {"--r": "0px", "--p": "-40%"}, {"--r": "17px", "--p": "60%", "duration": 0.35, "ease": "power2.in"}, max(0, t - 0.35))  # fmt: skip
            self.to(
                f"#wipe{k}", {"--r": "0px", "--p": "140%", "duration": 0.4, "ease": "power2.out"}, t
            )
            self.cue(t - 0.3, "whoosh", 0.45, dur=0.5)
        return "".join(els)


CSS = """
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--bg)}
#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:var(--bg);font-family:'%(ui)s',sans-serif;color:var(--ink)}
.paper{position:absolute;inset:0;opacity:.55;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .42  0 0 0 0 .38  0 0 0 .22 0'/></filter><rect width='240' height='240' filter='url(%%23n)'/></svg>")}
.scene{position:absolute;inset:0}
.cork{position:absolute;inset:0;background:radial-gradient(ellipse at 50%% 45%%,#a07648 0%%,var(--cork) 55%%,#2e2014 100%%)}
.cork:after{content:'';position:absolute;inset:0;opacity:.6;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='3'/><feColorMatrix values='0 0 0 0 .2  0 0 0 0 .13  0 0 0 0 .06  0 0 0 .55 0'/></filter><rect width='200' height='200' filter='url(%%23n)'/></svg>")}
.kick{position:absolute;left:120px;top:136px;font:400 26px/1 '%(mono)s',monospace;letter-spacing:.02em}
.cap{position:absolute;left:120px;top:206px;width:880px;font:500 70px/1.12 '%(caption)s',sans-serif;letter-spacing:-.015em;color:var(--ink)}
.cw{display:inline-block;opacity:0}
.cw.acc,.acc{font-family:'%(serif)s',serif;font-style:italic;font-weight:500;color:var(--accent);font-size:1.12em;letter-spacing:-.01em}
.stage{position:absolute;left:56px;right:56px;top:470px;height:880px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:26px}
.lrow{flex:none;width:100%%}
.lkick{font:400 24px/1 '%(mono)s',monospace;color:var(--muted);margin:0 0 6px 6px}
.lline{display:flex;align-items:center;justify-content:center;gap:34px;width:100%%}
.label{font-family:'%(label)s',sans-serif;font-weight:700;text-transform:uppercase;line-height:.95;letter-spacing:-.01em;white-space:nowrap}
.lw{display:inline-block;color:transparent;-webkit-text-stroke:3px var(--ink)}
.lw.hot{-webkit-text-stroke-color:var(--accent)}
.badge{flex:none;width:96px;height:104px;border-radius:18px;background:var(--dark);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;box-shadow:0 10px 24px -10px rgba(0,0,0,.5)}
.badge b{font:700 66px/1 '%(label)s',sans-serif}
.dots{display:flex;gap:4px}.dots i{width:7px;height:7px;border-radius:50%%}
.card{flex:none;width:100%%;border-radius:22px;box-shadow:0 34px 60px -26px rgba(40,30,20,.5)}
.app{background:#1e1d22;color:#ece9e4;padding:22px 28px 26px;width:860px;border:1px solid #333}
.atop{display:flex;align-items:center;gap:10px;font:600 26px/1 '%(ui)s',sans-serif;margin-bottom:14px}
.atop i{width:13px;height:13px;border-radius:50%%;background:#4a4950}
.atop span{margin-left:14px}
.asub{font:400 20px/1 '%(ui)s',sans-serif;color:#8f8c95;margin-bottom:18px}
.astatus{display:flex;align-items:center;gap:12px;font:600 28px/1.2 '%(ui)s',sans-serif;margin-bottom:14px}
.aprog{margin-left:auto;font-weight:500;color:#b5b2ba}
.spark{color:var(--accent);font-style:normal}
.spark.big{font-size:70px;display:block;text-align:center}
.arow{display:flex;align-items:center;gap:14px;font:500 30px/1.2 '%(ui)s',sans-serif;padding:12px 10px;border-radius:12px}
.arow .ico{flex:none;width:36px;height:36px;border-radius:50%%;display:flex;align-items:center;justify-content:center;font:700 22px/1 '%(ui)s',sans-serif;font-style:normal;background:#d9d6df;color:#1e1d22}
.arow.need{background:#4a1d1d}.arow.need .ico{background:var(--accent);color:#fff}
.arow.run .ico{background:transparent;border:4px solid #77747c;border-top-color:var(--accent)}
.arow.todo{opacity:.55}.arow.todo .ico{background:transparent;border:3px dashed #77747c}
.arow em{font:400 18px/1 '%(mono)s',monospace;font-style:normal;color:#b9b6bf;background:#2d2c33;padding:6px 10px;border-radius:8px}
.arow strong{font:700 20px/1 '%(ui)s',sans-serif;color:#fff;padding:8px 14px;border-radius:999px}
.arow u{margin-left:auto;text-decoration:none;font:400 22px/1 '%(mono)s',monospace;color:#9a97a0}
.aempty{padding:60px 0 40px;text-align:center;font:500 32px/1.3 '%(ui)s',sans-serif;color:#cfccd4}
.ainput{margin-top:18px;display:flex;align-items:center;gap:6px;border:3px solid var(--accent);border-radius:18px;padding:18px 20px;font:500 30px/1 '%(ui)s',sans-serif;color:#fff}
.ainput b{margin-left:auto;width:46px;height:46px;border-radius:50%%;background:#ece9e4;color:#1e1d22;display:flex;align-items:center;justify-content:center;font-size:26px}
.caret{display:inline-block;width:3px;height:34px;background:currentColor}
.browser{background:#f7f5f1;border:2px solid #d8d3ca;overflow:hidden;width:880px;height:560px;display:flex;flex-direction:column}
.btab{height:54px;background:#e5e0d8;display:flex;align-items:center;gap:10px;padding:0 20px}
.btab i{width:13px;height:13px;border-radius:50%%}.btab i:nth-child(1){background:#ee6a5f}.btab i:nth-child(2){background:#f5be4f}.btab i:nth-child(3){background:#62c554}
.btab .tab{margin-left:20px;background:#f7f5f1;border-radius:10px 10px 0 0;padding:14px 30px;font:500 22px/1 '%(ui)s',sans-serif;color:#333}
.burl{height:52px;display:flex;align-items:center;gap:10px;padding:0 20px;font:400 22px/1 '%(ui)s',sans-serif;color:#777;border-bottom:1px solid #e2ddd4}
.burl span{flex:1;background:#ece8e1;border-radius:999px;padding:9px 18px;color:#333}
.bview{flex:1;overflow:hidden;position:relative}
.bview img{width:100%%;display:block}
.bempty{padding:56px 60px;text-align:center}
.bq{font:400 44px/1.2 '%(serif)s',serif;color:#3b3833;margin-top:10px}
.bin{margin:34px auto 0;width:86%%;text-align:left;border:2px solid #e2ddd4;border-radius:18px;padding:22px;font:400 26px/1 '%(ui)s',sans-serif;color:#aaa}
.phone{flex:none;position:relative;width:380px;height:720px;border:14px solid #121214;border-radius:64px;background:#fff;box-shadow:0 40px 70px -30px rgba(40,30,20,.6);overflow:hidden}
.notch{position:absolute;left:50%%;top:14px;width:150px;height:40px;margin-left:-75px;background:#121214;border-radius:999px;z-index:2}
.pscr{position:absolute;inset:0;overflow:hidden;background:linear-gradient(#f7f2ea,#e8ecef)}
.pscr img{width:100%%;height:100%%;object-fit:cover}
.ptitle{margin:96px 26px 0;font:600 36px/1.15 '%(caption)s',sans-serif;text-align:center}
.pacc{font-family:'%(serif)s',serif;font-style:italic;color:var(--accent);text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:6px}
.pbig{margin:60px auto 0;width:max-content;background:#fff;border-radius:999px;padding:16px 30px;font:800 46px/1 '%(ui)s',sans-serif;box-shadow:0 10px 20px -8px rgba(0,0,0,.3)}
.pwave{position:absolute;left:30px;right:30px;bottom:70px;height:80px;display:flex;align-items:center;gap:7px}
.pwave i{flex:1;background:var(--accent);border-radius:4px;transform-origin:50%% 50%%}
.chat{background:#fff;padding:30px;display:flex;flex-direction:column;gap:18px;width:860px}
.msg{max-width:84%%;padding:20px 26px;border-radius:24px;font:500 32px/1.35 '%(ui)s',sans-serif}
.msg.me{align-self:flex-end;background:var(--dark);color:var(--dark-ink);border-bottom-right-radius:6px}
.msg.ai{align-self:flex-start;background:#f1eee8;border-bottom-left-radius:6px}
.list{background:#fff;padding:34px 38px;display:flex;flex-direction:column;gap:22px;width:860px}
.li{display:flex;align-items:center;gap:22px;font:600 38px/1.2 '%(ui)s',sans-serif}
.li b{flex:none;width:50px;height:50px;border-radius:50%%;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px}
.stats{flex:none;width:100%%;display:flex;gap:22px}
.stat{flex:1;background:#fff;border-radius:26px;padding:34px 18px;text-align:center;box-shadow:0 30px 50px -24px rgba(40,30,20,.5)}
.stat.dk{background:var(--dark);color:var(--dark-ink)}
.num{font-family:'%(label)s',sans-serif;font-weight:700;line-height:1;color:var(--accent)}
.slab{margin-top:14px;font:600 24px/1.2 '%(ui)s',sans-serif}
.code .src{font:400 28px/1.6 '%(mono)s',monospace;white-space:pre;color:#e8e4dc}
.folder{flex:none;position:relative;width:760px;height:600px;margin-top:40px}
.fback{position:absolute;left:0;right:0;bottom:0;height:400px;background:#4f95dd;border-radius:30px}
.fback:before{content:'';position:absolute;left:0;top:-40px;width:250px;height:70px;background:#4f95dd;border-radius:24px 24px 0 0}
.sheet{position:absolute;bottom:250px;width:170px;height:230px;background:#fff;border-radius:12px;padding:18px 14px;box-shadow:0 8px 20px -8px rgba(0,0,0,.4)}
.sheet b{display:block;font:700 20px/1.2 '%(mono)s',monospace;margin-bottom:16px;word-break:break-all}
.sheet i{display:block;height:10px;margin:10px 0;background:#e6e2db;border-radius:5px}
.ffront{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(#78b4ef,#5a9fe6);border-radius:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 30px 50px -20px rgba(30,60,110,.5)}
.fname{background:#fff;border-radius:16px;padding:20px 30px;font:700 36px/1 '%(ui)s',sans-serif;color:#1e3b5c}
.imgcard{overflow:hidden;background:#fff;padding:16px;width:820px;max-height:820px}
.imgcard img{width:100%%;max-height:740px;object-fit:cover;border-radius:12px;display:block}
.icap{font:600 28px/1.2 '%(ui)s',sans-serif;padding:16px 6px 4px}
.cmp{flex:none;display:flex;gap:30px;width:100%%;justify-content:center}
.cside{width:430px;height:600px;background:#fff;border-radius:26px;overflow:hidden;position:relative;box-shadow:0 30px 50px -24px rgba(40,30,20,.5)}
.cside img{width:100%%;height:100%%;object-fit:cover}
.ca{border:5px solid var(--accent)}
.ctag{position:absolute;top:16px;left:16px;z-index:2;background:var(--dark);color:#fff;font:700 30px/1 '%(label)s',sans-serif;padding:10px 18px;border-radius:10px}
.ca .ctag{background:var(--accent)}
.ctext{padding:110px 34px 30px;font:600 38px/1.3 '%(ui)s',sans-serif}
.lline.center{justify-content:center}
.road{position:relative;width:100%%;flex:none}
.snake{position:absolute;inset:0;width:100%%;height:100%%;overflow:visible}
.tiles{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:28px 40px;padding:0 50px}
.tile{height:122px;background:#fff;border-radius:18px;display:flex;align-items:center;gap:18px;padding:0 20px;box-shadow:0 18px 30px -16px rgba(40,30,20,.45);position:relative}
.tile.ghost{visibility:hidden}
.tile>b{flex:none;width:76px;height:84px;border-radius:14px;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font:700 56px/1 '%(label)s',sans-serif}
.tile.on{outline:5px solid var(--accent)}.tile.on>b{background:var(--accent)}
.tt{font:700 36px/1.1 '%(ui)s',sans-serif}
.ts{font:400 18px/1.3 '%(mono)s',monospace;color:var(--muted);margin-top:6px}
.tcheck{position:absolute;right:-12px;top:-14px;width:46px;height:46px;border-radius:50%%;background:var(--dark);color:#fff;display:flex;align-items:center;justify-content:center;font:700 26px/1 '%(ui)s',sans-serif}
.bigwrap{position:relative;width:440px;height:440px;margin-top:40px;display:flex;align-items:center;justify-content:center}
.bigring{position:absolute;inset:0}
.bigtile{width:240px;height:260px;border-radius:44px;background:var(--dark);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;box-shadow:0 30px 50px -20px rgba(0,0,0,.6)}
.bigtile b{font:700 190px/.9 '%(label)s',sans-serif}
.bigtile .dots i{width:14px;height:14px}
.bigtext{font-family:'%(label)s',sans-serif;font-weight:700;line-height:.92;text-align:center;margin-top:60px}
.bw{display:inline-block}.bw.hot{color:var(--accent)}
.bigsub{font:500 44px/1.2 '%(caption)s',sans-serif;text-align:center;margin-top:20px}
.board{position:relative;width:100%%;height:880px}
.polar{position:absolute;width:300px;background:#fbf8f2;padding:14px 14px 0;box-shadow:0 22px 30px -14px rgba(0,0,0,.6)}
.pp{width:272px;height:330px;overflow:hidden}
.pp img{width:100%%;height:100%%;object-fit:cover}
.pblank{width:100%%;height:100%%;display:flex;align-items:center;justify-content:center}
.pblank span{font:700 40px/1.1 '%(label)s',sans-serif;color:rgba(255,255,255,.85);text-transform:uppercase;text-align:center;padding:20px}
.plab{font:italic 400 34px/1 '%(serif)s',serif;color:#2c2620;text-align:center;padding:14px 0 18px}
.pin{position:absolute;top:-8px;left:50%%;width:26px;height:26px;margin-left:-13px;border-radius:50%%;background:#c8302a;box-shadow:inset -4px -4px 0 rgba(0,0,0,.25),0 6px 8px rgba(0,0,0,.4)}
.sticky{position:absolute;left:330px;top:420px;width:270px;height:250px;background:#f4d84d;box-shadow:0 22px 30px -14px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:italic 500 92px/1 '%(serif)s',serif;color:#1d1810}
.lens{position:absolute;left:0;top:0;width:190px;height:190px;border-radius:50%%;border:14px solid #b8933f;background:rgba(255,255,255,.12);box-shadow:0 18px 30px rgba(0,0,0,.5),inset 0 0 30px rgba(255,255,255,.35)}
.lens:after{content:'';position:absolute;right:-110px;bottom:-110px;width:150px;height:28px;background:#1a1612;border-radius:14px;transform:rotate(45deg);transform-origin:0 0}
.bstamp{position:absolute;left:40px;right:40px;top:330px;background:#fbf8f2;padding:40px 30px 30px;text-align:center;box-shadow:0 30px 50px -20px rgba(0,0,0,.7)}
.bs1{font:700 72px/1 '%(label)s',sans-serif;text-transform:uppercase;color:var(--ink)}
.bs2{font:700 230px/.9 '%(label)s',sans-serif;text-transform:uppercase;color:var(--accent)}
.sticker{position:absolute;left:70px;top:1420px;background:#fff;border:3px solid var(--ink);border-radius:16px;padding:16px 22px;font:600 30px/1.3 '%(ui)s',sans-serif;box-shadow:0 14px 24px -12px rgba(0,0,0,.5)}
.stamp{position:absolute;left:400px;top:760px;width:280px;height:280px}
.stamp svg{width:100%%;height:100%%}
.checkb{position:absolute;left:820px;top:520px;width:86px;height:86px;border-radius:50%%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font:700 50px/1 '%(ui)s',sans-serif;box-shadow:0 10px 20px -8px rgba(0,0,0,.5)}
.bubble{position:absolute;left:70px;top:1360px;width:560px;background:#fff;border:4px solid var(--ink);border-radius:26px;padding:22px 28px 30px;min-height:150px}
.bubble:after{content:'';position:absolute;right:-50px;bottom:30px;border:26px solid transparent;border-left:60px solid var(--ink)}
.bk{font:400 22px/1 '%(mono)s',monospace;color:var(--muted);margin-bottom:12px}
.bt{font:700 44px/1.15 '%(ui)s',sans-serif}
.ring{position:absolute;left:560px;top:560px;width:420px;height:280px}
.cursor{position:absolute;left:520px;top:980px;width:64px;height:84px}
.cursor svg{width:64px;height:84px;filter:drop-shadow(0 6px 8px rgba(0,0,0,.4))}
.ripple{position:absolute;left:-30px;top:-30px;width:70px;height:70px;border-radius:50%%;border:6px solid var(--accent);opacity:0}
.confetti{position:absolute;left:560px;top:1250px;width:0;height:0}
.cf{position:absolute;border-radius:3px}
.prop{position:absolute;left:70px;top:1440px}
.boxp{position:relative;width:250px;height:220px}
.boxp .lid{position:absolute;left:-10px;right:-10px;top:0;height:50px;background:#c89a5c;border:4px solid #6b4a24;border-radius:6px}
.boxp .bx{position:absolute;left:0;right:0;top:44px;bottom:0;background:#d8ab6c;border:4px solid #6b4a24;display:flex;align-items:center;justify-content:center}
.boxp .bx b{background:#fff;border:3px solid #333;padding:8px 14px;font:700 30px/1 '%(mono)s',monospace}
.env{position:relative;width:300px;height:200px;background:#e9cf96;border:4px solid #8b6a33;display:flex;align-items:flex-end;justify-content:center;padding-bottom:20px}
.env .flap{position:absolute;left:0;right:0;top:0;height:0;border-left:146px solid transparent;border-right:146px solid transparent;border-top:110px solid #d9b977}
.env b{position:relative;background:#fbf6ea;padding:8px 20px;font:700 44px/1 '%(label)s',sans-serif;color:var(--accent);transform:rotate(-5deg)}
.ctawrap{position:relative;width:100%%;display:flex;flex-direction:column;align-items:center;margin-top:120px}
.cmtag{background:var(--dark);color:#fff;font:700 40px/1 '%(label)s',sans-serif;padding:14px 24px;border-radius:12px;align-self:flex-start;margin-left:80px}
.cbar{margin-top:20px;width:900px;height:170px;border-radius:999px;background:#fff;border:6px solid var(--accent);display:flex;align-items:center;gap:26px;padding:0 30px;box-shadow:0 30px 50px -20px rgba(150,30,20,.45)}
.cav{flex:none;width:90px;height:90px;border-radius:50%%;border:7px solid var(--accent)}
.cword{font:700 104px/1 '%(label)s',sans-serif;color:var(--accent);letter-spacing:.02em}
.cbar .caret{height:90px;background:var(--accent)}
.send{margin-left:auto;width:104px;height:104px;border-radius:50%%;background:#2f7de1;color:#fff;display:flex;align-items:center;justify-content:center;font:700 58px/1 '%(ui)s',sans-serif}
.ctail{margin-top:40px;font:500 52px/1.2 '%(caption)s',sans-serif;text-align:center}
.heart{position:absolute;top:340px;font-size:54px;color:var(--accent);opacity:0}
.wipe{position:absolute;inset:0;z-index:20;--r:0px;--p:-40%%;background:radial-gradient(circle,var(--ink) var(--r),transparent calc(var(--r) + 1px)) 0 0/36px 36px;-webkit-mask-image:linear-gradient(120deg,transparent calc(var(--p) - 40%%),#000 var(--p),transparent calc(var(--p) + 40%%));mask-image:linear-gradient(120deg,transparent calc(var(--p) - 40%%),#000 var(--p),transparent calc(var(--p) + 40%%))}
#hostwrap{position:absolute;left:330px;top:1250px;width:984px;height:912px;z-index:6}
#hostwrap svg{position:absolute;inset:0;width:100%%;height:100%%;overflow:visible}
#hostshadow{transform:translate(18px,10px);filter:brightness(0);opacity:.55;-webkit-mask-image:radial-gradient(circle,#000 38%%,transparent 42%%);-webkit-mask-size:9px 9px;mask-image:radial-gradient(circle,#000 38%%,transparent 42%%);mask-size:9px 9px}
"""


def check(sb: dict[str, Any], media: dict[str, Any]) -> dict[str, Any]:
    """Keep what the renderer can draw: known scene and card kinds, poses, props, media we have,
    scenes whose words the narration says (the first always starts at 0)."""
    from rasika_worker import roundup

    narration = str(sb.get("narration") or "").strip()
    if len(narration.split()) < 15:
        raise ValueError("the writer returned no narration")
    steps = [
        {"title": str(s.get("title") or "")[:22], "sub": str(s.get("sub") or "")[:26]}
        for s in sb.get("steps") or []
        if isinstance(s, dict) and s.get("title")
    ][:7]
    out: list[dict[str, Any]] = []
    for i, s in enumerate(sb.get("scenes") or []):
        if not isinstance(s, dict):
            continue
        t = str(s.get("type") or "label")
        if t not in SCENES:
            t = "label"
        s["type"] = t
        if i and not roundup.says(narration, str(s.get("say") or "")):
            continue
        if t == "roadmap" and not steps:
            continue
        if str(s.get("pose") or "") not in toonhost.POSES:
            s["pose"] = "explain"
        if s.get("badge") is not None:
            try:
                s["badge"] = max(1, min(9, int(s["badge"])))
            except (TypeError, ValueError):
                s.pop("badge")
        c = s.get("card")
        if isinstance(c, dict):
            k = str(c.get("kind") or "")
            if k not in CARDS or k == "image" and str(c.get("media") or "") not in media:
                s.pop("card")
            elif k in ("browser", "phone") and c.get("media") and str(c["media"]) not in media:
                c.pop("media")
            elif k == "stats":
                st = [
                    x
                    for x in c.get("stats") or []
                    if isinstance(x, dict) and re.search(r"\d", str(x.get("value") or ""))
                ]
                if st:
                    c["stats"] = st[:3]
                else:
                    s.pop("card")
        elif c is not None:
            s.pop("card")
        s["props"] = [
            p for p in s.get("props") or [] if isinstance(p, dict) and p.get("kind") in PROPS
        ][:3]
        if t == "board":
            s["notes"] = [
                n
                if isinstance(n, str)
                or (isinstance(n, dict) and str(n.get("media") or "") in media)
                else {"label": n.get("label", "")}
                for n in s.get("notes") or []
                if isinstance(n, (str, dict))
            ][:6]
        out.append(s)
    if len(out) < 3:
        raise ValueError("the storyboard has too few usable scenes")
    return {
        "title": str(sb.get("title") or "")[:120],
        "narration": narration,
        "accents": [str(w)[:30] for w in sb.get("accents") or sb.get("emphasis") or []][:30],
        "steps": steps,
        "scenes": out[:34],
        "terms": [str(t)[:40] for t in sb.get("terms") or [] if str(t).strip()][
            :3
        ],  # director.plan
    }


def build_project(
    out: Path,
    sb: dict[str, Any],
    words: list[dict[str, Any]],
    duration: float,
    audio: list[tuple[str, Path, float]],
    media: dict[str, Path],
    look: Look | str = "paper",
    host: str = toonhost.DEFAULT_HOST,
    voice_wav: Path | None = None,
    gsap_js: Path | None = None,
) -> tuple[Path, list[dict[str, Any]]]:
    """Write `index.html` (+ assets) for the storyboard; returns it and the sound cues for sfx.py.
    Scenes start on their `say` words; the host's mouth follows `voice_wav`."""
    from rasika_worker.roundup import when

    lk = LOOKS.get(look, LOOKS["paper"]) if isinstance(look, str) else look
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

    b = Builder(sb, words, duration, lk, rel, host)
    scenes_in = [s for s in sb.get("scenes") or [] if isinstance(s, dict)]
    starts: list[float] = []
    for i, s in enumerate(scenes_in):
        t = when(words, str(s.get("say") or ""), starts[-1] + 0.6 if starts else 0.0) if i else 0.0
        if t is None:
            t = (starts[-1] + 2.5) if starts else 0.0
        starts.append(min(max(t - 0.12, starts[-1] + 0.5 if starts else 0.0), duration - 0.6))
    timed: list[tuple[dict[str, Any], float, float]] = []
    for i, s in enumerate(scenes_in):
        t0 = 0.0 if i == 0 else starts[i]
        t1 = starts[i + 1] if i + 1 < len(scenes_in) else b.D
        if t1 - t0 >= 0.4:
            timed.append((s, round(t0, 3), round(t1, 3)))
    html_scenes = []
    prev: dict[str, Any] | None = None
    wipe_at: list[float] = []
    for i, (s, t0, t1) in enumerate(timed):
        if i and (
            s.get("wipe") or s.get("type") == "roadmap" or (prev and prev.get("type") == "board")
        ):
            wipe_at.append(t0)
        elif i:
            b.cue(t0 - 0.05, "whoosh", 0.25, dur=0.3)
        html_scenes.append(b.scene(i, s, t0, t1, prev))
        prev = s
    dark_spans = [(t0, t1) for s, t0, t1 in timed if s.get("type") == "board"]
    accents = {_norm(w) for a in sb.get("accents") or [] for w in str(a).split()}
    caps = b.captions(caption_groups(words), accents, dark_spans)
    mouth = toonhost.mouth_track(voice_wav, 30, b.D) if voice_wav and voice_wav.exists() else []
    mouth_js = b.host_track(timed, mouth)
    wipes = b.wipes(wipe_at)
    host_svg = toonhost.svg(host)

    css = CSS % {
        "ui": lk.ui,
        "mono": lk.mono,
        "caption": lk.caption,
        "serif": lk.serif,
        "label": lk.label,
    }
    gsap_src = "assets/gsap.min.js"
    if gsap_js and gsap_js.exists():
        shutil.copy(gsap_js, assets / "gsap.min.js")
        tp = gsap_js.parent / "TextPlugin.min.js"
        if tp.exists():
            shutil.copy(tp, assets / "TextPlugin.min.js")
    else:
        gsap_src = "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"
    text_plugin = gsap_src.replace("gsap.min.js", "TextPlugin.min.js")
    dd = b.D
    doc = f"""<!doctype html>
<html lang="en" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="{gsap_src}"></script>
<script src="{text_plugin}"></script>
<style>
:root{{--bg:{lk.bg};--ink:{lk.ink};--accent:{lk.accent};--muted:{lk.muted};--card:{lk.card};--dark:{lk.dark};--dark-ink:{lk.dark_ink};--cork:{lk.cork}}}
{css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{dd}" data-width="1080" data-height="1920">
  <div id="bg" class="clip" data-start="0" data-duration="{dd}" data-track-index="0" style="position:absolute;inset:0"><div class="paper"></div></div>
  {"".join(html_scenes)}
  {caps}
  <div id="hostlayer" class="clip" data-start="0" data-duration="{dd}" data-track-index="4" style="position:absolute;inset:0;pointer-events:none;z-index:6">
    <div id="hostwrap"><svg id="hostshadow" viewBox="-110 0 820 760"><use href="#host"/></svg>{host_svg}</div>
  </div>
  {wipes}
  {"".join(audio_tags)}
</div>
<script>
if (window.TextPlugin) gsap.registerPlugin(TextPlugin);
document.querySelectorAll(".lline").forEach(function(row){{var l=row.querySelector(".label");if(!l)return;var room=row.clientWidth-(row.querySelector(".badge")?130:0);var fs=parseFloat(getComputedStyle(l).fontSize);while(l.scrollWidth>room&&fs>48){{fs-=4;l.style.fontSize=fs+"px";}}}});
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(b.tw)}
{mouth_js}
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
    return out / "index.html", sorted(b.cues, key=lambda c: c["t"])


# ───────────────────────────── the writer ─────────────────────────────

WRITER_SYSTEM = (
    """You write and storyboard vertical (1080×1920) "AI-animated" explainer reels, the format where a
cartoon host stands in the bottom right and talks to camera while the words of the voice write themselves
top left (one or two accent words in red italic), a big condensed label with a numbered step badge sits in
the middle, and real-looking cards (app windows, a browser, a phone, a folder, a checklist) pop in, get
circled, clicked, ticked and stamped. A new scene every 2–3 seconds. You get the topic, the research (facts
with sources, the user's links, media we saved) and the host's name.

THE SCRIPT (first person, the host talking to one viewer, spoken English, short sentences; the voice
speaks ~2.4 words a second, so stay inside the word range you are given and never over its top):
1. Hook (≤ 7 s), on screen from frame 0. Use one of these shapes, filled with the topic:
   - trend + gap: "Everyone's [doing X] right now, but nobody's showing you how."
   - result first: "This [result] took me [time/one line]. Here's exactly how."
   - wrong belief: "You don't need [the thing they think]. You need [the real thing]."
   - number promise: "[N] steps to [result]. Step [k] is the one everyone skips."
2. Promise + roadmap (≤ 6 s): "So I'll show you every step…" with the steps listed once on a roadmap.
3. The steps, in order, each opened with First / Next / Then / Now: what to do, in one or two sentences, and
   what it looks like. 3–7 steps.
4. Payoff: the moment it works ("Now the fun part.") with a concrete example.
5. Recap: one line ("That's the entire workflow."), the roadmap again with every step ticked.
6. Call to action: "comment WORD and I'll send you …" (one WORD the user gave, or the obvious one).
Every number and claim comes from the research facts; never invent stats, quotes, prices or features.

Return ONE JSON object, nothing else:
{"title": "short project title",
 "narration": "the whole voice-over, as spoken",
 "accents": ["the words the captions colour, exactly as spoken incl. punctuation, 1–2 per sentence"],
 "steps": [{"title": "≤ 14 chars", "sub": "≤ 22 chars, lowercase"}],      // 3–7, the roadmap
 "scenes": [ … ]}

Every scene: {"type": …, "say": "the exact narration words where it starts (2–6 words, copied verbatim; the
first scene's say is ignored, it starts at 0)", "kicker": "small mono line: '01 · the hook', 'step 2 · folder',
'15 · the entire workflow'", "pose": one of calm|point|present|both|shrug|think|thumbs|wave|explain,
"props": [optional, ≤ 2], "wipe": optional true on a new part}
Types:
- {"type":"board", "notes":["≤ 14 chars", … 4–6 things the topic is about, or {"label":…, "media": id}],
   "sticky":"≤ 4 chars, e.g. 'AI?'", "stamp":"TOP LINE|BIG WORD", "stamp_at": seconds into the scene}   // the hook only
- {"type":"roadmap", "title":"*6* STEPS" (the count in *accent*), "active": optional step no., "done": optional no. ticked}
- {"type":"label", "label":"2–4 WORDS, one *accent* word", "label_kick":"optional ≤ 14 chars ('you need')",
   "badge": step number (on step scenes), "card": optional card}
- {"type":"big", "big":"5" (a step number: a big tile with a ring) or "3 *WORDS*", "sub":"optional ≤ 30 chars"}
- {"type":"cta", "word":"ONE WORD", "lead":"comment", "tail":"and I'll send it to *you*."}   // the last scene
Cards (one per label scene, the thing the step looks like):
 {"kind":"app","title":"window title","sub":"≤ 30 chars","status":"≤ 26 chars","progress":"2/3",
  "rows":[{"text":"≤ 18","tag":"≤ 10","state":"done|run|need|todo","meta":"≤ 8"}],   // 0–5
  "prompt":"empty-state line (when no rows)","input":"what is typed into the box, ≤ 60 chars"}
 {"kind":"browser","url":"host/path","tab":"≤ 14","media": id (a saved screenshot) | "prompt":"page headline"}
 {"kind":"phone","media": id | "title":"a reel title with *accent*","big":"≤ 10 chars stat"}
 {"kind":"chat","messages":[{"who":"me"|"ai","text":"≤ 90"}]}  // 1–3
 {"kind":"list","items":["≤ 26 chars, one *accent*"]}  // 2–5, a checklist that ticks
 {"kind":"stats","stats":[{"value":"35,000 ft","label":"≤ 18"}]}  // 1–3, real numbers only
 {"kind":"code","title":"file","lines":["≤ 40 chars"]}  // 3–8
 {"kind":"folder","name":"≤ 18","files":["SKILL.md", …]}  // 2–5
 {"kind":"image","media": id, "caption":"optional"}
 {"kind":"compare","before":{"text":"…"|"media":id},"after":{"text":"… *accent*"|"media":id}}
Props: {"kind":"sticker","text":"two short lines\nwith *accent*"} {"kind":"stamp"} (a red X: "not this")
 {"kind":"check"} {"kind":"circle"} (draws a red ring on the card) {"kind":"cursor"} (clicks)
 {"kind":"bubble","text":"what the viewer says out loud, ≤ 40"} {"kind":"confetti"} (the fun part)
 {"kind":"box","text":"≤ 8"} {"kind":"envelope","text":"≤ 6"}; any prop may take "at": seconds into the scene.

Direction:
- Scene 1 is the board hook. Then a roadmap. Each step: a "big" step-number scene OR straight to its label
  scene, then 1–3 label scenes (same label and badge, new card or prop on each beat: the picture changes when
  the voice moves on). Payoff with confetti. Recap roadmap with "done" = all. CTA last.
- Poses follow the words: point when introducing, present when showing a card, both for the hook and the fun
  part, shrug for a problem, thumbs for "done", think for a question, wave for "just tell it".
- Never the same card kind three scenes running. Use media ids for anything real.
- Length: the range you are given; scenes: the number asked for."""
    + RULES
)


def write_storyboard(
    client: Any,
    model: str,
    r: Any,
    seconds: tuple[float, float],
    cta: str | None = None,
    host: str = toonhost.DEFAULT_HOST,
    max_images: int = 6,
) -> tuple[dict[str, Any], dict[str, int]]:
    """The writer's script + storyboard for a toon reel from the research (research.TopicResearch)."""
    import contextlib

    from rasika_worker.planner import _b64_image
    from rasika_worker.reference import parse_json
    from rasika_worker.research import _message

    lo, hi = seconds
    need = [max(10, round(lo / 2.8)), max(12, round(hi / 2.3))]
    brief = {
        "length_seconds": [round(lo), round(hi)],
        "words": [round(lo * 2.3), round(hi * 2.4)],
        "scenes": need,
        "host": toonhost.HOSTS.get(host, toonhost.HOSTS[toonhost.DEFAULT_HOST]).name,
        "call_to_action": cta or None,
        **r.as_prompt(),
    }
    content: list[dict[str, Any]] = [
        {"type": "text", "text": "## The brief\n\n" + json.dumps(brief, ensure_ascii=False)}
    ]
    for m in [m for m in r.media if m.kind == "image"][:max_images]:
        with contextlib.suppress(Exception):
            content.append({"type": "text", "text": f"Media {m.id}: {m.label}"})
            content.append(_b64_image(m.path))
    media = {m.id: m for m in r.media}
    text, usage = _message(client, model, WRITER_SYSTEM, content, None, 16000)
    sb = check(parse_json(text), media)
    n_words = len(sb["narration"].split())
    if n_words > brief["words"][1] * 1.1:  # too long for the length: one more try, told exactly why
        shorter = content + [
            {
                "type": "text",
                "text": f"Your narration had {n_words} words; this reel allows at most {brief['words'][1]} "
                f"(~{round(hi)} s at the voice's pace). Write it again, shorter: keep the hook, the steps "
                "and the call to action; cut repetition and side remarks.",
            }
        ]
        text2, u2 = _message(client, model, WRITER_SYSTEM, shorter, None, 16000)
        for k in usage:
            usage[k] += u2[k]
        with contextlib.suppress(ValueError):
            sb2 = check(parse_json(text2), media)
            if len(sb2["narration"].split()) < n_words and len(sb2["scenes"]) >= 8:
                sb = sb2
    if len(sb["scenes"]) < need[0]:
        again = content + [
            {
                "type": "text",
                "text": f"Your storyboard had {len(sb['scenes'])} usable scenes; this length needs "
                f"{need[0]}–{need[1]}. Write it again with that many (split steps into beats).",
            }
        ]
        text2, u2 = _message(client, model, WRITER_SYSTEM, again, None, 16000)
        for k in usage:
            usage[k] += u2[k]
        with contextlib.suppress(ValueError):
            sb2 = check(parse_json(text2), media)
            if len(sb2["scenes"]) > len(sb["scenes"]):
                sb = sb2
    return sb, usage
