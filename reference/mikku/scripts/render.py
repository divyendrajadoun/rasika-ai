#!/usr/bin/env python3
"""
Deterministic frame-by-frame renderer for code-based motion videos.

The composition HTML must expose:
  window.COMP = {width, height, fps, duration}      (seconds)
  window.renderFrame(t)                              draws the frame at time t (seconds); may return a Promise
  window.__ready (optional Promise)                  resolves when images/fonts/data are loaded

Usage:
  python render.py comp.html -o out.mp4                      # full render
  python render.py comp.html -o out.mp4 --audio music.mp3    # render + mux audio (auto fade-out)
  python render.py comp.html --stills 0,1.5,4,9 --outdir shots   # PNG stills for review
  python render.py comp.html --sheet 12 --outdir shots           # contact sheet of 12 evenly spaced frames
  python render.py comp.html -o part.mp4 --start 4 --end 8       # render a time range only

Requires: pip install playwright && playwright install chromium ; ffmpeg on PATH
"""
import argparse, pathlib, subprocess, sys, time, shutil

from playwright.sync_api import sync_playwright

SEEK_JS = """async (t) => {
  // Freeze any CSS / Web Animations at time t so they render deterministically too
  for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch (e) {} }
  const r = window.renderFrame(t);
  if (r && typeof r.then === 'function') await r;
  // images that were just swapped in must be decoded before capture
  const imgs = [...document.images].filter(i => !i.complete);
  if (imgs.length) await Promise.all(imgs.map(i => i.decode().catch(() => {})));
}"""


def open_page(p, html, args):
    browser = p.chromium.launch(args=["--disable-web-security", "--allow-file-access-from-files",
                                      "--autoplay-policy=no-user-gesture-required"])
    # load once with a default viewport to read COMP
    page = browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
    page.add_init_script("window.__RENDER__ = true;")
    page.goto(pathlib.Path(html).resolve().as_uri())
    page.wait_for_function("typeof window.renderFrame === 'function' && !!window.COMP", timeout=30000)
    comp = page.evaluate("() => window.COMP")
    w = args.width or comp["width"]; h = args.height or comp["height"]
    page.set_viewport_size({"width": w, "height": h})
    page.evaluate("""async () => { if (window.__ready) await window.__ready; await document.fonts.ready; }""")
    return browser, page, comp, w, h


_cdp = {}


def shoot(page, t, path=None, png=False, quality=95):
    import base64
    page.evaluate(SEEK_JS, t)
    if id(page) not in _cdp:
        _cdp[id(page)] = page.context.new_cdp_session(page)
    fmt = "png" if (png or (path and str(path).endswith(".png"))) else "jpeg"
    params = {"format": fmt, "optimizeForSpeed": True, "captureBeyondViewport": False}
    if fmt == "jpeg":
        params["quality"] = quality
    data = base64.b64decode(_cdp[id(page)].send("Page.captureScreenshot", params)["data"])
    if path:
        pathlib.Path(path).write_bytes(data)
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("-o", "--out", default="out.mp4")
    ap.add_argument("--fps", type=float)
    ap.add_argument("--duration", type=float)
    ap.add_argument("--width", type=int)
    ap.add_argument("--height", type=int)
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--end", type=float)
    ap.add_argument("--audio", help="music/voice file to mux under the video")
    ap.add_argument("--audio-offset", type=float, default=0.0, help="seconds into the audio file to start from")
    ap.add_argument("--crf", type=int, default=20)
    ap.add_argument("--preset", default="medium", help="x264 preset; use veryfast for drafts")
    ap.add_argument("--png", action="store_true", help="lossless frames (slower, use for gradients/dark scenes)")
    ap.add_argument("--stills", help="comma-separated times; writes PNGs to --outdir and exits")
    ap.add_argument("--sheet", type=int, help="write a contact sheet of N evenly spaced frames to --outdir")
    ap.add_argument("--outdir", default="shots")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH")

    with sync_playwright() as p:
        browser, page, comp, w, h = open_page(p, args.html, args)
        fps = args.fps or comp["fps"]
        dur = args.duration or comp["duration"]
        end = min(args.end if args.end is not None else dur, dur)

        if args.stills or args.sheet:
            out = pathlib.Path(args.outdir); out.mkdir(parents=True, exist_ok=True)
            if args.stills:
                for s in args.stills.split(","):
                    t = float(s); f = out / f"still_{t:06.2f}s.png"
                    shoot(page, t, str(f), png=True); print("wrote", f)
            if args.sheet:
                n = args.sheet
                tmp = out / "_sheet"; tmp.mkdir(exist_ok=True)
                for i in range(n):
                    t = (dur - 1 / fps) * i / max(1, n - 1)
                    shoot(page, t, str(tmp / f"f_{i:03d}.png"), png=True)
                cols = 4 if n > 6 else n
                rows = -(-n // cols)
                tile_w = 360 if h >= w else 480
                sheet = out / "contact_sheet.png"
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp / "f_%03d.png"),
                                "-vf", f"scale={tile_w}:-1,drawtext=text='%{{n}}':x=10:y=10:fontsize=28:fontcolor=yellow:box=1:boxcolor=black@0.6,tile={cols}x{rows}:padding=6:color=gray",
                                "-frames:v", "1", str(sheet)], check=True)
                shutil.rmtree(tmp)
                print("wrote", sheet, f"({n} frames, t = 0 → {dur:.2f}s evenly spaced)")
            browser.close(); return

        total = int(round((end - args.start) * fps))
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(fps), "-i", "-"]
        if args.audio:
            cmd += ["-ss", str(args.audio_offset), "-i", args.audio]
        cmd += ["-c:v", "libx264", "-preset", args.preset, "-crf", str(args.crf), "-pix_fmt", "yuv420p",
                "-r", str(fps), "-profile:v", "high"]
        if args.audio:
            fade_st = max(0, (end - args.start) - 0.8)
            cmd += ["-c:a", "aac", "-b:a", "192k", "-af", f"afade=t=out:st={fade_st}:d=0.8", "-shortest"]
        cmd += ["-movflags", "+faststart", args.out]
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        t0 = time.time()
        for i in range(total):
            t = args.start + i / fps
            ff.stdin.write(shoot(page, t, png=args.png))
            if i % max(1, int(fps)) == 0 or i == total - 1:
                el = time.time() - t0
                eta = el / (i + 1) * (total - i - 1)
                print(f"\rframe {i+1}/{total}  t={t:5.2f}s  eta {eta:4.0f}s", end="", flush=True)
        ff.stdin.close(); ff.wait()
        browser.close()
        print(f"\nwrote {args.out}  {w}x{h} @ {fps}fps, {total} frames in {time.time()-t0:.1f}s")
        if ff.returncode != 0:
            sys.exit("ffmpeg failed")


if __name__ == "__main__":
    main()
