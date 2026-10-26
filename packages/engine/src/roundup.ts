/**
 * Roundup films ("From a post"): one designed full-frame scene per item of a pasted list, plus
 * the intro (the hook over a cascade of every item's page) and the outro (the recap). Five art
 * directions share one structure — background, progress, rank, name, takeaway, the item's pages
 * on a moving camera, its number — and differ in everything you see:
 *
 *   signal     dark tech: a scrolling perspective grid, a glow, 3D cards, outlined mono numerals
 *   frontpage  newspaper: paper grain, a masthead, clippings taped down, a red marker stroke
 *   loud       pop: a new colour block per item, a giant numeral, stickers, hard shadows, bounce
 *   keynote    keynote: drifting colour light, glass panels, big rounded screens, slow push-ins
 *   terminal   hacker: scanlines, typed commands, a window that turns from green to full colour
 *
 * Deterministic like the rest of the engine: every value is a pure function of the plan and the
 * time `a` (seconds since the element's t0).
 */
import type { PlanElement } from "@rasika/schema";
import { div, esc, px } from "./dom";
import { E, clamp, lerp, prog } from "./toolkit";
import type { BriefCtx, BriefItem } from "./brief";

type El = Extract<PlanElement, { type: "roundupScene" }>;
type LookId = El["look"];

interface Look {
  bg: string;
  ink: string;
  accent: string;
  muted: string;
  display: string;
  ui: string;
  /** display weight and case */
  weight: number;
  upper: boolean;
  /** letter-spacing of the display face, em */
  track: number;
}

const LOOKS: Record<LookId, Look> = {
  signal: {
    bg: "#06070b",
    ink: "#f3f5f9",
    accent: "#7cf5c4",
    muted: "#7f8896",
    display: "Space Grotesk",
    ui: "JetBrains Mono",
    weight: 700,
    upper: false,
    track: -0.035,
  },
  frontpage: {
    bg: "#f2ede3",
    ink: "#141311",
    accent: "#cf2a1f",
    muted: "#6b645a",
    display: "Playfair Display Roman",
    ui: "IBM Plex Mono",
    weight: 900,
    upper: false,
    track: -0.02,
  },
  loud: {
    bg: "#ffd60a",
    ink: "#0d0d0d",
    accent: "#ffffff",
    muted: "#1d1d1d",
    display: "Archivo Black",
    ui: "Space Grotesk",
    weight: 400,
    upper: true,
    track: -0.01,
  },
  keynote: {
    bg: "#09080d",
    ink: "#ffffff",
    accent: "#ffb36b",
    muted: "#a7a3b2",
    display: "Inter",
    ui: "Inter",
    weight: 650,
    upper: false,
    track: -0.04,
  },
  terminal: {
    bg: "#040704",
    ink: "#c9ffcf",
    accent: "#3dff6e",
    muted: "#5c8a62",
    display: "IBM Plex Mono",
    ui: "IBM Plex Mono",
    weight: 500,
    upper: false,
    track: -0.02,
  },
};

/** loud: a colour block per item (ink stays black on every one) */
const LOUD_BLOCKS = ["#ffd60a", "#ff5c8a", "#5b8cff", "#19d98b", "#ff8a3d", "#c38bff", "#3ee0e8", "#ff4d4d"];

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector(sel) as T | null;
const qa = <T extends Element = HTMLElement>(root: Element, sel: string) => Array.from(root.querySelectorAll(sel)) as T[];
const pad2 = (n: number) => String(n).padStart(2, "0");

function stage(ctx: BriefCtx, t0: number, t1: number, html: string, fn: BriefItem["fn"]): BriefItem {
  const el = div("", { position: "absolute", left: "0", top: "0", width: px(1080), height: px(1920), overflow: "hidden" });
  el.innerHTML = html;
  ctx.fx.appendChild(el);
  return { el, t0, t1, kind: "none", fn };
}

function lookOf(el: El): Look {
  const base = LOOKS[el.look] ?? LOOKS.signal;
  const lk: Look = { ...base };
  if (el.look === "loud" && el.phase === "item") lk.bg = LOUD_BLOCKS[(Math.max(1, el.rank) - 1) % LOUD_BLOCKS.length]!;
  if (el.colors) {
    lk.bg = el.colors.bg;
    lk.ink = el.colors.ink;
    lk.accent = el.colors.accent;
    if (el.colors.muted) lk.muted = el.colors.muted;
  }
  if (el.fonts) {
    lk.display = el.fonts.display;
    lk.ui = el.fonts.ui;
  }
  return lk;
}

