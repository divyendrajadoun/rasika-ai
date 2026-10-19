"""
Brief-driven films: the user gives a brief (a website, a recipe, two contenders, a line…) instead
of footage, and Rasika writes, scores and designs the whole film.

  KINDS            what each kind of film needs from the user, its default look, music and length
  capture_site()   a real look at a website: screenshots (desktop hero, full page, phone) and its
                   own words (title, description, headings), with every request guarded against
                   private and internal addresses
  write()          one Claude call turns the brief and the materials into the film's script and
                   the structured data its elements need (the recipe's layers, the fight's hits…)
  timeline()       on-screen lines → word timings, for films with no narrator
"""

from __future__ import annotations

import contextlib
import ipaddress
import json
import re
import socket
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from rasika_worker.reference import parse_json

# ───────────────────────────── the kinds ─────────────────────────────

THROUGH = (
    "Pick ONE through-line object from the product itself (its main button, the logo's mark, a single data "
    "point) and make every scene a transformation of it: it starts in the UI, changes shape or role in each "
    "scene, and becomes the logo on the end card. The real interface drives it: a cursor clicks real controls "
    "while the camera zooms screen-studio style so each moment fills the frame. One typeface, one accent colour "
    "(the brand's) used only on the through-line object and the key word, lots of empty space. Hook (first bar): "
    "the problem in three to five words, in big type that the through-line object interrupts. Middle: moments of "
    "the product doing what it does best, each beginning with the object turning into the next UI element and "
    "landing one readable idea. Payoff: the strongest moment on the biggest beat, then the object becomes the "
    "logo and the end card (the name and a one-line call to action). 120 BPM; something changes on every beat. "
    "Never invent features, screens or numbers."
)

