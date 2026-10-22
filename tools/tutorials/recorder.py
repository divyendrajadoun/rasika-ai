"""Record how-to videos of the real app: a scripted browser, a visible cursor, narration timed to
what is on screen, captions, and title cards.

A tutorial is a list of scenes. Each scene runs in a fresh page (signed in) and is a sequence of
`say("…")` lines: every line is narrated (Deepgram Aura, cached by text), and the next line waits
until this one has been spoken, so the actions in between happen while it is heard. Frames come
from the Chrome DevTools screencast (sharp 1080p JPEGs, timestamped), so a scene's video and its
narration share one clock. `build()` turns the scenes into one MP4: intro card, scenes (a short
card between them when time is skipped, e.g. while a reel renders), outro card.
"""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "worker"))

from rasika_worker.tts import DeepgramTTS  # noqa: E402

W, H, FPS = 1920, 1080, 30
# the page is laid out at 1280×720 and drawn at 1.5× (the UI reads larger, still sharp at 1080p)
VW, VH, DSF = 1280, 720, 1.5
VOICE = "aura-2-thalia-en"
FONT = ROOT / "packages" / "engine" / "fonts" / "Inter.ttf"
FONT_BOLD = ROOT / "packages" / "engine" / "fonts" / "ArchivoBlack-Regular.ttf"
MAROON, GOLD, IVORY = "0x3B0D14", "0xD4A64A", "0xF4EDE2"