/** Font size that keeps `text` on one line inside `width` (an average glyph ≈ `k` em). */
function fit(text: string, max: number, width: number, k: number): number {
  const n = Math.max(1, text.length);
  return Math.round(Math.min(max, width / (n * k)));
}

/** A word split into letters for a staggered entrance. */
function letters(text: string): string {
  return Array.from(text)
    .map((c) => (c === " " ? `<span class="rl" style="display:inline-block;width:.28em"></span>` : `<span class="rl" style="display:inline-block">${esc(c)}</span>`))
    .join("");
}

// ───────────────────────────── backgrounds ─────────────────────────────

const PAPER =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .25 0 0 0 0 .2 0 0 0 .09 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

function background(lk: Look, look: LookId, phase: El["phase"] = "item"): string {
  switch (look) {
    case "signal":
      return `<div style="position:absolute;inset:0;background:${lk.bg}"></div>
<div class="rg-glow" style="position:absolute;left:-200px;top:520px;width:1480px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,${lk.accent}38,transparent 70%);filter:blur(10px)"></div>
<div style="position:absolute;left:-540px;right:-540px;top:1180px;height:1100px;perspective:900px;overflow:hidden">
  <div class="rg-floor" style="position:absolute;inset:0;transform:rotateX(64deg);transform-origin:50% 0;background-image:linear-gradient(${lk.accent}55 2px,transparent 2px),linear-gradient(90deg,${lk.accent}55 2px,transparent 2px);background-size:120px 120px"></div>
</div>
<div style="position:absolute;left:0;right:0;top:1170px;height:200px;background:linear-gradient(${lk.bg},${lk.bg}00)"></div>
<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.018) 0 2px,transparent 2px 5px)"></div>`;
    case "frontpage":
      return `<div style="position:absolute;inset:0;background:${lk.bg}"></div>
<div style="position:absolute;inset:0;background-image:${PAPER};opacity:1"></div>
${phase === "item" ? `<div style="position:absolute;left:60px;right:60px;top:212px;border-top:4px solid ${lk.ink}"></div>
<div style="position:absolute;left:60px;right:60px;top:224px;border-top:1.5px solid ${lk.ink}"></div>
<div style="position:absolute;left:60px;right:60px;top:1470px;border-top:1.5px solid ${lk.ink}66"></div>` : `<div style="position:absolute;left:60px;right:60px;top:170px;border-top:4px solid ${lk.ink}"></div>`}`;
    case "loud":
      return `<div style="position:absolute;inset:0;background:${lk.bg}"></div>
<div style="position:absolute;inset:0;background-image:radial-gradient(${lk.ink}1f 3px,transparent 3.5px);background-size:46px 46px"></div>`;
    case "keynote":
      return `<div style="position:absolute;inset:0;background:${lk.bg}"></div>
<div class="kb kb1" style="position:absolute;width:1100px;height:1100px;border-radius:50%;background:radial-gradient(closest-side,${lk.accent}aa,transparent);filter:blur(60px);opacity:.55"></div>
<div class="kb kb2" style="position:absolute;width:1000px;height:1000px;border-radius:50%;background:radial-gradient(closest-side,#5b7cff99,transparent);filter:blur(60px);opacity:.5"></div>
<div class="kb kb3" style="position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(closest-side,#ff5c8a88,transparent);filter:blur(70px);opacity:.38"></div>`;
    case "terminal":
      return `<div style="position:absolute;inset:0;background:${lk.bg}"></div>
<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,${lk.accent}14,transparent 65%)"></div>
<div style="position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.32) 0 2px,transparent 2px 4px)"></div>
<div style="position:absolute;inset:0;box-shadow:inset 0 0 260px rgba(0,0,0,.85)"></div>`;
  }
}

