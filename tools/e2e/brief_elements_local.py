"""Render each brief-film element locally from a hand-written plan (no queue, no storage, no Claude).

Runs the real pieces: the website capture (for the browser window), the engine's validator, the
music generator, the sound cues and the renderer — so a regression in any of them shows up here.

  apps/worker/.venv/Scripts/python.exe tools/e2e/brief_elements_local.py <out_dir> [only]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

from rasika_worker import brief, media, music  # noqa: E402
from rasika_worker.planner import ChromiumValidator  # noqa: E402
from rasika_worker.render import RenderSpec, render  # noqa: E402
from rasika_worker.settings import Settings  # noqa: E402

PRESETS = ROOT / "packages" / "schema" / "presets"


def style(pid: str) -> dict:
    return json.loads((PRESETS / f"{pid}.json").read_text(encoding="utf-8"))


def base(pid: str, dur: float) -> dict:
    return {
        "version": 1,
        "meta": {"durationSec": dur, "fps": 30, "width": 1080, "height": 1920, "language": "en", "faceless": True},
        "style": style(pid),
        "subject": {"faceBox": {"x": 0, "y": 0, "w": 1, "h": 1}, "freeZone": {"x": 0, "y": 150, "w": 1080, "h": 1500}},
        "videoModes": [{"t": 0, "mode": "full"}],
        "captions": {"enabled": False, "y": 1400, "gold": [], "accent": []},
        "sfx": {"auto": True, "intensity": 1.0},
        "elements": [],
    }


def poster(id_: str, t0: float, t1: float, text: str, size: int, top: int, color: str = "ink", anim: str = "rise", font: str = "anton", accent: str | None = None) -> dict:
    el = {"id": id_, "type": "posterText", "t0": t0, "t1": t1, "top": top, "anim": anim, "left": 40, "w": 1000,
          "lines": [{"text": text, "font": font, "size": size, "color": color}], "align": "center"}
    if accent:
        el["accent"] = accent
    return el


def films(site_img: str | None) -> dict[str, tuple[dict, list[dict], str, dict]]:
    out: dict[str, tuple[dict, list[dict], str, dict]] = {}

    # music machine: silent build, ball drops at 12 s, a 4 s phrase, closing words on a final hit
    p = base("music-machine", 20.6)
    drop = 12.0
    grid = [0, 0.25, 0.5, 1.0, 1.25, 1.5, 2.0, 2.25, 2.5, 3.0, 3.25, 3.5]
    keys = [0, 2, 4, 7, 4, 2, 0, 4, 7, 5, 4, 0]
    m_t0 = 3.6
    p["elements"] = [
        poster("line", 0.4, 3.9, "make it catchy.", 170, 380, "ink"),
        {"id": "machine", "type": "noteMachine", "t0": m_t0, "t1": 16.4, "top": 420, "dropAt": drop - m_t0,
         "notes": [{"at": drop - m_t0 + g, "key": k} for g, k in zip(grid, keys, strict=True)],
         "drums": [drop - m_t0 + i * 0.5 for i in range(8)]},
        poster("end", 16.5, 20.6, "ONE PROMPT", 230, 820, "ink", anim="pop", accent="sub"),
    ]
    out["machine"] = (p, [{"text": "make it catchy.", "sec": 12}, {"text": "♪ ♪ ♪ ♪", "sec": 4}, {"text": "ONE PROMPT", "sec": 4}], "none", {})

    # recipe: a Negroni poured layer by layer, then the peel
    p = base("recipe-explainer", 12.5)
    p["elements"] = [
        poster("name", 0.3, 12.5, "Negroni", 150, 170, "ter", font="anton"),
        {"id": "glass", "type": "pourGlass", "t0": 0.5, "t1": 12.5, "glass": "rocks", "cx": 470, "top": 620, "size": 640, "ice": True,
         "layers": [
             {"name": "Gin", "amount": "30 ml", "color": "#e9e4c8", "fill": 0.28, "at": 0.6, "dur": 1.3},
             {"name": "Campari", "amount": "30 ml", "color": "#c8102e", "fill": 0.28, "at": 2.6, "dur": 1.3},
             {"name": "Sweet vermouth", "amount": "30 ml", "color": "#6e1d12", "fill": 0.28, "at": 4.6, "dur": 1.3},
         ],
         "garnish": {"name": "Orange peel", "kind": "peel", "at": 6.8}},
    ]
    out["recipe"] = (p, [{"text": "Negroni", "sec": 2}, {"text": "Gin 30 ml", "sec": 2}, {"text": "Campari 30 ml", "sec": 2}, {"text": "Sweet vermouth 30 ml", "sec": 2}, {"text": "Orange peel", "sec": 4}], "recipe", {})

    # versus: tabs v spaces, three hits and a K.O.
    p = base("versus-arcade", 12.5)
    p["elements"] = [
        {"id": "hud", "type": "fightHud", "t0": 0.3, "t1": 12.5, "a": {"name": "Tabs", "color": "#e2403a"}, "b": {"name": "Spaces", "color": "#2f6fe0"},
         "hits": [{"at": 2.0, "by": "a", "dmg": 30, "word": "INDENT!"}, {"at": 3.6, "by": "b", "dmg": 25, "word": "ALIGN!"},
                  {"at": 5.2, "by": "b", "dmg": 35, "word": "PEP 8!"}, {"at": 6.8, "by": "a", "dmg": 20, "word": "WHAM!"}],
         "koAt": 8.6, "winner": "b"},
        poster("move", 5.2, 6.6, "PEP 8 SLAM", 170, 1180, "gold"),
    ]
    out["versus"] = (p, [{"text": "Round one fight", "sec": 4}, {"text": "PEP 8 slam", "sec": 4}, {"text": "Spaces wins", "sec": 4.2}], "versus", {})

    # journey: four seasons through a train window
    p = base("grand-budapest", 14.5)
    p["elements"] = [
        {"id": "win", "type": "seasonWindow", "t0": 0.3, "t1": 14.5, "seasons": ["spring", "summer", "autumn", "winter"], "x": 140, "y": 470, "w": 800, "h": 940, "shape": "arch", "cup": True},
        poster("l1", 0.4, 7, "THE 7:15 TO NOWHERE", 64, 200, "ter", font="kicker"),
        poster("l2", 7.2, 14.5, "IT WAS, BY ALL ACCOUNTS, PUNCTUAL", 58, 200, "ter", font="kicker"),
    ]
    out["journey"] = (p, [{"text": "The 7:15 to nowhere", "sec": 7}, {"text": "it was by all accounts punctual", "sec": 7.4}], "journey", {})

    # tier list: six picks, each flying into its row on the word
    p = base("tier-list", 12.5)
    tiers = [{"label": "S", "color": "#EE5F52"}, {"label": "A", "color": "#F0A04C"}, {"label": "B", "color": "#F0C84D"},
             {"label": "C", "color": "#EDE356"}, {"label": "D", "color": "#A6DA7B"}]
    picks = [("Cereal", 0), ("Pancakes", 1), ("Waffles", 1), ("Eggs", 2), ("Oatmeal", 3), ("Plain toast", 4)]
    p["elements"] = [
        {"id": "board", "type": "tierBoard", "t0": 0.4, "t1": 12.5, "title": "Breakfast tier list", "top": 320,
         "tiers": tiers, "items": [{"name": n, "tier": t, "at": 1.4 + i * 1.5} for i, (n, t) in enumerate(picks)]},
        poster("why", 9.6, 12.5, "TOAST IS JUST WARM BREAD", 70, 1330, "iv"),
    ]
    out["tierlist"] = (p, [{"text": "Breakfast tier list", "sec": 3}, {"text": "cereal pancakes waffles", "sec": 4.5}, {"text": "eggs oatmeal toast", "sec": 4.6}], "showreel", {})

    # explainer: a world, the host hopping between perches, a crowd that lights up 1 in 4
    p = base("kurz-explainer", 12.5)
    p["elements"] = [
        {"id": "world", "type": "explainerWorld", "t0": 0, "t1": 12.5, "world": "earth", "dolly": 0.5,
         "host": [{"at": 0.2, "x": 820, "y": 520, "pose": "idle"}, {"at": 3.0, "x": 220, "y": 420, "pose": "point"},
                  {"at": 6.5, "x": 860, "y": 1500, "pose": "tap"}, {"at": 10.0, "x": 540, "y": 330, "pose": "wow"}]},
        poster("q", 0.4, 3.6, "Why is the sky blue?", 110, 760, "mar", font="serif"),
        {"id": "people", "type": "crowd", "t0": 4.0, "t1": 9.6, "count": 20, "highlight": 5, "at": 2.0,
         "per": "1 figure = 1 in 20 people", "label": "1 in 4 never asked", "top": 520},
        poster("pay", 9.8, 12.5, "Blue light scatters most.", 96, 760, "mar", font="serif"),
    ]
    out["explainer"] = (p, [{"text": "Why is the sky blue", "sec": 3.6}, {"text": "one in four never asked", "sec": 5.8}, {"text": "blue light scatters most", "sec": 3.1}], "recipe", {})

    # editorial: two clippings, each struck by the red marker on its phrase
    p = base("vox-paper", 10.5)
    p["elements"] = [
        {"id": "d1", "type": "docCard", "t0": 0.4, "t1": 5.2, "kind": "newspaper", "masthead": "The Daily Record",
         "date": "December 18, 1903", "headline": "Two brothers fly a powered machine for 12 seconds",
         "body": "At Kitty Hawk, the craft rose under its own power and landed 120 feet away.",
         "mark": "12 seconds", "markStyle": "circle", "markAt": 1.6, "x": 90, "y": 520, "w": 900, "tilt": -2},
        {"id": "d2", "type": "docCard", "t0": 5.4, "t1": 10.5, "kind": "document", "masthead": "Memo", "date": "1927",
         "headline": "A solo flight crosses the Atlantic in 33 hours", "mark": "33 hours", "markStyle": "underline",
         "markAt": 1.8, "x": 110, "y": 600, "w": 860, "tilt": 2},
    ]
    out["editorial"] = (p, [{"text": "twelve seconds in 1903", "sec": 5}, {"text": "thirty three hours in 1927", "sec": 5.2}], "recipe", {})

    # product elements on a real capture of linear.app (tools: brief.capture_site)
    cap = Path(__file__).resolve().parents[3] / "rasika_scratch" / "cap_linear"
    if (cap / "site_full.png").exists():
        imgs = {"full": str(cap / "site_full.png"), "hero": str(cap / "site_hero.png"),
                "logo": str(cap / "site_logo.png"), "cta": str(cap / "site_cta.png")}
        p = base("saas-launch", 12.0)
        p["elements"] = [
            poster("hook", 0.3, 2.3, "Shipping is slow.", 190, 640, "iv"),
            {"id": "obj", "type": "throughLine", "t0": 0.6, "t1": 12.0, "keys": [
                {"at": 0.2, "x": 430, "y": 900, "w": 220, "h": 96, "radius": 16, "fill": "#e5e5e6", "imageId": "cta"},
                {"at": 1.9, "x": 340, "y": 1660, "w": 400, "h": 96, "radius": 999, "fill": "#e5e5e6", "text": "Plan", "textColor": "#08090a"},
                {"at": 5.4, "x": 340, "y": 1660, "w": 400, "h": 96, "radius": 999, "fill": "#e5e5e6", "text": "Build", "textColor": "#08090a"},
                {"at": 8.9, "x": 230, "y": 700, "w": 620, "h": 200, "radius": 40, "fill": "#08090a", "imageId": "logo"}]},
            {"id": "screen", "type": "screenFocus", "t0": 2.5, "t1": 9.4, "imageId": "full", "url": "linear.app",
             "x": 40, "y": 330, "w": 1000, "h": 1240, "steps": [
                {"at": 0, "box": {"x": 0, "y": 0, "w": 1440, "h": 1786}},
                {"at": 1.0, "box": {"x": 1140, "y": 0, "w": 300, "h": 372}, "cursor": {"x": 1324, "y": 36}, "click": True},
                {"at": 3.5, "box": {"x": 0, "y": 815, "w": 1375, "h": 1705}},
                {"at": 5.0, "box": {"x": 40, "y": 1500, "w": 700, "h": 868}, "cursor": {"x": 300, "y": 1650}, "click": True}]},
            poster("s1", 2.5, 5.9, "Plan in one place", 96, 170, "iv"),
            poster("s2", 6.1, 9.4, "Build without friction", 96, 170, "iv"),
            poster("name", 9.6, 12.0, "Linear", 150, 1000, "iv"),
            poster("cta", 9.9, 12.0, "Start free at linear.app", 60, 1200, "iv", font="kicker"),
        ]
        out["through"] = (p, [{"text": "Shipping is slow", "sec": 2}, {"text": "plan in one place", "sec": 3.5}, {"text": "build without friction", "sec": 3.5}, {"text": "Linear start free", "sec": 2.6}], "showreel", imgs)

        p = base("porcelain-keynote", 14.5)
        p["elements"] = [
            {"id": "fly", "type": "pageFlyover", "t0": 0, "t1": 14.5, "imageId": "full", "heroImageId": "hero",
             "logoImageId": "logo", "brand": "Linear", "line": "Built for the way you work.", "tail": "Finally."},
        ]
        out["flyover"] = (p, [{"text": "♪", "sec": 9.6}, {"text": "Built for the way you work. Finally.", "sec": 4.6}], "showreel", imgs)

    p = base("porcelain-keynote", 16.0)
    p["elements"] = [
        {"id": "dia", "type": "diagramZoom", "t0": 0.3, "t1": 16.0, "top": 260,
         "nodes": [{"id": "you", "label": "You", "x": 500, "y": 220, "shape": "circle"},
                   {"id": "edge", "label": "Edge server", "x": 500, "y": 700, "shape": "box"},
                   {"id": "cache", "label": "Cache", "x": 820, "y": 1000, "shape": "pill"},
                   {"id": "origin", "label": "Origin", "x": 500, "y": 1200, "shape": "box"}],
         "edges": [{"from": "you", "to": "edge", "label": "request"}, {"from": "edge", "to": "cache"}, {"from": "edge", "to": "origin", "label": "miss"}],
         "steps": [{"at": 0.0, "focus": None}, {"at": 3.0, "focus": "edge", "example": "A copy 20 ms away"},
                   {"at": 7.0, "focus": "cache", "example": "Kept for the next visitor"}, {"at": 11.5, "focus": None}]},
        poster("q", 0.3, 3.0, "Why is it fast?", 80, 120, "mar", font="kicker"),
        poster("l2", 3.3, 7.0, "The nearest server answers", 72, 120, "mar", font="kicker"),
        poster("l3", 7.3, 11.4, "Copies stay close", 72, 120, "mar", font="kicker"),
        poster("l4", 11.8, 16.0, "Closer means faster.", 80, 120, "mar", font="kicker"),
    ]
    out["diagram"] = (p, [{"text": "why is it fast", "sec": 3}, {"text": "the nearest server answers", "sec": 4}, {"text": "copies stay close", "sec": 4.4}, {"text": "closer means faster", "sec": 4.3}], "showreel", {})

    if site_img:
        p = base("saas-launch", 8.5)
        p["elements"] = [
            poster("name", 0.3, 8.5, "Linear", 220, 180, "iv", font="anton"),
            {"id": "win", "type": "browserCard", "t0": 1.0, "t1": 8.5, "imageId": "site", "url": "linear.app", "x": 60, "y": 520, "w": 960, "h": 720, "scroll": 0.5, "tilt": -2},
        ]
        out["launch"] = (p, [{"text": "Linear", "sec": 3}, {"text": "plan and build products", "sec": 5}], "launch", {"site": site_img})
    return out


def main() -> int:
    out = Path(sys.argv[1]).resolve()
    only = sys.argv[2] if len(sys.argv) > 2 else None
    out.mkdir(parents=True, exist_ok=True)
    s = Settings()
    site_img = None
    if only in (None, "launch"):
        cap = brief.capture_site("https://linear.app", out / "site")
        print("captured", cap.host, "|", cap.title[:60], "|", [lbl for lbl, _ in cap.shots])
        site_img = str(next(p for lbl, p in cap.shots if "full" in lbl))
        # the guard: internal addresses are refused before any request
        for bad in ("http://localhost:3000", "http://127.0.0.1:9000", "http://10.0.0.5", "http://rustfs:9000", "file:///etc/passwd"):
            try:
                brief.check_url(bad)
                print("NOT BLOCKED", bad)
            except brief.UnsafeUrlError:
                print("blocked", bad)
    validator = ChromiumValidator(s)
    ready: list[tuple[str, dict, list[dict], str, dict]] = []
    try:
        for name, (plan, lines, mood, images) in films(site_img).items():
            if only and name != only:
                continue
            words, _ = brief.timeline(lines)
            res = validator(plan, words, list(images))
            errors = [i for i in res["issues"] if i["level"] == "error"]
            print(name, "valid" if res["ok"] else "INVALID", [f"{i['code']}: {i['message']}" for i in errors][:4])
            if res["ok"]:
                ready.append((name, res["plan"], words, mood, images))
    finally:
        validator.close()  # one Playwright session per thread: the renderer opens its own
    for name, plan, words, mood, images in ready:
        work = out / name
        work.mkdir(parents=True, exist_ok=True)
        dur = float(plan["meta"]["durationSec"])
        voice = work / "voice.wav"
        music.write(voice, music.compose(mood, dur))
        src = work / "source.mp4"
        media.make_stage_video(s.ffmpeg_bin, voice, src, plan["style"]["palette"]["stage"], dur)
        frames = work / "frames"
        n = media.extract_frames(s.ffmpeg_bin, src, frames)
        spec = RenderSpec(plan, words, {k: Path(v) for k, v in images.items()}, frames, n, voice, preview=False)
        r = render(s, work, spec)
        print(name, "rendered", r.final, f"{len(r.cues.get('cues', []))} cues")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
