/**
 * Elements for product films (made from a website or a brief): a screen-studio zoom with a real
 * cursor, the through-line object that carries from scene to scene, a 3D fly-over of a landing
 * page, and an explanation built as one diagram the camera moves through.
 *
 * Deterministic like the rest of the engine: every value is a pure function of the plan and the
 * time `a` (seconds since the element's t0); nothing is carried between frames.
 */
import type { PlanElement } from "@rasika/schema";
import { div, esc, px, rgba } from "./dom";
import type { BriefCtx, BriefItem } from "./brief";
import { E, clamp, lerp, prog } from "./toolkit";

type El<T extends PlanElement["type"]> = Extract<PlanElement, { type: T }>;

function stage(ctx: BriefCtx, t0: number, t1: number, html: string, kind: BriefItem["kind"], fn?: BriefItem["fn"]): BriefItem {
  const el = div("", { position: "absolute", left: "0", top: "0", width: px(1080), height: px(1920) });
  el.innerHTML = html;
  ctx.fx.appendChild(el);
  return { el, t0, t1, kind, fn };
}
const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector(sel) as T | null;
const qa = <T extends Element = HTMLElement>(root: Element, sel: string) => Array.from(root.querySelectorAll(sel)) as T[];
const inkOn = (ctx: BriefCtx) => (ctx.dark ? ctx.C.iv : ctx.C.ink);

/** A spring with at most a small overshoot (~3 %), as a function of normalised time. */
export const spring = (p: number): number => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.exp(-6.5 * p) * (Math.cos(7.5 * p) + (6.5 / 7.5) * Math.sin(7.5 * p));
};
const sp = (a: number, from: number, dur: number) => spring(clamp((a - from) / dur));

function mixHex(a: string, b: string, p: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, p));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ───────────────────────────── screenFocus ─────────────────────────────

interface Cam {
  s: number;
  tx: number;
  ty: number;
}