function animateBackground(node: HTMLElement, look: LookId, a: number, t0: number): void {
  const t = t0 + a; // continuous across scenes: the background never jumps between items
  if (look === "signal") {
    const floor = q(node, ".rg-floor");
    if (floor) floor.style.backgroundPosition = `0 ${(t * 90) % 120}px`;
    const glow = q(node, ".rg-glow");
    if (glow) glow.style.opacity = String(0.75 + 0.25 * Math.sin(t * 1.3));
  } else if (look === "keynote") {
    const pos: Array<[number, number, number, number]> = [
      [-260, 180, 160, 0.21],
      [420, 900, -200, 0.17],
      [80, 1300, 180, 0.25],
    ];
    qa(node, ".kb").forEach((b, i) => {
      const [x, y, r, w] = pos[i]!;
      b.style.transform = `translate(${x + r * Math.sin(t * w + i)}px,${y + r * Math.cos(t * w * 1.3 + i * 2)}px)`;
    });
  }
}

// ───────────────────────────── the item scene ─────────────────────────────

const CARD = { x: 60, y: 640, w: 960, h: 690 };

function progressHtml(el: El, lk: Look): string {
  const segs = Array.from({ length: el.total }, (_, i) => {
    const on = i + 1 < el.rank ? 1 : 0;
    return `<div style="flex:1;height:8px;border-radius:4px;background:${lk.ink}26;overflow:hidden"><i class="rp${i + 1 === el.rank ? " now" : ""}" style="display:block;height:100%;width:${on * 100}%;background:${el.look === "loud" ? lk.ink : lk.accent};border-radius:4px"></i></div>`;
  }).join("");
  return `<div style="position:absolute;left:60px;right:60px;top:${el.look === "frontpage" ? 1500 : 92}px;display:flex;gap:10px">${segs}</div>`;
}