KINDS: dict[str, dict[str, Any]] = {
    "launch": {
        "title": "SaaS launch film",
        "needs": ["url"],
        "preset": "saas-launch",
        "mood": "launch",
        "narrate": False,
        "seconds": (24, 32),
        "through": True,
        "brief": "A high-end 30-second launch film. " + THROUGH,
    },
    "showreel": {
        "title": "15-second motion showreel",
        "needs": ["url"],
        "preset": "showreel-kinetic",
        "mood": "showreel",
        "narrate": False,
        "seconds": (14, 16),
        "through": True,
        "brief": "A 15-second showreel for this product, matching the landing page's styling and creative in what "
        "it shows. " + THROUGH,
    },
    "app": {
        "title": "Apple-style app film",
        "needs": ["url"],
        "preset": "porcelain-keynote",
        "mood": "launch",
        "narrate": False,
        "seconds": (26, 32),
        "through": True,
        "brief": "A 30-second Apple-style film for this app: keynote feel, white space, one idea per shot, the "
        'device as the hero, short declarative lines ("Meet …", "Designed for …"). ' + THROUGH,
    },
    "product": {
        "title": "Product film",
        "needs": ["url"],
        "preset": "porcelain-keynote",
        "mood": "showreel",
        "narrate": False,
        "seconds": (36, 42),
        "through": True,
        "brief": "A 40-second product film: what it does, who it is for, shown on its real interface. "
        + THROUGH,
    },
    "referral": {
        "title": "Referral promo",
        "needs": ["url"],
        "preset": "porcelain-keynote",
        "mood": "showreel",
        "narrate": False,
        "seconds": (14, 16),
        "through": True,
        "brief": "A 15-second promo for the product's referral programme: how it works and what you get, taken "
        "from the site's own referral page or terms (if the site states no referral programme, say only what it "
        "does state). The end card says how to start referring. " + THROUGH,
    },
    "hype": {
        "title": "Hype launch",
        "needs": ["url"],
        "preset": "porcelain-keynote",
        "mood": "showreel",
        "narrate": False,
        "seconds": (18, 22),
        "through": True,
        "brief": "A 20-second hype launch video: punchy, confident, fast. " + THROUGH,
    },
    "flyover": {
        "title": "Landing-page fly-over",
        "needs": ["url", "closing"],
        "preset": "porcelain-keynote",
        "mood": "showreel",
        "narrate": False,
        "seconds": (14, 15),
        "brief": "A 14.5-second 3D fly-over of the landing page: the page lies flat on a bright studio floor, one "
        "continuous camera glides down it looking up the page, rises to show the whole page as one strip, dives "
        "into the hero and lands it as a card under a two-line title (the user's statement, then a short italic "
        "tail). No text over the page before the end card; no cuts.",
    },
    "diagram": {
        "title": "Diagram explainer",
        "needs": ["topic"],
        "preset": "porcelain-keynote",
        "mood": "showreel",
        "narrate": False,
        "seconds": (55, 62),
        "brief": "A 60-second explainer of why this earns its place, for someone deciding whether to use it, built "
        "as ONE diagram in one continuous space: the camera zooms into a part to explain it and pulls back to "
        "show how it fits. Every idea gets a picture before words; labels sit on the thing they name. Hook: a "
        "question the viewer already has. Middle: three to five steps, each zooming into one part with one "
        "concrete example. Payoff: pull back to the whole, complete diagram and a one-line takeaway. Never more "
        "than seven words on screen; every fact right (never invent numbers or quotes).",
    },
    "animate": {
        "title": "Animate anything",
        "needs": ["topic"],
        "preset": "animate-studio",
        "mood": "journey",
        "narrate": False,
        "seconds": (8, 31),
        "brief": "The /animate studio: the user's style references and a rough idea become a film drawn "
        "entirely in code (animate.py does the writing).",
    },
    "recipe": {
        "title": "Recipe explainer",
        "needs": ["recipe"],
        "preset": "recipe-explainer",
        "mood": "recipe",
        "narrate": False,
        "seconds": (26, 32),
        "brief": "An explainer that shows the full recipe from an empty glass (or bowl) to the finished drink: each "
        "ingredient pours in with its measure on screen, in order, then the garnish, then the finished drink named. "
        "Clear, appetising, step by step.",
    },
    "versus": {
        "title": "Versus: a comic fight",
        "needs": ["contenders"],
        "preset": "versus-arcade",
        "mood": "versus",
        "narrate": True,
        "seconds": (50, 62),
        "brief": "A one-minute comic fight between the two contenders with a real plot (a challenge, a twist, a "
        "comeback), explosive moments, absurd special moves drawn from who they are publicly, and a CLEAR winner. "
        "Abstract and hilarious, never mean-spirited: it roasts what they do, never their looks, family or identity; "
        "no gore. A fight announcer narrates.",
    },
    "machine": {
        "title": "Music machine",
        "needs": ["line"],
        "preset": "music-machine",
        "mood": "none",
        "narrate": False,
        "seconds": (18, 22),
        "brief": "A little story told with sound. For the first 12 seconds there is no sound at all: on warm paper "
        "the line types itself out, then its letters fall apart and build a colourful music machine piece by piece "
        "(ramps, spinning gears, a row of key blocks, a big drum), ending with a ball waiting at the top. At 12 s "
        "the ball drops and the machine comes alive: every block it hits plays a note, the drum kicks, the gears "
        "tick in rhythm — a catchy 4-second beat. Then everything snaps into the closing words on a final hit, "
        "followed by silence.",
    },
    "journey": {
        "title": "Storybook journey",
        "needs": ["subject"],
        "preset": "grand-budapest",
        "mood": "journey",
        "narrate": False,
        "seconds": (24, 32),
        "brief": "A Wes Anderson / Grand Budapest Hotel style vignette: symmetrical, pastel, chaptered with title "
        'cards ("Part One: Spring"), whimsical deadpan lines. The subject is told through a window onto the '
        "passing world (e.g. four seasons passing outside a train window, a cosy carriage, a cup of coffee).",
    },
    "explainer": {
        "title": "Animated explainer",
        "needs": ["topic"],
        "preset": "kurz-explainer",
        "mood": "recipe",
        "narrate": True,
        "seconds": (40, 62),
        "brief": "A Kurzgesagt-style animated explainer of the topic: a warm illustrated world in parallax layers, a "
        "small flying host (a bee) that points at what is being said, quantities shown as little characters, one "
        "surprising fact that turns the story, a clear payoff. Curious and friendly; every number true and "
        "well known (no invented statistics: if unsure, describe instead of quantifying).",
    },
    "editorial": {
        "title": "Editorial explainer",
        "needs": ["topic"],
        "preset": "vox-paper",
        "mood": "recipe",
        "narrate": True,
        "seconds": (40, 62),
        "brief": "A Vox-style narrated editorial explainer: the hook withholds the subject, then 8–12 beats told with "
        "paper evidence (newspaper clippings, documents, letters) whose key phrase gets a red marker stroke, "
        "numbers that land on the spoken word, a clear 'so what'. Journalism, not advertising; only facts that "
        "are well established, dated where it matters.",
    },
    "tierlist": {
        "title": "Tier list",
        "needs": ["topic"],
        "preset": "tier-list",
        "mood": "showreel",
        "narrate": True,
        "seconds": (24, 40),
        "brief": "A viral tier-list video: a confident, funny narrator ranks 6–10 picks on the topic from S to D, one "
        "at a time, each with a one-line reason and a punchline; a hot take at the top tier. Opinions, clearly "
        "framed as opinions; names only, never anyone's face.",
    },
}