export function screenFocus(el: El<"screenFocus">, ctx: BriefCtx): BriefItem[] {
  const src = ctx.images[el.imageId] ?? "";
  const bar = el.url ? 56 : 0;
  const W = el.w;
  const H = el.h;
  const html = `<div class="sf" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${W}px;border-radius:22px;overflow:hidden;background:#fff;box-shadow:0 40px 90px rgba(0,0,0,.30)">
  ${
    el.url
      ? `<div style="height:${bar}px;background:#eef0f3;display:flex;align-items:center;gap:10px;padding:0 22px"><i style="width:15px;height:15px;border-radius:50%;background:#ff5f57"></i><i style="width:15px;height:15px;border-radius:50%;background:#febc2e"></i><i style="width:15px;height:15px;border-radius:50%;background:#28c840"></i><div style="flex:1;margin-left:14px;height:34px;border-radius:17px;background:#fff;display:flex;align-items:center;justify-content:center;font:500 22px/1 Inter,sans-serif;color:#4a4f57">${esc(el.url)}</div></div>`
      : ""
  }
  <div class="sf-view" style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#fff">
    <img src="${src}" alt="" style="position:absolute;left:0;top:0;transform-origin:0 0;max-width:none">
    <div class="sf-ring" style="position:absolute;left:0;top:0;width:90px;height:90px;margin:-45px 0 0 -45px;border-radius:50%;border:5px solid rgba(20,20,30,.55);opacity:0"></div>
    <svg class="sf-cur" width="46" height="46" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;margin:-4px 0 0 -6px;overflow:visible;filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));opacity:0"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.5 L14.4 20.3 L11.4 13.7 L17.6 13.7 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>
  </div>
</div>`;
  const camFor = (b: { x: number; y: number; w: number; h: number }): Cam => {
    const s = Math.min(W / b.w, H / b.h);
    return { s, tx: W / 2 - (b.x + b.w / 2) * s, ty: H / 2 - (b.y + b.h / 2) * s };
  };
  const ZOOM = 0.7; // seconds a zoom takes
  // the camera at time a: a spring (log scale) from where the last step ended, then a slow push
  const pushOf = (i: number, a: number) => {
    const st = el.steps[i]!;
    const end = el.steps[i + 1]?.at ?? el.t1 - el.t0;
    return lerp(1, 1.04, prog(a, st.at + ZOOM, Math.max(st.at + ZOOM + 0.01, end)));
  };
  const pushed = (c: Cam, k: number): Cam => ({ s: c.s * k, tx: W / 2 - (W / 2 - c.tx) * k, ty: H / 2 - (H / 2 - c.ty) * k });
  const camAt = (a: number): Cam => {
    let i = 0;
    while (i + 1 < el.steps.length && el.steps[i + 1]!.at <= a) i++;
    const st = el.steps[i]!;
    const target = camFor(st.box);
    if (i === 0 && a < st.at + ZOOM) return pushed(target, 1);
    const from = i === 0 ? target : pushed(camFor(el.steps[i - 1]!.box), pushOf(i - 1, st.at));
    const p = sp(a, st.at, ZOOM);
    const s = Math.exp(lerp(Math.log(from.s), Math.log(target.s), p));
    // keep the zoom about the moving centre so the move reads as one push, not a slide
    const cx = lerp((W / 2 - from.tx) / from.s, (W / 2 - target.tx) / target.s, p);
    const cy = lerp((H / 2 - from.ty) / from.s, (H / 2 - target.ty) / target.s, p);
    const c = { s, tx: W / 2 - cx * s, ty: H / 2 - cy * s };
    return pushed(c, pushOf(i, a));
  };
  const cursorAt = (a: number) => {
    let last: { x: number; y: number } | null = null;
    let prev: { x: number; y: number } | null = null;
    let since = -1;
    let click = false;
    for (const st of el.steps) {
      if (st.at > a) break;
      if (st.cursor) {
        prev = last;
        last = st.cursor;
        since = a - st.at;
        click = st.click;
      }
    }
    if (!last) return null;
    const p = prog(since, 0.15, 0.75, E.inOutCubic);
    const from = prev ?? { x: last.x - 160, y: last.y + 220 };
    return { x: lerp(from.x, last.x, p), y: lerp(from.y, last.y, p), since, click, first: !prev };
  };
  return [
    stage(ctx, el.t0, el.t1, html, "pop", (node, a) => {
      const img = q<HTMLImageElement>(node, ".sf-view img");
      if (!img) return;
      const c = camAt(a);
      img.style.transform = `translate(${c.tx}px, ${c.ty}px) scale(${c.s})`;
      // a fast move blurs a little along the way, never at rest
      const moving = el.steps.some((st, i) => i > 0 && a > st.at && a < st.at + ZOOM);
      img.style.filter = moving ? `blur(${(1.6 * Math.sin(Math.PI * clamp((a - (el.steps.find((st) => a > st.at && a < st.at + ZOOM)?.at ?? a)) / ZOOM))).toFixed(2)}px)` : "none";
      const cur = q(node, ".sf-cur");
      const ring = q(node, ".sf-ring");
      const k = cursorAt(a);
      if (cur && ring) {
        if (!k) {
          cur.style.opacity = "0";
          ring.style.opacity = "0";
        } else {
          const sx = c.tx + k.x * c.s;
          const sy = c.ty + k.y * c.s;
          const press = k.click ? 1 - 0.14 * Math.sin(Math.PI * clamp((k.since - 0.8) / 0.18)) : 1;
          cur.style.opacity = String(k.first ? prog(k.since, 0, 0.2) : 1);
          cur.style.transform = `translate(${sx}px, ${sy}px) scale(${press})`;
          const r = k.click ? clamp((k.since - 0.85) / 0.45) : 0;
          ring.style.opacity = String(r > 0 && r < 1 ? 1 - r : 0);
          ring.style.transform = `translate(${sx}px, ${sy}px) scale(${0.3 + r * 1.1})`;
        }
      }
    }),
  ];
}

// ───────────────────────────── throughLine ─────────────────────────────

