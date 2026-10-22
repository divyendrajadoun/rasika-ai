"""The four how-to videos, recorded on the local app with the test account.

  apps/worker/.venv/Scripts/python.exe tools/tutorials/tutorials.py [1 2 3 4]   (needs `next dev -p 3001`)

1 Make your first reel · 2 A film without a camera · 3 Edit and export · 4 Buy reels with UPI.
Rendering happens between scenes (off camera); the video says "A few minutes later".
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import psycopg
from playwright.sync_api import sync_playwright

from recorder import ROOT, Recorder, Scene, Voice, build, env, load, sign_in

BASE = "http://localhost:3001"
OUT = ROOT / "out" / "tutorials"
CLIP = ROOT / ".work-styledemos" / "clip.mp4"


def db():
    return psycopg.connect(env()["DATABASE_URL"], autocommit=True)


def set_credits(n: int) -> None:
    with db() as c:
        c.execute("UPDATE profiles SET credits = %s WHERE email = %s", (n, env()["RASIKA_TEST_EMAIL"]))


def wait_done(project_id: str, limit: float = 1500) -> None:
    t0 = time.time()
    last = ""
    while time.time() - t0 < limit:
        with db() as c:
            row = c.execute(
                "SELECT status, message, error FROM jobs WHERE project_id = %s ORDER BY created_at DESC LIMIT 1",
                (project_id,),
            ).fetchone()
        if row and f"{row[0]} {row[1]}" != last:
            last = f"{row[0]} {row[1]}"
            print("   job:", last[:100])
        if row and row[0] == "done":
            return
        if row and row[0] == "failed":
            raise RuntimeError(f"job failed: {row[2]}")
        time.sleep(5)
    raise TimeoutError("job did not finish")


def project_id_of(url: str) -> str:
    return url.rstrip("/").split("/dashboard/p/")[1].split("?")[0]


# ── 1 · your first reel ──
def first_reel_a(r: Recorder) -> None:
    p = r.page
    p.goto(f"{BASE}/dashboard", wait_until="networkidle")
    r.start()
    r.say("This is your Rasika dashboard. Every reel you make lives here.")
    r.say("To turn a video of yourself into a reel, click New edit.")
    r.click(p.get_by_role("navigation", name="Dashboard").get_by_role("link", name="New edit"))
    p.wait_for_selector("text=New edit · step 1")
    r.say("Choose My take: a video of you talking to the camera.")
    r.click(p.get_by_role("radio", name="My take"))
    r.say("Then click Continue.")
    r.click(p.get_by_role("button", name="Continue"))
    r.say("Now drop your video in, or click to choose it. A phone video is perfect.")
    with p.expect_file_chooser() as fc:
        r.click(p.get_by_text("Drop your reel here"))
    fc.value.set_files(str(CLIP))
    r.say("It uploads straight away, and picks up again if your connection drops.")
    cont = p.get_by_role("button", name="Continue")
    t0 = time.time()
    while not cont.is_enabled() and time.time() - t0 < 180:
        p.wait_for_timeout(500)
    r.wait_line()
    r.click(p.get_by_role("button", name="Continue"))
    r.say("You can add photos here, and Rasika shows each one on the word you say. Let's skip that for now.")
    r.click(p.get_by_role("button", name="Skip photos"))
    r.say("Pick a style. There are over a hundred, each with its own type, colours, motion and sound.")
    group = p.get_by_role("radiogroup", name="Style preset")
    cards = group.get_by_role("radio")
    for k in (1, 2, 3):
        r.move(cards.nth(k))
        p.wait_for_timeout(500)
    r.click(cards.nth(0))
    r.say("Mikku Royal is a good start. Click Continue.")
    r.click(p.get_by_role("button", name="Continue"))
    r.say("Give your reel a title, and add your brand if you like.")
    title = p.get_by_placeholder("What is your taste?")
    title.fill("")
    r.type(title, "My first Rasika reel")
    r.type(p.get_by_placeholder("Khanna Homes"), "Baisa Bling")
    r.say("Tick the box to confirm the video is yours.")
    r.click(p.locator("label:has(input[type=checkbox])").last)
    r.say("Your first reel is free. Click Create my edit.")
    r.click(p.get_by_role("button", name="Create my edit"), after=1.0)
    p.wait_for_url("**/dashboard/p/**", timeout=60000)
    r.say("Rasika now times every word, designs your edit and renders it. You can close the page while it works.")
    p.wait_for_timeout(2500)
    r.stop()
    Path(OUT / "t1_project.txt").write_text(project_id_of(p.url), encoding="utf8")


def first_reel_b(r: Recorder) -> None:
    p = r.page
    pid = (OUT / "t1_project.txt").read_text(encoding="utf8").strip()
    p.goto(f"{BASE}/dashboard/p/{pid}", wait_until="networkidle")
    r.start()
    r.say("Your reel is ready.")
    vid = p.locator("#download video")
    vid.evaluate("e => e.scrollIntoView({block: 'center', behavior: 'smooth'})")
    p.wait_for_timeout(900)
    r.say("Press play to watch it: poster titles, captions on every word, motion and sound.")
    r.click(vid, after=0.2)
    p.evaluate("v => { v.muted = true; v.play(); }", vid.element_handle())
    p.wait_for_timeout(5500)
    r.say("Then download the full-quality file, ready for Instagram, YouTube Shorts and TikTok.")
    r.move(p.get_by_role("link", name="Download 1080p MP4"))
    p.wait_for_timeout(1200)
    r.say("Want changes? You can edit it right here. That's the next video.")
    r.stop(tail=1.2)


# ── 2 · a film without a camera ──
def brief_a(r: Recorder) -> None:
    p = r.page
    p.goto(f"{BASE}/dashboard/new", wait_until="networkidle")
    r.start()
    r.say("No video? No problem. Rasika can make a whole film from a brief.")
    r.say("Click From a brief.")
    r.click(p.get_by_role("radio", name="From a brief"))
    r.click(p.get_by_role("button", name="Continue"))
    r.say("Pick the kind of film. From a website link you get launch films, product films and more.")
    r.scroll(300)
    r.click(p.get_by_role("radio", name="Hype launch"))
    r.say("Paste your website's link. Rasika visits it and films its real pages.")
    url = p.locator("#brief-url")
    r.type(url, "https://rasika-ai.netlify.app", delay=30)
    r.say("Tell it what to focus on, in a line.")
    r.type(p.locator("#brief-focus"), "Talk to your phone, post like a studio", delay=30)
    r.say("Click Continue, skip photos, and give it a title.")
    r.click(p.get_by_role("button", name="Continue"))
    r.click(p.get_by_role("button", name="Skip photos"))
    title = p.get_by_placeholder("What is your taste?")
    title.fill("")
    r.type(title, "Rasika hype launch")
    r.click(p.locator("label:has(input[type=checkbox])").last)
    r.say("Each film uses one credit. Click Create my edit.")
    r.click(p.get_by_role("button", name="Create my edit"), after=1.0)
    p.wait_for_url("**/dashboard/p/**", timeout=60000)
    r.say("Rasika writes the film, scores it with music and sound, and renders it.")
    p.wait_for_timeout(2500)
    r.stop()
    Path(OUT / "t2_project.txt").write_text(project_id_of(p.url), encoding="utf8")


def brief_b(r: Recorder) -> None:
    p = r.page
    pid = (OUT / "t2_project.txt").read_text(encoding="utf8").strip()
    p.goto(f"{BASE}/dashboard/p/{pid}", wait_until="networkidle")
    r.start()
    r.say("And here's the film, made from nothing but a link.")
    vid = p.locator("#download video")
    vid.evaluate("e => e.scrollIntoView({block: 'center', behavior: 'smooth'})")
    p.wait_for_timeout(900)
    r.click(vid, after=0.2)
    p.evaluate("v => { v.muted = true; v.play(); }", vid.element_handle())
    r.say("Its real screens, in its own colours and type, cut to the beat.")
    p.wait_for_timeout(5000)
    r.say("Download it, and post it anywhere.")
    r.move(p.get_by_role("link", name="Download 1080p MP4"))
    p.wait_for_timeout(1000)
    r.stop(tail=1.2)


# ── 3 · edit and export ──
def edit_a(r: Recorder) -> None:
    p = r.page
    pid = (OUT / "t1_project.txt").read_text(encoding="utf8").strip()
    p.goto(f"{BASE}/dashboard/p/{pid}", wait_until="networkidle")
    r.start()
    r.say("Open any finished reel, and scroll to Edit.")
    p.locator("#edit-h").scroll_into_view_if_needed()
    r.scroll(150)
    r.say("Your video is written out as text. Click a word to cut it. Click it again to bring it back.")
    words = p.locator("section[aria-labelledby=edit-h] p button")
    n = words.count()
    r.click(words.nth(min(6, n - 1)))
    r.click(words.nth(min(6, n - 1)))
    r.say("To cut a whole sentence, click its first word, then shift-click its last.")
    a, b = min(10, n - 2), min(18, n - 1)
    r.click(words.nth(a))
    p.keyboard.down("Shift")
    r.click(words.nth(b))
    p.keyboard.up("Shift")
    r.say("Rasika also marks ums, repeats and earlier takes of a line. One click cuts them all.")
    r.move(p.locator("section[aria-labelledby=edit-h] button").first)
    p.wait_for_timeout(600)
    r.say("Press play on the left to hear your edit before you render it. The cut words are skipped.")
    vid = p.locator("section[aria-labelledby=edit-h] video")
    r.click(vid, after=0.2)
    p.evaluate("v => { v.muted = true; v.play(); }", vid.element_handle())
    p.wait_for_timeout(3000)
    p.evaluate("v => v.pause()", vid.element_handle())
    r.say("Turn on Studio sound to clean up hum, hiss and room noise.")
    r.click(p.get_by_label("Studio sound"))
    r.say("Then click Render this edit, and Rasika makes the reel again on your cut.")
    r.click(p.get_by_role("button", name="Render this edit"), after=1.5)
    p.locator("section[aria-live]").scroll_into_view_if_needed()
    r.say("Every edit starts from your original video, so nothing is ever lost.")
    p.wait_for_timeout(2000)
    r.stop()


def edit_b(r: Recorder) -> None:
    p = r.page
    pid = (OUT / "t1_project.txt").read_text(encoding="utf8").strip()
    p.goto(f"{BASE}/dashboard/p/{pid}", wait_until="networkidle")
    r.start()
    r.say("Your edited reel is ready. Now, other shapes.")
    p.get_by_text("Other shapes").scroll_into_view_if_needed()
    r.scroll(300)
    r.say("For YouTube or LinkedIn, make a wide or square copy. The whole reel fits, nothing is cropped.")
    wide = p.locator("li", has_text="Wide 16:9")
    r.click(wide.get_by_role("button", name="Make this shape"), after=0.5)
    r.say("It takes about twenty seconds.")
    p.wait_for_timeout(1500)
    with db() as c:
        t0 = time.time()
        while time.time() - t0 < 180:
            row = c.execute(
                "SELECT status FROM jobs WHERE project_id = %s ORDER BY created_at DESC LIMIT 1", (pid,)
            ).fetchone()
            if row and row[0] == "done":
                break
            time.sleep(1.5)
    p.reload(wait_until="networkidle")
    p.get_by_text("Other shapes").scroll_into_view_if_needed()
    r.scroll(300)
    r.say("Done. Click Download to save it.")
    r.move(p.locator("li", has_text="Wide 16:9").get_by_role("link", name="Download"))
    p.wait_for_timeout(1200)
    r.stop(tail=1.2)


# ── 4 · buy reels ──
def buy_a(r: Recorder) -> None:
    p = r.page
    p.goto(f"{BASE}/dashboard", wait_until="networkidle")
    r.start()
    r.say("Used your free reel? Here's how to buy more.")
    r.say("Click Credits at the top.")
    r.click(p.get_by_role("navigation", name="Dashboard").get_by_role("link", name="Credits"))
    p.wait_for_selector("text=Pay ₹2,999 by UPI")
    r.say("Choose a pack: one reel, ten reels, or thirty. Bigger packs cost less per reel, and credits never expire.")
    for name in ("Pay ₹399 by UPI", "Pay ₹8,000 by UPI"):
        r.move(p.get_by_role("button", name=name))
        p.wait_for_timeout(500)
    r.click(p.get_by_role("button", name="Pay ₹2,999 by UPI"), after=1.0)
    p.wait_for_selector("text=Send us the UTR")
    r.say("Scan the code with any UPI app: Google Pay, PhonePe, Paytm or your bank's app.")
    r.move(p.locator("[role=img][aria-label^='UPI QR']"))
    p.wait_for_timeout(800)
    r.say("On your phone, just tap Open my UPI app. The amount is filled in for you.")
    r.move(p.get_by_role("link", name="Open my UPI app"))
    p.wait_for_timeout(600)
    r.say("After paying, open the payment in your UPI app and copy the twelve-digit UTR number.")
    r.say("Paste it here, and click I've paid.")
    r.type(p.get_by_label("UTR"), "5" + str(int(time.time() * 1000))[-11:], delay=60)
    r.click(p.get_by_role("button", name="I've paid"), after=1.2)
    p.wait_for_selector("text=confirming your payment")
    r.say("That's it. We check the payment and add your reels, usually within a few hours. You'll get an email when they're ready.")
    p.wait_for_timeout(1500)
    r.stop(tail=1.2)


TUTORIALS = {
    "1": (
        "How to make your first reel",
        "From your video to a finished reel",
        "That's your first reel. Make yours free at rasika dash A I dot netlify dot app.",
        [("a", first_reel_a, None, "t1_project.txt", 1), ("b", first_reel_b, "A few minutes later", None, None)],
        "rasika-how-to-1-first-reel.mp4",
    ),
    "2": (
        "Make a film without a camera",
        "From a brief or a website link",
        "Make your own film at rasika dash A I dot netlify dot app.",
        [("a", brief_a, None, "t2_project.txt", 1), ("b", brief_b, "A few minutes later", None, None)],
        "rasika-how-to-2-film-from-a-brief.mp4",
    ),
    "3": (
        "Edit your reel",
        "Cut words, clean the sound, export any shape",
        "Edit yours at rasika dash A I dot netlify dot app.",
        [("a", edit_a, None, "t1_project.txt", None), ("b", edit_b, "A few minutes later", None, None)],
        "rasika-how-to-3-edit-and-export.mp4",
    ),
    "4": (
        "Buy more reels",
        "Pay by UPI from any app",
        "Get your reels at rasika dash A I dot netlify dot app.",
        [("a", buy_a, None, None, 0)],
        "rasika-how-to-4-buy-reels.mp4",
    ),
}


def main() -> None:
    args = sys.argv[1:]
    rebuild = "--build-only" in args  # assemble again from the saved scenes (no recording)
    which = [a for a in args if a in TUTORIALS] or list(TUTORIALS)
    if rebuild:
        voice = Voice(OUT / "_voice")
        for key in which:
            title, sub, outro, scenes_def, fname = TUTORIALS[key]
            scenes = [load(OUT / "_frames" / f"t{key}{d[0]}" / "scene.json") for d in scenes_def]
            build(scenes, title, sub, outro, OUT / fname, voice)
        return
    OUT.mkdir(parents=True, exist_ok=True)
    voice = Voice(OUT / "_voice")
    state = OUT / "_state.json"
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True, args=["--autoplay-policy=no-user-gesture-required"])
        sign_in(browser, BASE, state)
        for key in which:
            title, sub, outro, scenes_def, fname = TUTORIALS[key]
            print(f"== {key}: {title}")
            scenes: list[Scene] = []
            for name, fn, card_before, waits_for, credits in scenes_def:
                if credits is not None:
                    set_credits(credits)
                sc = Scene(f"t{key}{name}", card_before=card_before)
                rec = Recorder(browser, state, OUT / "_frames", voice, sc)
                fn(rec)
                scenes.append(sc)
                print(f"   scene {sc.name}: {sc.end - sc.start:.1f} s, {len(sc.frames)} frames")
                if waits_for:
                    wait_done((OUT / waits_for).read_text(encoding="utf8").strip())
                elif key == "3" and name == "a":
                    wait_done((OUT / "t1_project.txt").read_text(encoding="utf8").strip())
            build(scenes, title, sub, outro, OUT / fname, voice)
        browser.close()


if __name__ == "__main__":
    main()