def _hex(css: str) -> str | None:
    m = re.match(r"rgba?\(([^)]+)\)", css or "")
    if not m:
        return css if re.fullmatch(r"#[0-9a-fA-F]{6}", css or "") else None
    parts = [float(x) for x in m.group(1).split(",")]
    if len(parts) > 3 and parts[3] < 0.6:
        return None
    return "#" + "".join(f"{int(round(v)):02x}" for v in parts[:3])


def _luma(h: str) -> float:
    n = int(h[1:], 16)
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255


FONT_MAP = {
    "inter": "Inter",
    "geist": "Inter",
    "sf pro": "Inter",
    "helvetica": "Inter",
    "arial": "Inter",
    "space grotesk": "Space Grotesk",
    "montserrat": "Montserrat",
    "poppins": "Poppins",
    "jost": "Jost",
    "ibm plex sans": "IBM Plex Sans",
    "playfair": "Playfair Display Roman",
    "fraunces": "Fraunces",
}


def brand_style(tokens: dict[str, Any], brand: dict[str, str]) -> dict[str, Any]:
    """The kind's preset in the site's own colours and (where we have it) its typeface."""
    style: dict[str, Any] = dict(json.loads(json.dumps(tokens)))
    pal = dict(style["palette"])
    bg, text, accent = (
        _hex(brand.get("background", "")),
        _hex(brand.get("text", "")),
        _hex(brand.get("accent", "")),
    )
    if bg:
        pal["stage"] = bg
        dark = _luma(bg) < 0.45
        if text and abs(_luma(text) - _luma(bg)) > 0.4:
            pal["iv" if dark else "mar"] = text
            pal["ink"] = text if not dark else pal["ink"]
        if accent and abs(_luma(accent) - _luma(bg)) > 0.18:
            pal["gold" if dark else "ter"] = accent
    style["palette"] = pal
    face = (brand.get("font") or "").lower()
    for key, fam in FONT_MAP.items():
        if key in face:
            style["fonts"] = {**style["fonts"], "poster": fam, "ui": fam, "caption": fam}
            break
    style["id"] = f"{tokens.get('id', 'brand')}-brand"
    style["name"] = f"{brand.get('font') or 'Brand'} look"
    return style


def kind_of(opts: dict[str, Any]) -> dict[str, Any]:
    brief = opts.get("brief") or {}
    k = KINDS.get(str(brief.get("kind")))
    if not k:
        raise ValueError(f"unknown brief kind {brief.get('kind')!r}")
    return k


# ───────────────────────────── website capture ─────────────────────────────


class UnsafeUrlError(ValueError):
    pass


def _blocked_ip(ip: str) -> bool:
    a = ipaddress.ip_address(ip)
    return (
        a.is_private
        or a.is_loopback
        or a.is_link_local
        or a.is_reserved
        or a.is_multicast
        or a.is_unspecified
    )