function shotsHtml(el: El, ctx: BriefCtx, lk: Look): string {
  const imgs = el.shots
    .map((s, i) => {
      const src = ctx.images[s.imageId] ?? "";
      const fitMode = s.kind === "picture" ? "contain" : "cover";
      const pos = s.kind === "picture" ? "50% 50%" : "50% 0%";
      const bg = s.kind === "picture" ? (el.look === "frontpage" ? "#fff" : lk.bg) : "#fff";
      return `<div class="rs" data-i="${i}" style="position:absolute;inset:0;opacity:${i ? 0 : 1};background:${bg}"><img src="${esc(src)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:${fitMode};object-position:${pos};transform-origin:50% 0" alt=""></div>`;
    })
    .join("");
  const chrome = (inner: string, radius: number, extra: string) =>
    `<div class="rc" style="position:absolute;left:${CARD.x}px;top:${CARD.y}px;width:${CARD.w}px;height:${CARD.h}px;border-radius:${radius}px;overflow:hidden;${extra}">${inner}</div>`;
  switch (el.look) {
    case "signal":
      return `<div class="rcw" style="position:absolute;inset:0;perspective:1800px">${chrome(
        `<div style="position:absolute;left:0;right:0;top:0;height:46px;background:#14161c;display:flex;align-items:center;gap:9px;padding:0 18px;z-index:2"><i style="width:12px;height:12px;border-radius:50%;background:#ff5f57"></i><i style="width:12px;height:12px;border-radius:50%;background:#febc2e"></i><i style="width:12px;height:12px;border-radius:50%;background:#28c840"></i><span style="margin-left:14px;font:500 20px/1 '${lk.ui}',monospace;color:${lk.muted}">${esc(el.url)}</span></div><div style="position:absolute;left:0;right:0;top:46px;bottom:0">${imgs}</div>`,
        22,
        `border:2px solid ${lk.accent}66;box-shadow:0 0 0 1px #000,0 0 80px ${lk.accent}40,0 60px 120px rgba(0,0,0,.7);transform-style:preserve-3d`,
      )}</div>`;
    case "frontpage":
      return `<div class="rcw" style="position:absolute;inset:0">${chrome(
        `<div style="position:absolute;inset:18px 18px 64px 18px;overflow:hidden">${imgs}</div><div style="position:absolute;left:24px;right:24px;bottom:18px;font:500 22px/1.2 '${lk.ui}',monospace;color:${lk.muted};text-align:left">Fig. ${el.rank} — ${esc(el.url)}</div>`,
        3,
        `background:#fffdf8;box-shadow:0 2px 0 rgba(0,0,0,.08),0 40px 70px -20px rgba(40,25,10,.45)`,
      )}<div style="position:absolute;left:${CARD.x + CARD.w / 2 - 110}px;top:${CARD.y - 26}px;width:220px;height:58px;background:rgba(240,222,170,.72);transform:rotate(-4deg);box-shadow:0 2px 6px rgba(0,0,0,.08)"></div></div>`;
    case "loud":
      return `<div class="rcw" style="position:absolute;inset:0">${chrome(imgs, 26, `border:9px solid ${lk.ink};box-shadow:22px 22px 0 ${lk.ink};background:#fff`)}</div>`;
    case "keynote":
      return `<div class="rcw" style="position:absolute;inset:0">${chrome(
        imgs,
        44,
        `box-shadow:0 0 0 1.5px rgba(255,255,255,.22),0 50px 120px rgba(0,0,0,.6)`,
      )}</div>`;
    case "terminal":
      return `<div class="rcw" style="position:absolute;inset:0">${chrome(
        `<div style="position:absolute;left:0;right:0;top:0;height:48px;background:#0b140b;border-bottom:2px solid ${lk.accent}55;display:flex;align-items:center;padding:0 20px;font:500 22px/1 '${lk.ui}',monospace;color:${lk.accent}">~/${esc(el.url.split("/").slice(-1)[0] || "page")} — preview</div><div class="rterm" style="position:absolute;left:0;right:0;top:48px;bottom:0">${imgs}</div>`,
        8,
        `border:2px solid ${lk.accent}88;box-shadow:0 0 60px ${lk.accent}30;background:#000`,
      )}</div>`;
  }
}

function itemScene(el: El, ctx: BriefCtx): BriefItem[] {
  const lk = lookOf(el);
  const life = Math.max(0.5, el.t1 - el.t0 + el.offset);
  const name = lk.upper ? el.name.toUpperCase() : el.name;
  const dsize = fit(name, el.look === "terminal" ? 84 : 118, el.look === "loud" ? 860 : 940, el.look === "terminal" ? 0.62 : lk.upper ? 0.7 : 0.55);
  const nameTop = el.look === "frontpage" ? 300 : 186;
  const rankHtml = (() => {
    switch (el.look) {
      case "signal":
        return `<div class="rr" style="position:absolute;right:36px;top:250px;font:800 360px/1 '${lk.ui}',monospace;color:transparent;-webkit-text-stroke:3px ${lk.accent}66;letter-spacing:-.06em">${pad2(el.rank)}</div>`;
      case "frontpage":
        return `<div style="position:absolute;left:60px;right:60px;top:120px;display:flex;justify-content:space-between;align-items:baseline;font:900 64px/1 '${lk.display}',serif;color:${lk.ink}"><span>The Daily List</span><span class="rr" style="font:500 26px/1 '${lk.ui}',monospace;color:${lk.accent};letter-spacing:.12em">No. ${el.rank} OF ${el.total}</span></div>`;
      case "loud":
        return `<div class="rr" style="position:absolute;right:-40px;top:-60px;font:400 900px/1 '${lk.display}',sans-serif;color:${lk.ink};opacity:.12;letter-spacing:-.05em">${el.rank}</div>`;
      case "keynote":
        return `<div class="rr" style="position:absolute;left:60px;top:132px;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.22);font:600 26px/1 '${lk.ui}',sans-serif;color:${lk.ink};letter-spacing:.02em">${el.rank} of ${el.total}</div>`;
      case "terminal":
        return `<div class="rr" style="position:absolute;left:60px;top:132px;font:500 30px/1 '${lk.ui}',monospace;color:${lk.muted}">$ rasika top --rank <span style="color:${lk.accent}">${el.rank}</span></div>`;
    }
  })();
  const nameStyle = (() => {
    switch (el.look) {
      case "loud":
        return `display:inline-block;padding:14px 26px 6px;background:${lk.ink};color:${lk.bg};transform:rotate(-2.5deg);box-shadow:10px 10px 0 rgba(0,0,0,.25)`;
      case "terminal":
        return `color:${lk.accent};text-shadow:0 0 18px ${lk.accent}88`;
      default:
        return `color:${lk.ink}`;
    }
  })();
  const nameTopFinal = el.look === "loud" ? 230 : el.look === "terminal" ? 196 : el.look === "keynote" ? 214 : nameTop;
  const lineTop = nameTopFinal + dsize * 1.12 + (el.look === "loud" ? 40 : 18);
  const lineHtml = el.line
    ? (() => {
        switch (el.look) {
          case "signal":
            return `<div class="rli" style="position:absolute;left:60px;right:60px;top:${lineTop}px;font:500 30px/1.25 '${lk.ui}',monospace;color:${lk.accent};letter-spacing:.06em;text-transform:uppercase">// ${esc(el.line)}</div>`;
          case "frontpage":
            return `<div class="rli" style="position:absolute;left:60px;right:60px;top:${lineTop}px;font:italic 400 50px/1.15 'Instrument Serif',serif;color:${lk.ink}"><span style="position:relative">${esc(el.line)}<i class="rmark" style="position:absolute;left:-4px;bottom:2px;height:16px;width:0;background:${lk.accent};opacity:.85;z-index:-1;border-radius:3px"></i></span></div>`;
          case "loud":
            return `<div class="rli" style="position:absolute;left:60px;right:60px;top:${lineTop}px;font:700 42px/1.15 '${lk.ui}',sans-serif;color:${lk.ink}">${esc(el.line)}</div>`;
          case "keynote":
            return `<div class="rli" style="position:absolute;left:60px;right:60px;top:${lineTop}px;font:500 42px/1.2 '${lk.ui}',sans-serif;color:${lk.muted};letter-spacing:-.01em">${esc(el.line)}</div>`;
          case "terminal":
            return `<div class="rli" style="position:absolute;left:60px;right:60px;top:${lineTop}px;font:500 32px/1.3 '${lk.ui}',monospace;color:${lk.ink}" data-full="${esc("> " + el.line)}"></div>`;
        }
      })()
    : "";
  const statHtml = el.stat
    ? (() => {
        const pill = {
          signal: `background:${lk.accent};color:#03140d`,
          frontpage: `background:${lk.ink};color:${lk.bg}`,
          loud: `background:${lk.ink};color:${lk.bg};box-shadow:8px 8px 0 rgba(0,0,0,.25)`,
          keynote: `background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:${lk.ink}`,
          terminal: `background:#0b140b;border:2px solid ${lk.accent};color:${lk.accent}`,
        }[el.look];
        return `<div class="rst" style="position:absolute;left:0;right:0;top:${CARD.y + CARD.h + 52}px;display:flex;justify-content:center;opacity:0"><div style="display:flex;align-items:baseline;gap:16px;padding:18px 34px;border-radius:${el.look === "frontpage" || el.look === "terminal" ? 6 : 999}px;${pill}"><span class="rsv" style="font:800 72px/1 '${el.look === "terminal" || el.look === "signal" ? lk.ui : lk.display}',sans-serif;letter-spacing:-.02em">0</span><span style="font:600 28px/1 '${lk.ui}',sans-serif;letter-spacing:.08em;text-transform:uppercase">${esc(el.stat.label)}</span></div></div>`;
      })()
    : "";
  const html = `${background(lk, el.look)}
${rankHtml}
${progressHtml(el, lk)}
<div class="rn" style="position:absolute;left:60px;right:40px;top:${nameTopFinal}px;font:${lk.weight} ${dsize}px/1.02 '${lk.display}',sans-serif;letter-spacing:${lk.track}em;white-space:nowrap"><span style="${nameStyle}">${el.look === "terminal" ? `<span class="rtyped"></span><span class="rcar" style="display:inline-block;width:.55em;height:.9em;background:${lk.accent};vertical-align:-.08em;margin-left:4px"></span>` : letters(name)}</span></div>
${lineHtml}
${shotsHtml(el, ctx, lk)}
${statHtml}`;

  const shotAt = el.shots.map((s) => s.at);
  return [
    stage(ctx, el.t0, el.t1, html, (node, a0) => {
      const a = a0 + el.offset; // a resumed scene carries on where it left off
      animateBackground(node, el.look, a0, el.t0);
      const pin = el.offset ? 1 : prog(a, 0, 0.55, E.outQuint); // the scene arriving
      const pout = 0; // the next scene arrives over this one (the plan overlaps them)
      // the whole scene's entrance and exit, per look
      if (el.look === "signal") {
        node.style.clipPath = `inset(0 ${(1 - pin) * 100}% 0 0)`;
        node.style.opacity = String(1 - pout);
      } else if (el.look === "frontpage") {
        node.style.transform = `translateX(${(1 - pin) * 1080}px) rotate(${(1 - pin) * 4}deg)`;
        node.style.opacity = String(1 - pout * 0.6);
      } else if (el.look === "loud") {
        const s = lerp(0.6, 1, E.outBack(clamp(a / 0.45)));
        node.style.transform = `scale(${s})`;
        node.style.clipPath = `circle(${pin * 150}% at 50% 40%)`;
      } else if (el.look === "keynote") {
        node.style.opacity = String(Math.min(pin, 1 - pout));
        node.style.filter = pin < 1 ? `blur(${(1 - pin) * 18}px)` : "";
      } else {
        node.style.clipPath = `inset(0 0 ${(1 - pin) * 100}% 0)`;
      }

      // progress: the current segment fills over the item's life
      const now = q(node, ".rp.now");
      if (now) now.style.width = `${clamp(a / life) * 100}%`;
      // the rank drifts
      const rr = q(node, ".rr");
      if (rr) {
        if (el.look === "signal") rr.style.transform = `translateY(${-a * 14}px)`;
        if (el.look === "loud") rr.style.transform = `translate(${-a * 10}px,${a * 6}px) rotate(${-4 + a * 0.6}deg)`;
      }
      // the name: letters rise in (terminal types it)
      if (el.look === "terminal") {
        const typed = q(node, ".rtyped");
        const nch = Math.floor(clamp((a - 0.25) / 0.9) * name.length);
        if (typed) typed.textContent = name.slice(0, nch);
        const car = q(node, ".rcar");
        if (car) car.style.opacity = Math.floor(a * 2.4) % 2 ? "0" : "1";
        const li = q(node, ".rli");
        if (li) {
          const full = li.dataset.full ?? "";
          li.textContent = full.slice(0, Math.floor(clamp((a - 1.0) / 1.2) * full.length));
        }
      } else {
        qa(node, ".rl").forEach((c, i) => {
          const p = prog(a, 0.12 + i * 0.028, 0.62 + i * 0.028, el.look === "loud" ? E.outBack : E.outQuint);
          c.style.transform = `translateY(${(1 - p) * 70}%)`;
          c.style.opacity = String(p);
        });
        const li = q(node, ".rli");
        if (li) {
          const p = prog(a, 0.45, 1.0, E.outQuint);
          li.style.opacity = String(p);
          li.style.transform = `translateY(${(1 - p) * 24}px)`;
        }
        const mark = q(node, ".rmark");
        if (mark) mark.style.width = `calc(${prog(a, 0.9, 1.6, E.inOutCubic) * 100}% + 8px)`;
      }
      // the card: per-look camera
      const card = q(node, ".rc");
      if (card) {
        const pc = prog(a, 0.15, 0.95, el.look === "loud" ? E.outBack : E.outQuint);
        let tf = "";
        if (el.look === "signal") {
          const ry = lerp(-26, -7, pc) + 2.5 * Math.sin(a * 0.7);
          const rx = lerp(12, 4, pc) + 1.2 * Math.sin(a * 0.5 + 1);
          tf = `translateX(${(1 - pc) * 420}px) rotateY(${ry}deg) rotateX(${rx}deg) translateY(${-a * 4}px)`;
        } else if (el.look === "frontpage") {
          tf = `translateY(${(1 - pc) * 900}px) rotate(${lerp(-9, -1.8, pc)}deg) scale(${1 + a * 0.004})`;
        } else if (el.look === "loud") {
          tf = `scale(${Math.max(0.01, pc)}) rotate(${lerp(-12, 2.5, pc)}deg)`;
        } else if (el.look === "keynote") {
          tf = `translateY(${(1 - pc) * 160}px) scale(${lerp(0.9, 1, pc) + a * 0.006})`;
        } else {
          tf = `translateY(${(1 - pc) * 60}px)`;
          card.style.opacity = String(pc);
        }
        card.style.transform = tf;
      }
      // the shots: each takes over at its time; the camera drifts down the page
      qa(node, ".rs").forEach((s, i) => {
        const at = shotAt[i] ?? 0;
        const next = shotAt[i + 1] ?? Infinity;
        const pi = i === 0 ? 1 : prog(a, at, at + 0.45, E.outCubic);
        const po = next === Infinity ? 0 : prog(a, next, next + 0.45, E.outCubic);
        s.style.opacity = String(Math.min(pi, 1 - po));
        s.style.transform = i === 0 ? "" : `translateX(${(1 - pi) * 120}px)`;
        const img = s.querySelector("img") as HTMLImageElement | null;
        if (img) {
          const local = Math.max(0, a - (i === 0 ? 0 : at));
          const page = el.shots[i]?.kind !== "picture";
          img.style.transform = page
            ? `scale(${1.04 + local * 0.012}) translateY(${-local * 9}px)`
            : `scale(${1 + local * 0.01})`;
        }
      });
      if (el.look === "terminal") {
        // the preview arrives green and resolves into its real colours
        const pc = prog(a, 0.6, 1.8, E.inOutCubic);
        const term = q(node, ".rterm");
        if (term) term.style.filter = `grayscale(${1 - pc}) sepia(${(1 - pc) * 0.9}) hue-rotate(${(1 - pc) * 70}deg) saturate(${1 + (1 - pc) * 2})`;
      }
      // the number counts up on the spoken word
      const st = q(node, ".rst");
      if (st && el.stat) {
        const p = prog(a, el.stat.at, el.stat.at + 0.35, E.outBack);
        st.style.opacity = String(clamp(p * 1.5));
        st.style.transform = `translateY(${(1 - p) * 40}px) scale(${lerp(0.85, 1, p)})`;
        const v = q(node, ".rsv");
        if (v) v.textContent = String(Math.round(lerp(0, el.stat.value, prog(a, el.stat.at, el.stat.at + 1.2, E.outQuint))));
      }
    }),
  ];
}