def env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in (ROOT / ".env").read_text(encoding="utf8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def ff(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def duration(p: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return float(out.strip())


class Voice:
    def __init__(self, cache: Path) -> None:
        self.cache = cache
        cache.mkdir(parents=True, exist_ok=True)
        self.tts = DeepgramTTS(env()["DEEPGRAM_API_KEY"], VOICE)

    def line(self, text: str) -> tuple[Path, float]:
        h = hashlib.sha1(f"{VOICE}|{text}".encode()).hexdigest()[:16]
        wav = self.cache / f"{h}.wav"
        if not wav.exists():
            self.tts.speak(text, wav)
        return wav, duration(wav)


# a visible cursor (headless Chrome draws none), a ring on every click, and nothing private on screen
CURSOR_JS = r"""
(() => {
  const boot = () => {
    if (document.getElementById('__cur')) return;
    const st = document.createElement('style');
    st.textContent = `
      nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
      #__cur { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483647;
        pointer-events: none; transform: translate(-3px, -2px); transition: transform .05s; }
      .__ring { position: fixed; z-index: 2147483646; pointer-events: none; width: 16px; height: 16px;
        border-radius: 50%; border: 3px solid #D4A64A; transform: translate(-50%, -50%);
        animation: __ring .6s ease-out forwards; }
      @keyframes __ring { to { width: 64px; height: 64px; opacity: 0; } }`;
    document.documentElement.appendChild(st);
    const c = document.createElement('div');
    c.id = '__cur';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2l7 19 2.6-7.6L20 11z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const xy = window.__curxy || [640, 360];
    c.style.left = xy[0] + 'px'; c.style.top = xy[1] + 'px';
    addEventListener('mousemove', e => { window.__curxy = [e.clientX, e.clientY];
      c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', e => { const r = document.createElement('div'); r.className = '__ring';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700); }, true);
    // the signed-in email in the top bar is the test account's: keep it off the video
    const hide = () => document.querySelectorAll('header span').forEach(s => {
      if (/@/.test(s.textContent || '') && s.children.length === 0) s.style.visibility = 'hidden'; });
    hide(); new MutationObserver(hide).observe(document.documentElement, {subtree: true, childList: true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
"""


@dataclass
class Line:
    text: str
    at: float  # seconds from the scene's start
    wav: Path
    dur: float


@dataclass
class Scene:
    name: str
    frames: list[tuple[float, Path]] = field(default_factory=list)
    lines: list[Line] = field(default_factory=list)
    start: float = 0.0
    end: float = 0.0
    card_before: str | None = None  # e.g. "A few minutes later"


class Recorder:
    """One scene: a signed-in page whose screen is captured while the script runs."""

    def __init__(self, browser: Any, state: Path, out: Path, voice: Voice, scene: Scene) -> None:
        self.voice = voice
        self.scene = scene
        self.dir = out / scene.name
        shutil.rmtree(self.dir, ignore_errors=True)
        self.dir.mkdir(parents=True)
        self.ctx = browser.new_context(
            viewport={"width": VW, "height": VH}, device_scale_factor=DSF, storage_state=str(state)
        )
        self.ctx.add_init_script(CURSOR_JS)
        self.page = self.ctx.new_page()
        self.cdp = self.ctx.new_cdp_session(self.page)
        self.n = 0
        self.deadline = 0.0
        self.mouse = (VW / 2, VH / 2)

        def frame(ev: dict[str, Any]) -> None:
            self.n += 1
            p = self.dir / f"f{self.n:06d}.jpg"
            import base64

            p.write_bytes(base64.b64decode(ev["data"]))
            ts = float(ev["metadata"].get("timestamp") or time.time())
            self.scene.frames.append((ts, p))
            try:
                self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
            except Exception:
                pass

        self.cdp.on("Page.screencastFrame", frame)

    # ── capture ──
    def start(self) -> None:
        self.cdp.send(
            "Page.startScreencast",
            {"format": "jpeg", "quality": 92, "maxWidth": W, "maxHeight": H, "everyNthFrame": 1},
        )
        self.scene.start = time.time()

    def stop(self, tail: float = 0.8) -> None:
        self.wait_line()
        self.page.wait_for_timeout(int(tail * 1000))
        self.scene.end = time.time()
        self.cdp.send("Page.stopScreencast")
        self.ctx.close()
        save(self.scene, self.dir / "scene.json")


    # ── narration ──
    def say(self, text: str, pause: float = 0.35) -> None:
        """Wait for the previous line to finish, then start this one (actions follow while it plays)."""
        self.wait_line()
        wav, dur = self.voice.line(text)
        at = time.time() - self.scene.start
        self.scene.lines.append(Line(text, at, wav, dur))
        self.deadline = time.time() + dur + pause

    def wait_line(self) -> None:
        left = self.deadline - time.time()
        if left > 0:
            self.page.wait_for_timeout(int(left * 1000))

    # ── the hand ──
    def move(self, locator: Any, steps: int = 28) -> tuple[float, float]:
        locator.scroll_into_view_if_needed()
        self.page.wait_for_timeout(150)
        box = locator.bounding_box()
        if not box:
            raise RuntimeError(f"not visible: {locator}")
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        self.page.mouse.move(self.mouse[0], self.mouse[1])
        self.page.mouse.move(x, y, steps=steps)
        self.mouse = (x, y)
        return x, y

    def click(self, locator: Any, after: float = 0.6) -> None:
        self.move(locator)
        self.page.wait_for_timeout(180)
        self.page.mouse.down()
        self.page.wait_for_timeout(70)
        self.page.mouse.up()
        self.page.wait_for_timeout(int(after * 1000))

    def type(self, locator: Any, text: str, delay: int = 45) -> None:
        self.click(locator, after=0.2)
        locator.press_sequentially(text, delay=delay)
        self.page.wait_for_timeout(300)

    def scroll(self, dy: int, steps: int = 12) -> None:
        for _ in range(steps):
            self.page.mouse.wheel(0, dy / steps)
            self.page.wait_for_timeout(35)
        self.page.wait_for_timeout(400)


def sign_in(browser: Any, base: str, state: Path) -> None:
    """Sign the local test account in once and keep its cookies for every scene."""
    e = env()
    ctx = browser.new_context()
    page = ctx.new_page()
    page.goto(f"{base}/login?mode=password", wait_until="networkidle")
    page.fill("#email", e["RASIKA_TEST_EMAIL"])
    page.fill("#password", e["RASIKA_TEST_PASSWORD"])
    page.get_by_role("button", name="Sign in", exact=True).click()
    page.wait_for_url("**/dashboard**", timeout=60000)
    ctx.storage_state(path=str(state))
    ctx.close()


# ── assembly ──
def _esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace(",", "\\,")


def card(dest: Path, title: str, sub: str, seconds: float) -> None:
    """A maroon title card with the gold rule (Rasika's look)."""
    fb, fr = str(FONT_BOLD).replace("\\", "/").replace(":", "\\:"), str(FONT).replace("\\", "/").replace(":", "\\:")
    vf = (
        f"drawbox=x=(iw-160)/2:y=ih/2+18:w=160:h=4:color={GOLD}:t=fill,"
        f"drawtext=fontfile='{fb}':text='{_esc(title)}':fontsize=84:fontcolor={IVORY}:x=(w-tw)/2:y=h/2-110,"
        f"drawtext=fontfile='{fr}':text='{_esc(sub)}':fontsize=40:fontcolor={GOLD}:x=(w-tw)/2:y=h/2+56,"
        f"fade=t=in:st=0:d=0.4,fade=t=out:st={seconds - 0.4:.2f}:d=0.4"
    )
    ff(
        "-f", "lavfi", "-i", f"color=c={MAROON}:s={W}x{H}:r={FPS}:d={seconds}",
        "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "18", str(dest),
    )


def scene_video(scene: Scene, dest: Path) -> float:
    """Frames → constant-rate video on the scene's own clock (each frame held until the next)."""
    frames = [(t, p) for t, p in scene.frames if t >= scene.start - 0.5]
    if not frames:
        raise RuntimeError(f"scene {scene.name}: no frames")
    lst = dest.with_suffix(".txt")
    rows = []
    first = scene.start
    # hold the first frame from the scene's start
    prev_t, prev_p = first, frames[0][1]
    for t, p in frames[1:]:
        rows.append(f"file '{prev_p.as_posix()}'\nduration {max(0.001, t - prev_t):.4f}")
        prev_t, prev_p = max(t, prev_t), p
    rows.append(f"file '{prev_p.as_posix()}'\nduration {max(0.05, scene.end - prev_t):.4f}")
    rows.append(f"file '{prev_p.as_posix()}'")
    lst.write_text("\n".join(rows) + "\n", encoding="utf8")
    ff(
        "-f", "concat", "-safe", "0", "-i", str(lst),
        # the screen at 1600×900 on the maroon ground, leaving a band below it for the captions
        "-vf",
        f"scale=1600:900:flags=lanczos,pad={W}:{H}:160:22:color={MAROON},fps={FPS},format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", str(dest),
    )
    return duration(dest)


def build(scenes: list[Scene], title: str, sub: str, outro: str, dest: Path, voice: Voice) -> None:
    work = dest.parent / (dest.stem + "_work")
    shutil.rmtree(work, ignore_errors=True)
    if work.exists():  # a file still held open (Windows): build in a fresh folder
        work = dest.parent / f"{dest.stem}_work_{int(time.time())}"
    work.mkdir(parents=True)
    parts: list[Path] = []
    lines: list[tuple[float, Line]] = []  # (absolute start, line)
    clock = 0.0

    intro_line = Line(sub, 0.0, *voice.line(f"{title}. {sub}"))
    intro_len = max(3.2, intro_line.dur + 0.9)
    card(work / "intro.mp4", title, sub, intro_len)
    parts.append(work / "intro.mp4")
    lines.append((0.35, intro_line))
    clock += intro_len

    for i, sc in enumerate(scenes):
        if sc.card_before:
            c = work / f"card{i}.mp4"
            card(c, sc.card_before, "", 1.6)
            parts.append(c)
            clock += 1.6
        v = work / f"scene{i}.mp4"
        length = scene_video(sc, v)
        parts.append(v)
        for ln in sc.lines:
            lines.append((clock + ln.at, ln))
        clock += length

    out_line = Line(outro, 0.0, *voice.line(outro))
    out_len = max(3.5, out_line.dur + 1.2)
    card(work / "outro.mp4", "rasika-ai.netlify.app", "Your first reel is free", out_len)
    parts.append(work / "outro.mp4")
    lines.append((clock + 0.4, out_line))
    total = clock + out_len

    # picture: the parts back to back
    lst = work / "parts.txt"
    lst.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf8")
    pic = work / "picture.mp4"
    ff("-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy", str(pic))

    # sound: every line at its moment over a silent bed of the exact length (input 0)
    ins: list[str] = ["-f", "lavfi", "-t", f"{total:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
    chains: list[str] = ["[0:a]anull[s]"]
    for k, (at, ln) in enumerate(lines, start=1):
        ins += ["-i", str(ln.wav)]
        ms = int(at * 1000)
        chains.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}|{ms}[a{k}]")
    n = len(lines) + 1
    mix = "[s]" + "".join(f"[a{k}]" for k in range(1, n))
    # amix divides by the input count (this ffmpeg has no normalize=0): volume=n undoes it
    graph = ";".join(chains) + f";{mix}amix=inputs={n}:duration=first,volume={n},loudnorm=I=-16:TP=-1.5[a]"
    voice_wav = work / "voice.wav"
    ff(*ins, "-filter_complex", graph, "-map", "[a]", "-ar", "48000", str(voice_wav))

    # captions: each spoken line while it is spoken (not over the title cards' own text)
    def ts(s: float) -> str:
        ms = int(round(s * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"

    srt = work / "captions.srt"
    rows = []
    n = 0
    for at, ln in lines:
        if ln is intro_line or ln is out_line:
            continue
        n += 1
        rows.append(f"{n}\n{ts(at)} --> {ts(at + ln.dur)}\n{ln.text}\n")
    srt.write_text("\n".join(rows), encoding="utf8")
    # in the band under the screen (ASS units: 288 = the frame's height)
    style = (
        "FontName=Inter,FontSize=12,PrimaryColour=&H00E2EDF4,OutlineColour=&H00000000,"
        "BorderStyle=1,Outline=0,Shadow=0,MarginV=7,MarginL=40,MarginR=40,Alignment=2"
    )
    srt_arg = srt.as_posix().replace(":", "\\:")
    fonts = FONT.parent.as_posix().replace(":", "\\:")
    ff(
        "-i", str(pic), "-i", str(voice_wav),
        "-vf", f"subtitles='{srt_arg}':fontsdir='{fonts}':force_style='{style}'",
        "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
        "-shortest", str(dest),
    )
    (work / "lines.json").write_text(
        json.dumps([{"at": round(a, 2), "text": ln.text, "dur": round(ln.dur, 2)} for a, ln in lines], indent=1),
        encoding="utf8",
    )
    print(f"built {dest} · {duration(dest):.1f} s · {len(lines)} lines")


Script = Callable[[Recorder], None]


def save(sc: Scene, path: Path) -> None:
    path.write_text(
        json.dumps(
            {
                "name": sc.name,
                "start": sc.start,
                "end": sc.end,
                "card_before": sc.card_before,
                "frames": [[t, str(p)] for t, p in sc.frames],
                "lines": [[ln.text, ln.at, str(ln.wav), ln.dur] for ln in sc.lines],
            }
        ),
        encoding="utf8",
    )


def load(path: Path) -> Scene:
    d = json.loads(path.read_text(encoding="utf8"))
    sc = Scene(d["name"], card_before=d["card_before"])
    sc.start, sc.end = d["start"], d["end"]
    sc.frames = [(t, Path(p)) for t, p in d["frames"]]
    sc.lines = [Line(t, at, Path(w), dur) for t, at, w, dur in d["lines"]]
    return sc