def check_url(url: str) -> str:
    """Only public http(s) sites: the worker sits next to storage, Redis and the database, so a
    brief must never make it fetch an internal address (DNS is resolved and every address checked)."""
    u = urlparse(url.strip())
    if u.scheme not in ("http", "https") or not u.hostname:
        raise UnsafeUrlError("Use a full http(s) link, like https://example.com")
    host = u.hostname
    if host in ("localhost",) or host.endswith((".local", ".internal", ".localhost")):
        raise UnsafeUrlError("That address is not a public website.")
    try:
        infos = socket.getaddrinfo(host, u.port or (443 if u.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"Could not find {host}.") from exc
    for info in infos:
        if _blocked_ip(str(info[4][0])):
            raise UnsafeUrlError("That address is not a public website.")
    return u.geturl()


@dataclass
class SiteCapture:
    url: str
    host: str
    title: str
    description: str
    headings: list[str]
    text: str
    shots: list[tuple[str, Path]] = field(default_factory=list)  # (label, png)
    # where the real controls sit on the full-page screenshot (px), for cursor moves and zooms
    targets: list[dict[str, Any]] = field(default_factory=list)
    # the page's own colours and typeface, read from the rendered page
    brand: dict[str, str] = field(default_factory=dict)

    def as_prompt(self) -> str:
        return json.dumps(
            {
                "url": self.url,
                "title": self.title,
                "description": self.description,
                "headings": self.headings[:30],
                "text": self.text[:4000],
                "screenshots": [label for label, _ in self.shots],
                "brand": self.brand,
                "targets": [
                    {k: t[k] for k in ("id", "kind", "label", "x", "y", "w", "h")}
                    for t in self.targets[:40]
                ],
            },
            ensure_ascii=False,
        )


TARGETS_JS = """() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    return r.width > 8 && r.height > 8 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const box = (e) => { const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = (e) => (e.innerText || e.getAttribute('aria-label') || e.getAttribute('alt') || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  const out = []; const seen = new Set();
  const add = (e, kind) => { if (!vis(e) || seen.has(e)) return; seen.add(e);
    out.push({ kind, label: txt(e), ...box(e) }); };
  const header = document.querySelector('header, nav, [role=banner]') || document.body;
  const logo = header.querySelector('a[href="/"] img, a[href="/"] svg, [class*=logo i] img, [class*=logo i] svg, a[href="/"]');
  if (logo) add(logo.closest('a') && logo.closest('a').getBoundingClientRect().width < 360 ? logo.closest('a') : logo, 'logo');
  const alpha = (c) => { const m = (c || '').match(/rgba?\\(([^)]+)\\)/); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
  const filled = (e) => alpha(getComputedStyle(e).backgroundColor) >= 0.6;
  const big = (e) => box(e).w >= 64 && box(e).h >= 26;
  const btns = [...document.querySelectorAll('a, button, [role=button]')].filter((e) => vis(e) && txt(e).length > 1 && txt(e).length < 32);
  const heroBtns = btns.filter((e) => box(e).y < 900 && filled(e) && big(e)).sort((a, b) => box(b).w * box(b).h - box(a).w * box(a).h);
  if (heroBtns[0]) add(heroBtns[0], 'cta');
  for (const e of btns.filter((e) => filled(e) && big(e)).slice(0, 12)) add(e, 'button');
  for (const e of [...document.querySelectorAll('input, textarea, select')].slice(0, 6)) add(e, 'input');
  for (const e of [...document.querySelectorAll('h1, h2')].slice(0, 10)) add(e, 'heading');
  for (const e of btns.filter((e) => !filled(e)).slice(0, 10)) add(e, 'link');
  const cta = heroBtns[0]; const h1 = document.querySelector('h1');
  const css = (e, p) => (e ? getComputedStyle(e)[p] : '');
  return { targets: out.slice(0, 48).map((t, i) => ({ id: 't' + (i + 1), ...t })),
    brand: { accent: css(cta, 'backgroundColor'), accentText: css(cta, 'color'), background: css(document.body, 'backgroundColor'),
             text: css(h1 || document.body, 'color'), font: (css(h1 || document.body, 'fontFamily') || '').split(',')[0].replace(/["']/g, '').trim() } };
}"""


def _crop(full: Path, t: dict[str, Any], dest: Path) -> Path | None:
    """Cut a control out of the full-page screenshot (its own pixels, a few px of air around it)."""
    try:
        from PIL import Image

        with Image.open(full) as im:
            pad = 6
            box = (
                max(0, t["x"] - pad),
                max(0, t["y"] - pad),
                min(im.width, t["x"] + t["w"] + pad),
                min(im.height, t["y"] + t["h"] + pad),
            )
            if box[2] - box[0] < 12 or box[3] - box[1] < 12:
                return None
            im.crop(box).save(dest)
        return dest
    except Exception:
        return None


def capture_site(url: str, out: Path, timeout_ms: int = 25000) -> SiteCapture:
    """Screenshots and the page's own words, in a headless Chromium. Requests to private or internal
    addresses (the page's own sub-requests included) are aborted."""
    from playwright.sync_api import sync_playwright

    safe = check_url(url)
    out.mkdir(parents=True, exist_ok=True)
    checked: dict[str, bool] = {}

    def allowed(req_url: str) -> bool:
        h = urlparse(req_url).hostname or ""
        if not h:
            return True  # data: / blob:
        if h not in checked:
            try:
                check_url(
                    req_url if urlparse(req_url).scheme in ("http", "https") else f"https://{h}"
                )
                checked[h] = True
            except UnsafeUrlError:
                checked[h] = False
        return checked[h]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            ctx = browser.new_context(
                viewport={"width": 1440, "height": 900},
                device_scale_factor=1,
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 RasikaBriefBot",
            )
            ctx.route(
                "**/*",
                lambda route: route.continue_() if allowed(route.request.url) else route.abort(),
            )
            page = ctx.new_page()
            page.goto(safe, wait_until="domcontentloaded", timeout=timeout_ms)
            with contextlib.suppress(
                Exception
            ):  # busy pages never go idle; what has loaded is enough
                page.wait_for_load_state("networkidle", timeout=8000)
            # cookie banners cover the product: accept nothing, just hide the usual containers
            page.add_style_tag(
                content="[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[aria-label*=cookie i]{display:none!important}"
            )
            page.wait_for_timeout(800)
            info = page.evaluate(
                """() => {
                  const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || '';
                  const heads = [...document.querySelectorAll('h1,h2,h3')].map(h => h.innerText.trim()).filter(Boolean);
                  const text = [...document.querySelectorAll('main p, section p, li, h1, h2, h3')].map(e => e.innerText.trim())
                    .filter(s => s.length > 20 && s.length < 280);
                  return { title: document.title || meta('og:title'), description: meta('description') || meta('og:description'),
                           headings: [...new Set(heads)].slice(0, 40), text: [...new Set(text)].slice(0, 60).join('\\n') };
                }"""
            )
            # the real controls, in page coordinates (the full-page screenshot's pixels)
            found = page.evaluate(TARGETS_JS)
            shots: list[tuple[str, Path]] = []
            hero = out / "site_hero.png"
            page.screenshot(path=str(hero))
            shots.append(("Homepage, first screen", hero))
            full = out / "site_full.png"
            height = min(int(page.evaluate("document.documentElement.scrollHeight") or 900), 5400)
            page.set_viewport_size({"width": 1440, "height": 900})
            page.screenshot(
                path=str(full),
                full_page=True,
                clip={"x": 0, "y": 0, "width": 1440, "height": height},
            )
            shots.append(("Homepage, full page (scrolls)", full))
            # two further screens down the page, for feature moments
            for i, y in enumerate((900, 1800)):
                if y + 900 <= height:
                    sec = out / f"site_section_{i + 1}.png"
                    page.screenshot(
                        path=str(sec),
                        clip={"x": 0, "y": y, "width": 1440, "height": 900},
                        full_page=True,
                    )
                    shots.append((f"Homepage, section {i + 2}", sec))
            phone = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
            )
            phone.route(
                "**/*",
                lambda route: route.continue_() if allowed(route.request.url) else route.abort(),
            )
            pp = phone.new_page()
            pp.goto(safe, wait_until="domcontentloaded", timeout=timeout_ms)
            pp.wait_for_timeout(1500)
            mob = out / "site_phone.png"
            pp.screenshot(path=str(mob))
            shots.append(("Phone view", mob))
            targets = [t for t in (found.get("targets") or []) if t["y"] + t["h"] <= height]
            for t in targets:
                if t["kind"] in ("logo", "cta"):
                    crop = _crop(full, t, out / f"site_{t['kind']}.png")
                    if crop:
                        shots.append(("Logo" if t["kind"] == "logo" else "Main button", crop))
        finally:
            browser.close()
    return SiteCapture(
        url=safe,
        host=urlparse(safe).hostname or "",
        title=str(info.get("title") or ""),
        description=str(info.get("description") or ""),
        headings=list(info.get("headings") or []),
        text=str(info.get("text") or ""),
        shots=shots,
        targets=targets,
        brand=found.get("brand") or {},
    )