// ───────────────────────────── intro and outro ─────────────────────────────

function introScene(el: El, ctx: BriefCtx): BriefItem[] {
  const lk = lookOf(el);
  const life = Math.max(0.5, el.t1 - el.t0);
  const hook = lk.upper ? el.hook.toUpperCase() : el.hook;
  const words = hook.split(/\s+/).filter(Boolean);
  const size = fit(hook, 128, 1900, lk.upper ? 0.62 : 0.52); // two lines of ~950px
  const thumbs = el.thumbs
    .map((id, i) => `<div class="it" data-i="${i}" style="position:absolute;left:190px;top:820px;width:700px;height:500px;border-radius:${el.look === "frontpage" ? 3 : 22}px;overflow:hidden;opacity:0;${el.look === "loud" ? `border:7px solid ${lk.ink};box-shadow:14px 14px 0 ${lk.ink}` : el.look === "frontpage" ? "border:12px solid #fffdf8;box-shadow:0 30px 60px -20px rgba(40,25,10,.5)" : `box-shadow:0 0 0 1.5px ${lk.accent}55,0 40px 90px rgba(0,0,0,.6)`};background:#fff"><img src="${esc(ctx.images[id] ?? "")}" style="width:100%;height:100%;object-fit:cover;object-position:50% 0" alt=""></div>`)
    .join("");
  const kicker = {
    signal: `// TODAY · ${el.total} PICKS`,
    frontpage: `TODAY'S EDITION · ${el.total} STORIES`,
    loud: `TODAY'S TOP ${el.total}`,
    keynote: `Today · ${el.total} picks`,
    terminal: `$ rasika top --today --n ${el.total}`,
  }[el.look];
  const html = `${background(lk, el.look, "intro")}
<div class="ik" style="position:absolute;left:60px;right:60px;top:200px;font:600 30px/1 '${lk.ui}',monospace;color:${el.look === "loud" ? lk.ink : lk.accent};letter-spacing:.1em;opacity:0">${esc(kicker)}</div>
<div style="position:absolute;left:60px;right:60px;top:268px;font:${lk.weight} ${size}px/1.04 '${lk.display}',sans-serif;letter-spacing:${lk.track}em;color:${el.look === "terminal" ? lk.accent : lk.ink}">${words.map((w) => `<span class="iw" style="display:inline-block;margin-right:.26em;opacity:0">${esc(w)}</span>`).join("")}</div>
${thumbs}`;
  const n = Math.max(1, el.thumbs.length);
  return [
    stage(ctx, el.t0, el.t1, html, (node, a) => {
      animateBackground(node, el.look, a, el.t0);
      const k = q(node, ".ik");
      if (k) k.style.opacity = String(prog(a, 0, 0.4));
      qa(node, ".iw").forEach((w, i) => {
        const p = prog(a, 0.08 + i * 0.07, 0.5 + i * 0.07, el.look === "loud" ? E.outBack : E.outQuint);
        w.style.opacity = String(clamp(p * 1.4));
        w.style.transform = `translateY(${(1 - p) * 50}px)`;
        w.style.filter = el.look === "keynote" && p < 1 ? `blur(${(1 - p) * 10}px)` : "";
      });
      // every item's page lands on the stack, one after another, fanned out
      const span = Math.max(0.5, life - 0.9);
      qa(node, ".it").forEach((c, i) => {
        const at = 0.6 + (i * span) / n;
        const p = prog(a, at, at + 0.5, el.look === "loud" ? E.outBack : E.outQuint);
        const fan = (i - (n - 1) / 2) * 7;
        const dx = (i - (n - 1) / 2) * 34;
        c.style.opacity = String(clamp(p * 2));
        c.style.transform = `translate(${dx + (1 - p) * (i % 2 ? 700 : -700)}px,${(1 - p) * 260 + i * 10}px) rotate(${fan * p + (1 - p) * (i % 2 ? 30 : -30)}deg) scale(${lerp(1.15, 1, p)})`;
        c.style.zIndex = String(i + 1);
      });
    }),
  ];
}

