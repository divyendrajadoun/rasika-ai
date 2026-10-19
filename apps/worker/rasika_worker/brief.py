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
import socket
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from rasika_worker.reference import parse_json

# ───────────────────────────── the kinds ─────────────────────────────

KINDS: dict[str, dict[str, Any]] = {
    "launch": {
        "title": "SaaS launch film",
        "needs": ["url"],
        "preset": "saas-launch",
        "mood": "launch",
        "narrate": False,
        "seconds": (24, 32),
        "brief": "A professionally edited product-launch film of the kind founders post on X: the product's name, "
        "the problem in one line, three or four features each shown on the real page with a benefit line, "
        "a quick montage, the call to action. Confident, fast, clean; every claim taken from the site.",
    },
    "showreel": {
        "title": "15-second motion showreel",
        "needs": ["url"],
        "preset": "showreel-kinetic",
        "mood": "showreel",
        "narrate": False,
        "seconds": (14, 16),
        "brief": "A dynamic 15-second motion-design showreel for this website, as if it were the reel that gets the "
        "designer hired: the brand's name slammed in, two or three of its real screens flying through, kinetic "
        "type on the beat, one surprising transition, the logo/name to close. More motion than words.",
    },
    "app": {
        "title": "Apple-style app film",
        "needs": ["url"],
        "preset": "porcelain-keynote",
        "mood": "launch",
        "narrate": False,
        "seconds": (26, 32),
        "brief": "An Apple-style 30-second film for this app: calm white space, one idea per shot, short declarative "
        'lines ("Meet …", "Designed for …"), the real screens presented on a clean stage, slow pushes, a final '
        "name card. Understated and premium.",
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

    def as_prompt(self) -> str:
        return json.dumps(
            {
                "url": self.url,
                "title": self.title,
                "description": self.description,
                "headings": self.headings[:30],
                "text": self.text[:4000],
                "screenshots": [label for label, _ in self.shots],
            },
            ensure_ascii=False,
        )


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
    return out, usage


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