# ───────────────────────────── the writer ─────────────────────────────

WRITER_SYSTEM = """You are the writer and director of Rasika, which makes vertical (1080×1920) motion-graphics films
from a brief. You get the KIND of film, its brief, the user's inputs and, for websites, the site's own words and
screenshots. Write the film and return ONE JSON object, nothing else:

{
  "title": "short project title",
  "narration": null | "the full voice-over script (only when narrate is true; ~2.4 words a second)",
  "lines": [ {"text": "on-screen line", "sec": 2.5}, ... ],   // the film's beats in order; sec = how long it holds
  "music": {"mood": "<the kind's mood>", "bpm": 96-150},
  "data": { ... the kind's structured data, below ... }
}

Rules for every kind:
- Total length = the sum of lines' sec, inside the kind's range. With narration, the narration sets the length:
  write it to that range at ~2.4 words/s, and still give `lines` as the on-screen beats in order.
- On-screen lines are short (≤ 7 words), punchy, in the user's language. Never invent facts about a real product:
  every claim comes from the site's own words. No prices, numbers or customers the site does not state.
- Never put words in a real person's mouth as a quote; describe what happens.

The kind's `data`:
- launch / showreel / app:
  {"product": {"name": "...", "tagline": "...", "host": "the site's host"},
   "features": [{"title": "2–4 words", "line": "one benefit line", "shot": "which screenshot label shows it"}],  // 3–4 (showreel: 2)
   "cta": "short call to action, e.g. Try it free at linear.app"}
- recipe:
  {"name": "the drink/dish", "glass": "rocks|highball|coupe|martini|wine|mug", "ice": true|false,
   "layers": [{"name": "Gin", "amount": "45 ml", "color": "#e9e4c8", "fill": 0.35}],  // in pour order; real colours; fills sum ≤ 0.95
   "garnish": null | {"name": "Orange peel", "kind": "citrus|cherry|leaf|olive|peel"},
   "method": ["Stir with ice for 20 seconds", "..."]}           // 1–3 short steps
  Use the user's measures exactly; convert nothing they did not ask for.
- versus:
  {"a": {"name": "...", "color": "#rrggbb"}, "b": {"name": "...", "color": "#rrggbb"}, "winner": "a|b",
   "rounds": [{"title": "Round 1: ...", "moves": [{"by": "a|b", "move": "absurd special move", "word": "POW!", "dmg": 10-40}]}],
   "ko": "the finishing move, by the winner"}
  2–3 rounds, 2–4 moves each. The winner is the user's pick if they gave one; otherwise choose and commit.
  The loser's damage taken must reach 100 by the KO.
- machine:
  {"line": "the line that types out (the user's)", "end": "the closing words (the user's, else ONE PROMPT)",
   "notes": [0-7, ...]}   // 8–14 scale degrees for a catchy 4-second phrase; repeat a motif, end on 0 or 7
  Its `lines` are exactly three: [{"text": <line>, "sec": 12}, {"text": "♪ ♪ ♪ ♪", "sec": 4}, {"text": <end>, "sec": 4}].
- journey:
  {"seasons": ["spring","summer","autumn","winter"], "chapters": ["Part One: Spring", ...],  // one per season
   "frame": "arch|rect", "cup": true|false}
- launch / showreel / app / product / referral / hype (through-line films):
  {"product": {"name": "...", "tagline": "...", "host": "the site's host"},
   "object": {"what": "the through-line object, e.g. the Sign up button", "target": "a target id from the site's targets"},
   "hook": "the problem in 3–5 words",
   "scenes": [{"line": "≤ 6 words, the one readable idea", "key": "the key word (the accent goes on it)",
               "shot": "which screenshot label it happens on", "target": "the target id the cursor clicks (or null)",
               "zoom": "the target id the camera fills the frame with"}],   // 15 s: 2–3, 20 s: 3, 30 s: 3–4, 40 s: 4–5
   "cta": "one-line call to action from the site (e.g. Start free at linear.app)"}
  `lines` = the hook, then each scene's line, then the name + cta, on the 0.5 s beat grid (sec multiples of 0.5).
  Use ONLY targets and screenshots the site gives you; the user's `focus` note (if any) says what to show.
- flyover:
  {"brand": "the brand name (the user's, else the site's)", "line": "the user's statement", "tail": "the user's italic tail"}
  Its `lines` are exactly two: [{"text": "♪", "sec": 9.6}, {"text": <line> + " " + <tail>, "sec": 4.9}].
- diagram:
  {"nodes": [{"id": "short-id", "label": "≤ 3 words", "x": 0-1000, "y": 0-1400, "shape": "circle|box|pill"}],   // 4–7, a clear fixed layout
   "edges": [{"from": "id", "to": "id", "label": "≤ 2 words or null"}],   // the way things actually flow
   "steps": [{"focus": "node id, or null for the whole", "line": "≤ 7 words", "example": "one concrete example, ≤ 7 words"}]}
  Steps: the hook (focus null), 3–5 part steps, the payoff (focus null). `lines` = each step's line, in order.
- explainer:
  {"world": "space|earth|city|ocean|cell|lab",   // the one world the topic lives in
   "beats": [{"line": "on-screen words", "host": "idle|point|tap|wow|think",
              "crowd": null | {"count": 2-100, "highlight": 0-100, "per": "1 figure = …", "label": "short label"},
              "number": null | "a number said in this beat, e.g. 70%"}]}   // one per line, in order
- editorial:
  {"docs": [{"kind": "newspaper|document|letter", "masthead": "optional", "date": "optional, real",
             "headline": "≤ 90 chars, a real, well-established fact in headline form",
             "body": "optional ≤ 200 chars", "mark": "a phrase copied exactly from the headline"}],   // 3–5
   "numbers": [{"value": "e.g. 1903", "label": "what it is"}]}   // 0–3, only real ones
  Write each headline as a paraphrase of established fact, never as a real outlet's actual headline; use a
  generic masthead ("The Daily Record") unless the user named one.
- tierlist:
  {"title": "TOPIC TIER LIST (≤ 40 chars)",
   "tiers": ["S","A","B","C","D"],
   "items": [{"name": "≤ 18 chars", "tier": 0-4, "reason": "one funny line"}]}   // 6–10, in the order they are ranked
  Narration ranks them in exactly this order, naming each item as it is placed.
"""