export function throughLine(el: El<"throughLine">, ctx: BriefCtx): BriefItem[] {
  const MORPH = 0.55;
  const html = `<div class="tl" style="position:absolute;left:0;top:0;overflow:hidden;display:flex;align-items:center;justify-content:center;transform-origin:50% 50%">
    ${el.keys.map((k, i) => (k.imageId ? `<img class="tl-img" data-i="${i}" src="${ctx.images[k.imageId] ?? ""}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0">` : "")).join("")}
    <span class="tl-txt in" style="position:relative;white-space:nowrap;font-weight:600;letter-spacing:-.01em"></span>
  </div>`;
  return [
    stage(ctx, el.t0, el.t1, html, "none", (node, a) => {
      const box = q(node, ".tl");
      if (!box) return;
      const ks = el.keys;
      let i = 0;
      while (i + 1 < ks.length && ks[i + 1]!.at - MORPH <= a) i++;
      const cur = ks[i]!;
      const nxt = ks[i + 1];
      const p = nxt && a > nxt.at - MORPH ? sp(a, nxt.at - MORPH, MORPH) : 0;
      const k = (f: "x" | "y" | "w" | "h" | "radius") => (nxt ? lerp(cur[f], nxt[f], p) : cur[f]);
      // nothing appears from nothing: it grows out of its first key
      const grow = sp(a, ks[0]!.at, 0.45);
      const w = k("w");
      const h = k("h");
      box.style.width = `${w}px`;
      box.style.height = `${h}px`;
      box.style.borderRadius = `${Math.min(k("radius"), Math.min(w, h) / 2)}px`;
      box.style.background = nxt ? mixHex(cur.fill, nxt.fill, p) : cur.fill;
      box.style.transform = `translate(${k("x")}px, ${k("y")}px) scale(${Math.max(0.001, a < ks[0]!.at ? 0.001 : grow)})`;
      box.style.opacity = a < ks[0]!.at ? "0" : "1";
      // the picture inside is revealed by a mask, never cross-faded
      const shown = p > 0.5 && nxt ? i + 1 : i;
      for (const im of qa<HTMLImageElement>(node, ".tl-img")) {
        const on = Number(im.dataset.i) === shown;
        const rev = on ? (shown === i + 1 ? clamp((p - 0.5) * 2) : nxt ? 1 - clamp(p * 2) : 1) : 0;
        im.style.opacity = rev > 0 ? "1" : "0";
        im.style.clipPath = `inset(0 ${((1 - rev) * 100).toFixed(1)}% 0 0)`;
      }
      const t = q(node, ".tl-txt");
      const key = shown === i + 1 && nxt ? nxt : cur;
      if (t) {
        t.textContent = key.text ?? "";
        t.style.color = key.textColor;
        t.style.fontSize = `${clamp(h * 0.42, 18, 140)}px`;
        const tp = nxt ? Math.abs(p - 0.5) * 2 : 1; // outgoing and incoming words never overlap
        t.style.opacity = String(tp);
        t.style.transform = `translateY(${(1 - tp) * 10}px)`;
      }
    }),
  ];
}

// ───────────────────────────── pageFlyover ─────────────────────────────

/** The reference timing (seconds of a 14.5 s film); everything scales to the element's life. */
const FLY = { flightEnd: 8.2, riseStart: 7.75, tiltA: 8.15, tiltB: 8.95, riseEnd: 9.25, overEnd: 9.47, diveEnd: 9.97, total: 14.5 };

/** Glide speed as a share of cruise, by reference time (0 → half → cruise → ease off). */
function glideSpeed(t: number): number {
  if (t < 0.6) return 0.5 * E.inOutCubic(t / 0.6);
  if (t < 1.25) return 0.5;
  if (t < 1.6) return lerp(0.5, 1.0, E.inOutCubic((t - 1.25) / 0.35));
  if (t < 7.3) return 1.0 + 0.06 * Math.sin((t - 1.6) * 0.9);
  if (t < 8.3) return lerp(1.0, 0.12, E.outCubic((t - 7.3) / 1.0));
  return 0.12 * Math.max(0, 1 - (t - 8.3) / 0.9);
}