function outroScene(el: El, ctx: BriefCtx): BriefItem[] {
  const lk = lookOf(el);
  const close = lk.upper ? el.hook.toUpperCase() : el.hook;
  const size = fit(close, 104, 1900, lk.upper ? 0.62 : 0.52);
  const n = el.names.length;
  const rowH = Math.min(150, Math.floor(980 / Math.max(1, n)));
  const rows = el.names
    .map((name, i) => {
      const thumb = el.thumbs[i] ? `<div style="flex:none;width:${rowH * 1.5}px;height:${rowH - 22}px;border-radius:${el.look === "frontpage" ? 2 : 12}px;overflow:hidden;background:#fff;${el.look === "loud" ? `border:4px solid ${lk.ink}` : ""}"><img src="${esc(ctx.images[el.thumbs[i]!] ?? "")}" style="width:100%;height:100%;object-fit:cover;object-position:50% 0" alt=""></div>` : "";
      const num = `<span style="flex:none;width:96px;font:700 ${Math.min(56, rowH * 0.45)}px/1 '${lk.ui}',monospace;color:${el.look === "loud" ? lk.ink : lk.accent}">${pad2(i + 1)}</span>`;
      return `<div class="or" data-i="${i}" style="display:flex;align-items:center;gap:26px;height:${rowH}px;border-bottom:${el.look === "frontpage" ? `1.5px solid ${lk.ink}44` : `1px solid ${lk.ink}22`};opacity:0">${num}${thumb}<span style="font:${lk.weight} ${Math.min(58, rowH * 0.42)}px/1.05 '${lk.display}',sans-serif;letter-spacing:${lk.track}em;color:${el.look === "terminal" ? lk.accent : lk.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(lk.upper ? name.toUpperCase() : name)}</span></div>`;
    })
    .join("");
  const html = `${background(lk, el.look, "outro")}
<div class="oc" style="position:absolute;left:60px;right:60px;top:200px;font:${lk.weight} ${size}px/1.05 '${lk.display}',sans-serif;letter-spacing:${lk.track}em;color:${el.look === "terminal" ? lk.accent : lk.ink};opacity:0">${esc(close)}</div>
<div style="position:absolute;left:60px;right:60px;top:${200 + size * 2.3}px">${rows}</div>`;
  return [
    stage(ctx, el.t0, el.t1, html, (node, a) => {
      animateBackground(node, el.look, a, el.t0);
      node.style.opacity = String(prog(a, 0, 0.4));
      const c = q(node, ".oc");
      if (c) {
        const p = prog(a, 0.05, 0.6, E.outQuint);
        c.style.opacity = String(p);
        c.style.transform = `translateY(${(1 - p) * 40}px)`;
      }
      qa(node, ".or").forEach((r, i) => {
        const p = prog(a, 0.5 + i * 0.12, 0.95 + i * 0.12, E.outQuint);
        r.style.opacity = String(p);
        r.style.transform = `translateX(${(1 - p) * 80}px)`;
      });
    }),
  ];
}

export function roundupScene(el: El, ctx: BriefCtx): BriefItem[] {
  if (el.phase === "intro") return introScene(el, ctx);
  if (el.phase === "outro") return outroScene(el, ctx);
  return itemScene(el, ctx);
}