def write(
    client: Any,
    model: str,
    kind_id: str,
    inputs: dict[str, Any],
    capture: SiteCapture | None,
    narrate: bool,
    max_seconds: float,
) -> tuple[dict[str, Any], dict[str, int]]:
    """The film's script and structured data from one Claude call (screenshots attached)."""
    from rasika_worker.planner import _b64_image

    k = KINDS[kind_id]
    lo, hi = k["seconds"]
    want = inputs.get("seconds")
    if want:  # the user picked a length
        with contextlib.suppress(TypeError, ValueError):
            lo, hi = float(want) - 1.5, float(want) + 1.5
    hi = min(hi, max_seconds)
    lo = min(lo, hi)
    user: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": f"## Kind\n\n{kind_id}: {k['title']}\n\n## Brief\n\n{k['brief']}\n\n"
            f"## Length\n\n{lo:.0f}–{hi:.0f} seconds\n\n## narrate\n\n{str(narrate).lower()}\n\n"
            f"## Mood\n\n{k['mood']}\n\n## The user's inputs\n\n{json.dumps(inputs, ensure_ascii=False)}",
        }
    ]
    if capture:
        user.append(
            {"type": "text", "text": "## The website (its own words)\n\n" + capture.as_prompt()}
        )
        for label, path in capture.shots[:4]:
            user.append({"type": "text", "text": f"Screenshot: {label}"})
            user.append(_b64_image(path))
    resp = client.messages.create(
        model=model,
        max_tokens=4000,
        system=WRITER_SYSTEM,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    usage = {
        "input_tokens": int(getattr(resp.usage, "input_tokens", 0) or 0),
        "output_tokens": int(getattr(resp.usage, "output_tokens", 0) or 0),
    }
    out = parse_json(text)
    texts: list[str] = []
    secs: list[float] = []
    for x in out.get("lines") or []:
        t = str(x.get("text", "")).strip()[:80]
        if t:
            texts.append(t)
            secs.append(max(0.6, min(14.0, float(x.get("sec", 2)))))
    if not texts:
        raise ValueError("the writer returned no on-screen lines")
    if kind_id == "flyover":
        data = out.get("data") or {}
        line = str(data.get("line") or inputs.get("line") or texts[-1])[:60]
        tail = str(data.get("tail") or inputs.get("tail") or "")[:60]
        texts = ["♪", (line + " " + tail).strip()]
        secs = [9.6, 4.9]
    if kind_id == "machine":
        # the drop lands at 12 s whatever the writer timed: silence, the 4-second phrase, the closing words
        data = out.get("data") or {}
        end = str(data.get("end") or inputs.get("end") or "ONE PROMPT")[:40]
        texts = [str(data.get("line") or inputs.get("line") or texts[0])[:80], "♪ ♪ ♪ ♪", end]
        secs = [12.0, 4.0, 4.0]
    total = sum(secs)
    if not narrate and total > hi:  # squeeze to the cap, keeping proportions
        secs = [round(v * hi / total, 2) for v in secs]
    lines: list[dict[str, Any]] = [{"text": t, "sec": v} for t, v in zip(texts, secs, strict=True)]
    out["lines"] = lines
    out["narration"] = (str(out.get("narration") or "").strip() or None) if narrate else None
    out.setdefault("data", {})
    out["music"] = {"mood": k["mood"], "bpm": int((out.get("music") or {}).get("bpm") or 0) or None}
    if k.get("through"):
        out["music"]["bpm"] = 120  # a kick on every beat, a hit on each scene change
    if capture:
        # the planner places the cursor and the zooms on the page's real controls
        out["data"]["site"] = {
            "screenshotWidth": 1440,
            "targets": capture.targets[:40],
            "brand": capture.brand,
        }
    return out, usage


# ───────────────────────────── narration ─────────────────────────────


def align_to_script(words: list[dict[str, Any]], script: str) -> list[dict[str, Any]]:
    """Speech recognition times the narration; the words are the script's own (we wrote them).

    "Cereal" heard as "Syria" keeps its timing and gets its spelling back. Recognised words with no
    script counterpart are dropped; script words the recogniser missed share their neighbours' time.
    """
    import difflib

    toks = script.split()
    if not toks or not words:
        return words

    def norm(s: str) -> str:
        return re.sub(r"[^\w']+", "", s.lower())

    a = [norm(str(w.get("w", ""))) for w in words]
    b = [norm(t) for t in toks]
    out: list[dict[str, Any]] = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "delete":
            continue
        if i2 > i1:
            t0, t1 = float(words[i1]["t"]), float(words[i2 - 1]["end"])
        else:  # inserted: squeeze between the neighbours
            t0 = float(words[i1 - 1]["end"]) if i1 > 0 else 0.0
            t1 = float(words[i1]["t"]) if i1 < len(words) else t0 + 0.3 * (j2 - j1)
            t1 = max(t1, t0 + 0.05 * (j2 - j1))
        if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
            for k in range(j2 - j1):
                src = words[i1 + k]
                out.append({**src, "w": toks[j1 + k]})
            continue
        step = (t1 - t0) / (j2 - j1)
        for k in range(j2 - j1):
            out.append(
                {
                    "w": toks[j1 + k],
                    "t": round(t0 + k * step, 3),
                    "end": round(t0 + (k + 1) * step, 3),
                    "conf": 0.9,
                }
            )
    return out


# ───────────────────────────── timeline ─────────────────────────────


def timeline(
    lines: list[dict[str, Any]], start: float = 0.35
) -> tuple[list[dict[str, Any]], float]:
    """Word timings for a film with no narrator: each line's words spread across its hold, so the
    planner can anchor elements to words exactly as it does for speech."""
    words: list[dict[str, Any]] = []
    t = start
    for ln in lines:
        ws = ln["text"].split()
        span = float(ln["sec"])
        step = min(0.42, span * 0.7 / max(1, len(ws)))
        for i, w in enumerate(ws):
            at = t + i * step
            words.append({"w": w, "t": round(at, 3), "end": round(at + step * 0.9, 3), "conf": 1.0})
        t += span
    return words, round(t + 0.6, 2)