export function pageFlyover(el: El<"pageFlyover">, ctx: BriefCtx): BriefItem[] {
  const src = ctx.images[el.imageId] ?? "";
  const hero = el.heroImageId ? (ctx.images[el.heroImageId] ?? "") : "";
  const logo = el.logoImageId ? (ctx.images[el.logoImageId] ?? "") : "";
  const life = el.t1 - el.t0;
  const k = life / FLY.total; // reference seconds → film seconds
  const R = (a: number) => a / k; // film seconds since t0 → reference seconds
  const PW = 740; // page width on the floor, px (at the flight distance it just fills the 1080 frame)
  // the glide's page position, integrated from the speed curve (normalised to 1 at the end)
  const N = 400;
  const cum: number[] = [0];
  for (let i = 1; i <= N; i++) {
    const t = (i / N) * FLY.riseEnd;
    cum.push(cum[i - 1]! + glideSpeed(t) * (FLY.riseEnd / N));
  }
  const total = cum[N]!;
  const glide = (t: number) => {
    const f = clamp(t / FLY.riseEnd) * N;
    const i = Math.floor(f);
    return (cum[i]! + (cum[Math.min(N, i + 1)]! - cum[i]!) * (f - i)) / total;
  };
  const words = (s: string, cls: string, style: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((w, i) => `<span class="${cls}" data-i="${i}" style="display:inline-block;margin-right:.24em;${style}">${esc(w)}</span>`)
      .join("");
  const html = `<div class="pf" style="position:absolute;inset:0;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#f9fbfb 0%,${el.floor} 75%)">
  <div class="pf-cam" style="position:absolute;inset:0;perspective:1880px">
    <div class="pf-page" style="position:absolute;left:${540 - PW / 2}px;top:0;width:${PW}px;transform-style:preserve-3d">
      <img class="pf-blur" src="${src}" alt="" style="position:absolute;left:0;top:0;width:${PW}px;border-radius:24px;filter:blur(9px)">
      <img class="pf-sharp" src="${src}" alt="" style="position:relative;display:block;width:${PW}px;border-radius:24px;box-shadow:0 30px 90px rgba(26,33,51,.20)">
    </div>
  </div>
  ${hero ? `<div class="pf-card" style="position:absolute;left:31px;top:0;width:1018px;border-radius:38px;overflow:hidden;box-shadow:0 30px 80px rgba(26,33,51,.22);opacity:0"><img src="${hero}" alt="" style="display:block;width:1018px"></div>` : ""}
  ${logo ? [0, 1].map((i) => `<div class="pf-tile" data-i="${i}" style="position:absolute;width:150px;height:150px;border-radius:30px;background:#fff;box-shadow:0 18px 40px rgba(26,33,51,.18);display:flex;align-items:center;justify-content:center;opacity:0"><img src="${logo}" alt="" style="max-width:110px;max-height:90px"></div>`).join("") : ""}
  <div class="pf-badge" style="position:absolute;left:0;right:0;top:170px;display:flex;justify-content:center;opacity:0"><div style="display:flex;align-items:center;gap:14px;background:#fff;border-radius:999px;padding:12px 26px;box-shadow:0 8px 24px rgba(26,33,51,.12);font:600 30px/1 Inter,sans-serif;color:#15171c">${logo ? `<img src="${logo}" alt="" style="height:34px">` : ""}${esc(el.brand ?? "")}</div></div>
  <div style="position:absolute;left:60px;right:60px;top:300px;text-align:center">
    <div style="font:500 84px/1.08 Inter,sans-serif;letter-spacing:-.02em;color:#15171c">${words(el.line, "pf-w1", "opacity:0")}</div>
    ${el.tail ? `<div style="font:400 92px/1.1 'Instrument Serif',serif;color:#8b8b92;margin-top:6px">${words(el.tail, "pf-w2", "opacity:0")}</div>` : ""}
  </div>
</div>`;
  return [
    stage(ctx, el.t0, el.t1, html, "fade", (node, a) => {
      const page = q(node, ".pf-page");
      const sharp = q<HTMLImageElement>(node, ".pf-sharp");
      const blur = q<HTMLImageElement>(node, ".pf-blur");
      if (!page || !sharp || !sharp.naturalWidth) return;
      const PH = (PW * sharp.naturalHeight) / sharp.naturalWidth;
      const t = R(a);
      const heroY = Math.min(PH, PW * (900 / 1440)) / 2; // centre of the first screen, page px
      const endY = Math.max(heroY, PH - 520);
      // ── the camera: look-at point on the page, tilt, distance, where it sits on screen ──
      let lookY = lerp(heroY * 0.8, endY, glide(t));
      let tilt = 56;
      let dist = lerp(1360, 1700, E.outCubic(clamp(t / FLY.flightEnd)));
      let screenY = 1000;
      const overDist = Math.max(1700, (1880 * PH) / 1640); // the whole page as one strip
      if (t > FLY.riseStart) {
        const rp = prog(t, FLY.riseStart, FLY.riseEnd, E.inOutCubic);
        dist = Math.exp(lerp(Math.log(dist), Math.log(overDist), rp));
        lookY = lerp(lookY, PH / 2, rp);
        tilt = lerp(56, 0, prog(t, FLY.tiltA, FLY.tiltB, E.inOutCubic));
        screenY = lerp(1000, 940, rp);
      }
      if (t > FLY.riseEnd) dist = overDist * lerp(1, 0.965, prog(t, FLY.riseEnd, FLY.overEnd));
      const cardDist = (1880 * PW) / 1018;
      if (t > FLY.overEnd) {
        const dp = prog(t, FLY.overEnd, FLY.diveEnd, E.inOutCubic);
        dist = Math.exp(lerp(Math.log(overDist * 0.965), Math.log(cardDist), dp));
        lookY = lerp(PH / 2, heroY, dp);
        screenY = lerp(940, 1180, dp);
      }
      const cam = q(node, ".pf-cam");
      if (cam) cam.style.perspectiveOrigin = `540px ${screenY}px`;
      page.style.top = `${screenY - lookY}px`;
      page.style.transformOrigin = `${PW / 2}px ${lookY}px`;
      page.style.transform = `translateZ(${1880 - dist}px) rotateX(${tilt}deg)`;
      // thin focus: sharp in a band around what crosses the middle, soft in front, a little behind
      const band = t < FLY.riseStart ? 1 : 1 + prog(t, FLY.riseStart, FLY.riseEnd) * 20;
      const before = Math.max(0, lookY - 900 * band);
      const after = lookY + 140 * band;
      const m = `linear-gradient(to bottom, transparent ${before}px, #000 ${lookY - 260 * band}px, #000 ${lookY + 60 * band}px, transparent ${after}px)`;
      sharp.style.setProperty("-webkit-mask-image", m);
      sharp.style.setProperty("mask-image", m);
      if (blur) blur.style.opacity = String(1 - prog(t, FLY.riseStart, FLY.riseEnd));
      // the dive: the page narrows to its hero, which lands as a card
      const card = q(node, ".pf-card");
      if (card) {
        const on = t >= FLY.diveEnd - 0.05;
        card.style.opacity = on ? "1" : "0";
        page.style.opacity = on ? "0" : "1";
        const creep = 1 + 0.02 * prog(t, FLY.diveEnd, FLY.total);
        card.style.top = `${1180 - (card.offsetHeight || 640) / 2}px`;
        card.style.transform = `scale(${creep})`;
      }
      const clip = prog(t, FLY.overEnd, FLY.diveEnd, E.inOutCubic);
      sharp.style.clipPath = clip > 0 ? `inset(0 0 ${((PH - heroY * 2) * clip).toFixed(0)}px 0 round ${lerp(24, 38, clip)}px)` : "none";
      for (const tile of qa(node, ".pf-tile")) {
        const i = Number(tile.dataset.i);
        const tp = sp(t, FLY.diveEnd - 0.1 + i * 0.08, 0.5);
        tile.style.opacity = String(t > FLY.diveEnd - 0.1 ? 1 : 0);
        const x = i === 0 ? 40 : 890;
        const y = i === 0 ? 860 : 900;
        tile.style.transform = `translate(${x}px, ${y + (1 - tp) * 80 + Math.sin(t * 1.3 + i) * 4}px) rotate(${i === 0 ? -8 : 7}deg) scale(${Math.max(0.01, tp)})`;
      }
      const badge = q(node, ".pf-badge");
      if (badge) badge.style.opacity = String(prog(t, FLY.diveEnd + 0.05, FLY.diveEnd + 0.35));
      const show = (cls: string, start: number, every: number) => {
        for (const w of qa(node, `.${cls}`)) {
          const st = start + Number(w.dataset.i) * every;
          const wp = prog(t, st, st + 0.34, E.outCubic);
          w.style.opacity = String(wp);
          w.style.transform = `translateY(${(1 - wp) * 16}px)`;
          w.style.filter = wp < 1 ? `blur(${((1 - wp) * 12).toFixed(1)}px)` : "none";
        }
      };
      show("pf-w1", FLY.diveEnd + 0.15, 0.06);
      show("pf-w2", FLY.diveEnd + 0.39, 0.05);
    }),
  ];
}

// ───────────────────────────── diagramZoom ─────────────────────────────

export function diagramZoom(el: El<"diagramZoom">, ctx: BriefCtx): BriefItem[] {
  const ink = inkOn(ctx);
  const accent = ctx.C.ter;
  const firstWhole = el.steps.find((s) => s.focus === null)?.at;
  const appearAt = (id: string) => {
    const s = el.steps.find((x) => x.focus === id);
    return s ? s.at : (firstWhole ?? el.steps[0]!.at);
  };
  const node = (n: El<"diagramZoom">["nodes"][number]) => {
    const w = n.shape === "circle" ? 200 : n.shape === "pill" ? 300 : 280;
    const h = n.shape === "circle" ? 200 : 130;
    const r = n.shape === "box" ? 22 : 999;
    return `<div class="dz-n" data-id="${esc(n.id)}" style="position:absolute;left:${n.x - w / 2}px;top:${n.y - h / 2}px;width:${w}px;height:${h}px;border-radius:${r}px;border:5px solid ${ink};background:${rgba(ink, 0.05)};display:flex;align-items:center;justify-content:center;text-align:center;padding:10px;transform-origin:50% 50%"><span class="dz-l in" style="font-weight:600;font-size:34px;line-height:1.1;color:${ink}">${esc(n.label)}</span></div>`;
  };
  const byId = new Map(el.nodes.map((n) => [n.id, n]));
  const edges = el.edges
    .map((e, i) => {
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) return "";
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / len;
      const uy = (b.y - a.y) / len;
      const x1 = a.x + ux * 120;
      const y1 = a.y + uy * 90;
      const x2 = b.x - ux * 130;
      const y2 = b.y - uy * 100;
      return `<g class="dz-e" data-i="${i}" data-x1="${x1}" data-y1="${y1}" data-x2="${x2}" data-y2="${y2}">
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="5" stroke-linecap="round" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/>
        <polygon class="dz-head" points="0,-11 22,0 0,11" fill="${ink}" transform="translate(${x2} ${y2}) rotate(${(Math.atan2(uy, ux) * 180) / Math.PI})" opacity="0"/>
        ${[0, 1, 2].map((k) => `<circle class="dz-dot" data-k="${k}" r="7" fill="${accent}" opacity="0"/>`).join("")}
        ${e.label ? `<text x="${(x1 + x2) / 2 + uy * 26}" y="${(y1 + y2) / 2 - ux * 26}" text-anchor="middle" font-size="26" font-weight="600" fill="${ink}" opacity="0" class="dz-el">${esc(e.label)}</text>` : ""}
      </g>`;
    })
    .join("");
  const html = `<div class="dz" style="position:absolute;left:40px;top:${el.top}px;width:1000px;height:1400px;overflow:hidden">
  <div class="dz-world" style="position:absolute;left:0;top:0;width:1000px;height:1400px;transform-origin:0 0">
    <svg width="1000" height="1400" style="position:absolute;left:0;top:0;overflow:visible">${edges}</svg>
    ${el.nodes.map(node).join("")}
  </div>
  ${el.steps.map((s, i) => (s.example ? `<div class="dz-ex" data-i="${i}" style="position:absolute;left:60px;right:60px;bottom:30px;text-align:center;opacity:0"><span class="in" style="display:inline-block;background:${accent};color:#fff;font-weight:600;font-size:40px;line-height:1.2;padding:12px 26px;border-radius:16px">${esc(s.example)}</span></div>` : "")).join("")}
</div>`;
  const ZIN = 0.65;
  const camAt = (a: number) => {
    // which step, and whether we are zooming in, holding, or pulling back to the whole
    let i = -1;
    for (let k = 0; k < el.steps.length; k++) if (el.steps[k]!.at <= a) i = k;
    if (i < 0) return { s: 1, cx: 500, cy: 700 };
    const st = el.steps[i]!;
    const n = st.focus ? byId.get(st.focus) : undefined;
    if (!n) return { s: 1, cx: 500, cy: 700 };
    const end = el.steps[i + 1]?.at ?? el.t1 - el.t0;
    const zin = sp(a, st.at + 0.35, ZIN);
    const zout = sp(a, end - ZIN, ZIN);
    const p = zin * (1 - zout);
    return { s: Math.exp(lerp(0, Math.log(2.1), p)), cx: lerp(500, n.x, p), cy: lerp(700, n.y, p) };
  };
  const locked = (id: string, a: number) => {
    const i = el.steps.findIndex((s) => s.focus === id);
    if (i < 0) return false;
    const end = el.steps[i + 1]?.at ?? el.t1 - el.t0;
    return a >= end - ZIN * 0.5;
  };
  return [
    stage(ctx, el.t0, el.t1, html, "fade", (root, a) => {
      const world = q(root, ".dz-world");
      if (!world) return;
      const c = camAt(a);
      world.style.transform = `translate(${500 - c.cx * c.s}px, ${700 - c.cy * c.s}px) scale(${c.s})`;
      const visible = new Map<string, number>();
      for (const n of qa(root, ".dz-n")) {
        const id = n.dataset.id ?? "";
        const at = appearAt(id);
        const g = sp(a, at, 0.5);
        visible.set(id, at);
        n.style.transform = `scale(${Math.max(0.001, g)})`;
        n.style.opacity = a < at ? "0" : "1";
        const lk = locked(id, a);
        n.style.borderColor = lk ? accent : ink;
        n.style.background = lk ? rgba(accent, 0.12) : rgba(ink, 0.05);
        const l = q(n, ".dz-l");
        if (l) l.style.opacity = String(prog(a, at + 0.3, at + 0.6)); // the picture first, then the words
      }
      el.edges.forEach((e, i) => {
        const g = q(root, `.dz-e[data-i="${i}"]`);
        if (!g) return;
        const start = Math.max(visible.get(e.from) ?? 0, visible.get(e.to) ?? 0) + 0.5;
        const d = prog(a, start, start + 0.55, E.inOutCubic);
        const line = q<SVGLineElement>(g, "line");
        if (line) line.setAttribute("stroke-dashoffset", String(100 - d * 100));
        const head = q<SVGElement>(g, ".dz-head");
        if (head) head.setAttribute("opacity", d >= 1 ? "1" : "0");
        const lbl = q<SVGElement>(g, ".dz-el");
        if (lbl) lbl.setAttribute("opacity", String(prog(a, start + 0.5, start + 0.8)));
        const x1 = Number(g.dataset.x1);
        const y1 = Number(g.dataset.y1);
        const x2 = Number(g.dataset.x2);
        const y2 = Number(g.dataset.y2);
        for (const dot of qa<SVGCircleElement>(g, ".dz-dot")) {
          const kk = Number(dot.dataset.k);
          const f = (((a - start) * 0.6 + kk / 3) % 1 + 1) % 1; // flows the way things move
          dot.setAttribute("cx", String(lerp(x1, x2, f)));
          dot.setAttribute("cy", String(lerp(y1, y2, f)));
          dot.setAttribute("opacity", d >= 1 ? String(Math.sin(Math.PI * f) * 0.9) : "0");
        }
      });
      el.steps.forEach((s, i) => {
        const ex = q(root, `.dz-ex[data-i="${i}"]`);
        if (!ex) return;
        const end = el.steps[i + 1]?.at ?? el.t1 - el.t0;
        // outgoing text is gone before the next comes in
        const o = prog(a, s.at + 0.7, s.at + 0.95) * (1 - prog(a, end - ZIN - 0.25, end - ZIN));
        ex.style.opacity = String(o);
        ex.style.transform = `translateY(${(1 - o) * 14}px)`;
      });
    }),
  ];
}
