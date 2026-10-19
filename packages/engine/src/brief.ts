/**
 * Elements for brief-driven films (no speaker): a browser window with a real screenshot, a glass
 * that fills ingredient by ingredient, a fight HUD, a train window through the seasons, and a music
 * machine whose every sound is a movement you can see.
 *
 * Deterministic like the rest of the engine: every value is a pure function of the plan and the
 * time `a` (seconds since the element's t0). Each builder returns full-stage Items whose `fn`
 * redraws the element for that instant.
 */
import type { PlanElement } from "@rasika/schema";
import { div, esc, nextId, px, rgba } from "./dom";
import type { Colors } from "./patterns";
import { E, clamp, lerp, prog, rng } from "./toolkit";

/** The parts of the main builder's context these elements use. */
export interface BriefCtx {
  C: Colors;
  stageHex: string;
  images: Record<string, string>;
  fx: HTMLElement;
  /** true when the stage behind is dark (ink and labels flip to light) */
  dark: boolean;
}

export interface BriefItem {
  el: HTMLElement;
  t0: number;
  t1: number;
  kind: "pop" | "fade" | "none";
  fn?: (el: HTMLElement, a: number, t: number, ex: number) => void;
}

type El<T extends PlanElement["type"]> = Extract<PlanElement, { type: T }>;

function stage(ctx: BriefCtx, t0: number, t1: number, html: string, kind: BriefItem["kind"], fn?: BriefItem["fn"]): BriefItem {
  const el = div("", { position: "absolute", left: "0", top: "0", width: px(1080), height: px(1920) });
  el.innerHTML = html;
  ctx.fx.appendChild(el);
  return { el, t0, t1, kind, fn };
}

const q = <T extends Element = HTMLElement>(root: Element, sel: string) => root.querySelector(sel) as T | null;
const qa = <T extends Element = HTMLElement>(root: Element, sel: string) => Array.from(root.querySelectorAll(sel)) as T[];

/** Ink for lines and labels on this stage. */
const inkOn = (ctx: BriefCtx) => (ctx.dark ? ctx.C.iv : ctx.C.ink);

// ───────────────────────────── browserCard ─────────────────────────────

export function browserCard(el: El<"browserCard">, ctx: BriefCtx): BriefItem[] {
  const src = ctx.images[el.imageId] ?? "";
  const life = Math.max(0.1, el.t1 - el.t0);
  const html = `<div class="bc" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;transform:rotate(${el.tilt}deg);border-radius:20px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.38);background:#fff">
  <div style="height:56px;background:#eef0f3;display:flex;align-items:center;gap:10px;padding:0 22px">
    <i style="width:15px;height:15px;border-radius:50%;background:#ff5f57"></i><i style="width:15px;height:15px;border-radius:50%;background:#febc2e"></i><i style="width:15px;height:15px;border-radius:50%;background:#28c840"></i>
    <div style="flex:1;margin-left:14px;height:34px;border-radius:17px;background:#fff;display:flex;align-items:center;justify-content:center;font:500 22px/1 Inter,sans-serif;color:#4a4f57;letter-spacing:.01em">${esc(el.url)}</div>
  </div>
  <div class="bc-view" style="height:${el.h}px;overflow:hidden;position:relative;background:#fff">
    <img src="${src}" style="position:absolute;left:0;top:0;width:100%;display:block" alt="">
  </div></div>`;
  return [
    stage(ctx, el.t0, el.t1, html, "pop", (node, a) => {
      const img = q<HTMLImageElement>(node, ".bc-view img");
      if (!img || !img.naturalWidth) return;
      const h = (el.w * img.naturalHeight) / img.naturalWidth;
      const travel = Math.max(0, h - el.h) * el.scroll;
      // hold a beat, scroll, hold again: the way a product video pans a page
      const p = prog(a, life * 0.18, life * 0.82, E.inOutQuint);
      img.style.transform = `translateY(${-travel * p}px)`;
    }),
  ];
}

// ───────────────────────────── pourGlass ─────────────────────────────

interface GlassShape {
  vbW: number;
  vbH: number;
  outline: string;
  extra?: string;
  inner: string;
  top: number;
  bottom: number;
  /** x range of the rim (where the pour lands and garnish sits) */
  rim: [number, number];
}

const GLASSES: Record<El<"pourGlass">["glass"], GlassShape> = {
  rocks: {
    vbW: 100, vbH: 110,
    outline: "M8 2 L92 2 L86 96 Q85 104 76 104 L24 104 Q15 104 14 96 Z",
    inner: "M12 6 L88 6 L83 92 L17 92 Z", top: 6, bottom: 92, rim: [8, 92],
  },
  highball: {
    vbW: 60, vbH: 130,
    outline: "M4 2 L56 2 L52 124 Q51 128 46 128 L14 128 Q9 128 8 124 Z",
    inner: "M8 6 L52 6 L48 118 L12 118 Z", top: 6, bottom: 118, rim: [4, 56],
  },
  coupe: {
    vbW: 120, vbH: 130,
    outline: "M4 8 L116 8 Q112 54 60 58 Q8 54 4 8 Z",
    extra: "M60 58 L60 120 M32 126 Q60 117 88 126",
    inner: "M8 12 L112 12 Q108 50 60 54 Q12 50 8 12 Z", top: 12, bottom: 54, rim: [4, 116],
  },
  martini: {
    vbW: 120, vbH: 140,
    outline: "M4 6 L116 6 L62 68 L58 68 Z",
    extra: "M60 68 L60 128 M32 133 L88 133",
    inner: "M11 10 L109 10 L60 63 Z", top: 10, bottom: 63, rim: [4, 116],
  },
  wine: {
    vbW: 80, vbH: 150,
    outline: "M10 4 L70 4 Q77 60 40 74 Q3 60 10 4 Z",
    extra: "M40 74 L40 138 M18 144 L62 144",
    inner: "M13 8 L67 8 Q72 58 40 70 Q8 58 13 8 Z", top: 8, bottom: 70, rim: [10, 70],
  },
  mug: {
    vbW: 120, vbH: 110,
    outline: "M8 4 L92 4 L90 100 Q90 106 84 106 L16 106 Q10 106 10 100 Z",
    extra: "M92 24 Q118 24 116 50 Q114 74 91 76",
    inner: "M12 8 L88 8 L86 98 L14 98 Z", top: 8, bottom: 98, rim: [8, 92],
  },
};

function garnishSvg(kind: NonNullable<El<"pourGlass">["garnish"]>["kind"], r: number): string {
  switch (kind) {
    case "citrus": {
      const seg = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return `<line x1="0" y1="0" x2="${(Math.cos(a) * r * 0.8).toFixed(1)}" y2="${(Math.sin(a) * r * 0.8).toFixed(1)}" stroke="#fff6c8" stroke-width="${r * 0.08}"/>`;
      }).join("");
      return `<circle r="${r}" fill="#f4c430" stroke="#e39b16" stroke-width="${r * 0.14}"/><circle r="${r * 0.8}" fill="#ffe37a"/>${seg}`;
    }
    case "cherry":
      return `<path d="M0 ${-r * 0.4} Q${r * 0.4} ${-r * 1.8} ${r * 1.2} ${-r * 2.2}" stroke="#4b2e12" stroke-width="${r * 0.15}" fill="none"/><circle r="${r * 0.75}" fill="#b5122a"/><circle cx="${-r * 0.25}" cy="${-r * 0.25}" r="${r * 0.18}" fill="#fff" opacity=".6"/>`;
    case "leaf":
      return `<path d="M${-r} 0 Q0 ${-r * 1.1} ${r} 0 Q0 ${r * 1.1} ${-r} 0Z" fill="#3d9a4a"/><path d="M${-r} 0 L${r} 0" stroke="#2a6e34" stroke-width="${r * 0.08}"/>`;
    case "olive":
      return `<ellipse rx="${r * 0.8}" ry="${r * 0.6}" fill="#7a8b2b"/><circle cx="${r * 0.35}" r="${r * 0.22}" fill="#c0392b"/>`;
    case "peel":
      return `<path d="M${-r} ${r * 0.3} Q0 ${-r * 1.2} ${r} ${r * 0.3}" stroke="#f08a24" stroke-width="${r * 0.35}" fill="none" stroke-linecap="round"/>`;
  }
}

export function pourGlass(el: El<"pourGlass">, ctx: BriefCtx): BriefItem[] {
  const g = GLASSES[el.glass];
  const scale = el.size / g.vbH;
  const W = g.vbW * scale;
  // the measures sit to the glass's right: keep at least 300 px for them inside the frame
  const cx = Math.min(el.cx, 1080 - 28 - 300 - 34 - W / 2);
  const left = cx - W / 2;
  const ink = inkOn(ctx);
  const clip = nextId("rk-glass");
  const span = g.bottom - g.top;
  // layer bands (the label sits level with its band, never closer than 66 px to the one below)
  const html = `<div class="pg" style="position:absolute;left:0;top:0;width:1080px;height:1920px">
  <svg class="pg-svg" style="position:absolute;left:${left}px;top:${el.top}px;overflow:visible" width="${W}" height="${el.size}" viewBox="0 0 ${g.vbW} ${g.vbH}">
    <defs><clipPath id="${clip}"><path d="${g.inner}"/></clipPath></defs>
    <path d="${g.inner}" fill="${rgba(ink, 0.05)}"/>
    <g clip-path="url(#${clip})">
      ${el.layers.map((l, i) => `<rect class="pg-l" data-i="${i}" x="0" y="${g.bottom}" width="${g.vbW}" height="0" fill="${l.color}"/>`).join("")}
      <rect class="pg-top" x="0" y="${g.bottom}" width="${g.vbW}" height="1.6" fill="#fff" opacity="0"/>
      ${el.ice ? [0, 1, 2].map((i) => `<rect class="pg-ice" data-i="${i}" x="${g.vbW * (0.28 + i * 0.16)}" y="${g.bottom}" width="${g.vbW * 0.18}" height="${g.vbW * 0.18}" rx="2.4" fill="#fff" opacity=".42" stroke="#fff" stroke-width=".6"/>`).join("") : ""}
    </g>
    <rect class="pg-pour" x="${g.vbW / 2 - 1.4}" y="${-g.vbH * 0.5}" width="2.8" height="0" fill="#000" opacity="0" rx="1.4"/>
    <path d="${g.outline}" fill="none" stroke="${ink}" stroke-width="${2.4}" stroke-linejoin="round"/>
    ${g.extra ? `<path d="${g.extra}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>` : ""}
    <path d="M${g.rim[0] + 6} ${g.top + 4} L${g.rim[0] + 6 + (g.vbW > 90 ? 6 : 3)} ${g.top + span * 0.7}" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/>
    ${el.garnish ? `<g class="pg-garnish" opacity="0">${garnishSvg(el.garnish.kind, g.vbW * 0.11)}</g>` : ""}
  </svg>
  ${el.layers
    .map(
      (l, i) => `<div class="pg-lab" data-i="${i}" style="position:absolute;left:${left + W + 34}px;max-width:${Math.max(220, 1080 - (left + W + 34) - 28)}px;top:0;opacity:0;display:flex;align-items:flex-start;gap:16px">
      <i style="flex:none;margin-top:14px;width:26px;height:26px;border-radius:50%;background:${l.color};box-shadow:0 0 0 3px ${rgba(ink, 0.25)}"></i>
      <span style="display:flex;flex-direction:column;gap:6px"><span class="an" style="font-size:60px;line-height:1;color:${ink};white-space:nowrap">${esc(l.amount)}</span>
      <span style="font-weight:600;font-size:34px;line-height:1.1;color:${rgba(ink, 0.78)}">${esc(l.name)}</span></span></div>`,
    )
    .join("")}
  ${el.garnish ? `<div class="pg-glab" style="position:absolute;left:${left + W + 34}px;max-width:${Math.max(220, 1080 - (left + W + 34) - 28)}px;top:${el.top - 70}px;opacity:0;font-weight:600;font-size:36px;line-height:1;color:${ctx.C.ter}">+ ${esc(el.garnish.name)}</div>` : ""}
</div>`;
  return [
    stage(ctx, el.t0, el.t1, html, "pop", (node, a) => {
      let level = 0; // in viewBox units, from the bottom
      let pouring: { i: number; p: number } | null = null;
      const labTops: number[] = [];
      el.layers.forEach((l, i) => {
        const p = prog(a, l.at, l.at + l.dur, E.outCubic);
        const h = l.fill * span * p;
        const rect = q<SVGRectElement>(node, `.pg-l[data-i="${i}"]`);
        if (rect) {
          rect.setAttribute("y", String(g.bottom - level - h));
          rect.setAttribute("height", String(h + 0.3));
        }
        if (a >= l.at && a < l.at + l.dur) pouring = { i, p };
        const mid = g.bottom - level - (l.fill * span) / 2;
        labTops.push(el.top + mid * scale - 48);
        level += h;
        const lab = q(node, `.pg-lab[data-i="${i}"]`);
        if (lab) {
          const lp = prog(a, l.at + 0.1, l.at + 0.45, E.outCubic);
          lab.style.opacity = String(lp);
          lab.style.transform = `translateX(${(1 - lp) * -24}px)`;
        }
      });
      // labels never collide: walk up from the bottom band
      for (let i = 1; i < labTops.length; i++) labTops[i] = Math.min(labTops[i]!, labTops[i - 1]! - 112);
      labTops.forEach((tp, i) => {
        const lab = q(node, `.pg-lab[data-i="${i}"]`);
        if (lab) lab.style.top = px(tp);
      });
      const top = q<SVGRectElement>(node, ".pg-top");
      if (top) {
        top.setAttribute("y", String(g.bottom - level - 0.8));
        top.setAttribute("opacity", level > 0.5 ? "0.5" : "0");
      }
      const pour = q<SVGRectElement>(node, ".pg-pour");
      if (pour) {
        const cur = pouring as { i: number; p: number } | null;
        if (cur && cur.p < 0.97) {
          const surface = g.bottom - level;
          pour.setAttribute("height", String(Math.max(0, surface + g.vbH * 0.5)));
          pour.setAttribute("fill", el.layers[cur.i]!.color);
          pour.setAttribute("opacity", "0.95");
        } else pour.setAttribute("opacity", "0");
      }
      qa<SVGRectElement>(node, ".pg-ice").forEach((ice, i) => {
        const surface = g.bottom - level;
        const bob = Math.sin(a * 2.2 + i * 1.7) * 0.8;
        const y = Math.min(g.bottom - g.vbW * 0.2, surface - g.vbW * 0.06 + i * g.vbW * 0.05 + bob);
        ice.setAttribute("y", String(level > 1 ? y : g.bottom - g.vbW * 0.2 - i));
        ice.setAttribute("transform", `rotate(${(i - 1) * 8} ${g.vbW * (0.37 + i * 0.16)} ${y + g.vbW * 0.09})`);
      });
      if (el.garnish) {
        const gp = prog(a, el.garnish.at, el.garnish.at + 0.6, E.outBack);
        const gar = q<SVGGElement>(node, ".pg-garnish");
        const restX = g.rim[1] - g.vbW * 0.08;
        const restY = g.top;
        if (gar) {
          gar.setAttribute("opacity", a >= el.garnish.at ? "1" : "0");
          gar.setAttribute("transform", `translate(${restX} ${lerp(restY - g.vbH * 0.7, restY, gp)}) rotate(${(1 - gp) * -90})`);
        }
        const gl = q(node, ".pg-glab");
        if (gl) gl.style.opacity = String(prog(a, el.garnish.at + 0.3, el.garnish.at + 0.7));
      }
    }),
  ];
}

// ───────────────────────────── fightHud ─────────────────────────────

export function fightHud(el: El<"fightHud">, ctx: BriefCtx): BriefItem[] {
  const ink = inkOn(ctx);
  const BAR = 420;
  const top = el.top;
  const r = rng(el.hits.length * 7919 + Math.round(el.t0 * 100));
  const bursts = el.hits.map(() => ({ dx: (r() - 0.5) * 160, dy: (r() - 0.5) * 260, rot: (r() - 0.5) * 30 }));
  const star = (n: number, ro: number, ri: number) =>
    Array.from({ length: n * 2 }, (_, i) => {
      const rad = i % 2 ? ri : ro;
      const ang = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      return `${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`;
    }).join(" ");
  const name = (s: { name: string }, align: string) =>
    `<div class="an" style="font-size:72px;line-height:1;color:${ink};text-transform:uppercase;text-align:${align};width:${BAR}px">${esc(s.name)}</div>`;
  const bar = (side: "a" | "b", color: string) =>
    `<div style="position:relative;width:${BAR}px;height:58px;margin-top:14px;background:${rgba(ink, 0.18)};border:5px solid ${ink};border-radius:10px;overflow:hidden">
      <div class="fh-trail-${side}" style="position:absolute;top:0;bottom:0;${side === "a" ? "right" : "left"}:0;width:100%;background:#fff"></div>
      <div class="fh-hp-${side}" style="position:absolute;top:0;bottom:0;${side === "a" ? "right" : "left"}:0;width:100%;background:${color}"></div></div>`;
  const html = `<div class="fh" style="position:absolute;left:0;top:0;width:1080px;height:1920px">
  <div class="fh-top" style="position:absolute;left:40px;right:40px;top:${top}px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>${name(el.a, "left")}${bar("a", el.a.color)}</div>
    <div class="an" style="margin-top:30px;width:130px;height:130px;border-radius:50%;background:${ctx.C.gold};border:5px solid ${ink};display:flex;align-items:center;justify-content:center;font-size:54px;line-height:1;color:${ctx.C.ink}">VS</div>
    <div>${name(el.b, "right")}${bar("b", el.b.color)}</div>
  </div>
  <div class="fh-round" style="position:absolute;left:0;width:1080px;top:${top + 360}px;text-align:center;opacity:0">
    <div style="font-weight:600;font-size:46px;line-height:1;letter-spacing:.3em;color:${ink}">ROUND 1</div>
    <div class="an" style="font-size:210px;line-height:1;color:${ctx.C.gold};-webkit-text-stroke:6px ${ctx.C.ink};paint-order:stroke fill">FIGHT!</div>
  </div>
  ${el.hits
    .map((h, i) => {
      const x = h.by === "a" ? 760 : 320;
      const col = h.by === "a" ? el.a.color : el.b.color;
      return `<div class="fh-burst" data-i="${i}" style="position:absolute;left:${x + bursts[i]!.dx - 210}px;top:${top + 640 + bursts[i]!.dy}px;width:420px;height:420px;opacity:0">
        <svg width="420" height="420" viewBox="-210 -210 420 420" style="position:absolute;inset:0"><polygon points="${star(12, 200, 120)}" fill="${ctx.C.gold}" stroke="${ctx.C.ink}" stroke-width="10"/><polygon points="${star(12, 150, 96)}" fill="${col}"/></svg>
        <div class="an" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:96px;line-height:1;color:#fff;-webkit-text-stroke:5px ${ctx.C.ink};paint-order:stroke fill;transform:rotate(${bursts[i]!.rot}deg)">${esc(h.word)}</div></div>`;
    })
    .join("")}
  <div class="fh-ko an" style="position:absolute;left:0;width:1080px;top:${top + 520}px;text-align:center;opacity:0;font-size:330px;line-height:1;color:${ctx.C.gold};-webkit-text-stroke:10px ${ctx.C.ink};paint-order:stroke fill">K.O.</div>
  <div class="fh-win" style="position:absolute;left:0;width:1080px;top:${top + 980}px;opacity:0;text-align:center">
    <div style="font-weight:600;font-size:44px;line-height:1;letter-spacing:.3em;color:${ink}">WINNER</div>
    <div class="an" style="display:inline-block;margin-top:18px;padding:16px 40px;background:${el.winner === "a" ? el.a.color : el.b.color};border:5px solid ${ctx.C.ink};font-size:120px;line-height:1;color:#fff;text-transform:uppercase">${esc(el.winner === "a" ? el.a.name : el.b.name)}</div>
  </div>
</div>`;
  const hpAt = (side: "a" | "b", a: number, lag = 0) => {
    // hits by the other side drain this side, each over 0.25 s (the white trail follows 0.35 s later)
    let hp = 100;
    for (const h of el.hits) if (h.by !== side) hp -= h.dmg * prog(a, h.at + lag, h.at + lag + 0.25, E.outCubic);
    if (el.koAt != null && el.winner !== side) hp *= 1 - prog(a, el.koAt - 0.2 + lag, el.koAt + lag, E.outCubic);
    return clamp(hp, 0, 100);
  };
  return [
    stage(ctx, el.t0, el.t1, html, "fade", (node, a) => {
      for (const s of ["a", "b"] as const) {
        const hp = q(node, `.fh-hp-${s}`);
        const tr = q(node, `.fh-trail-${s}`);
        if (hp) hp.style.width = `${hpAt(s, a)}%`;
        if (tr) tr.style.width = `${hpAt(s, a, 0.35)}%`;
      }
      const round = q(node, ".fh-round");
      if (round) {
        const firstHit = el.hits[0]?.at ?? 1.5;
        const end = Math.min(1.4, firstHit - 0.1);
        round.style.opacity = String(prog(a, 0, 0.15) * (1 - prog(a, end - 0.25, end)));
        round.style.transform = `scale(${lerp(1.4, 1, prog(a, 0, 0.3, E.outBack))})`;
      }
      // the whole HUD shakes for a moment on every hit
      let shake = 0;
      el.hits.forEach((h, i) => {
        const b = q(node, `.fh-burst[data-i="${i}"]`);
        const life = a - h.at;
        if (b) {
          const on = life >= 0 && life < 0.6;
          b.style.opacity = on ? String(1 - prog(life, 0.4, 0.6)) : "0";
          b.style.transform = `scale(${on ? lerp(0.3, 1, prog(life, 0, 0.16, E.outBack)) : 0.3})`;
        }
        if (life >= 0 && life < 0.22) shake = Math.max(shake, 1 - life / 0.22);
      });
      const topBar = q(node, ".fh-top");
      if (topBar) topBar.style.transform = `translate(${Math.sin(a * 90) * 12 * shake}px, ${Math.cos(a * 70) * 8 * shake}px)`;
      if (el.koAt != null) {
        const ko = q(node, ".fh-ko");
        const kp = prog(a, el.koAt, el.koAt + 0.28, E.outBack);
        if (ko) {
          ko.style.opacity = String(a >= el.koAt ? 1 - prog(a, el.koAt + 1.6, el.koAt + 2) : 0);
          ko.style.transform = `scale(${lerp(2.6, 1, kp)}) rotate(${lerp(-12, -4, kp)}deg)`;
        }
        const win = q(node, ".fh-win");
        if (win) {
          const wp = prog(a, el.koAt + 0.9, el.koAt + 1.3, E.outBack);
          win.style.opacity = String(prog(a, el.koAt + 0.9, el.koAt + 1.1));
          win.style.transform = `translateY(${(1 - wp) * 80}px)`;
        }
      }
    }),
  ];
}

// ───────────────────────────── seasonWindow ─────────────────────────────

const SEASON = {
  spring: { sky: ["#f9d9e4", "#cfe6f6"], ground: "#b8dc8c", far: "#9fcf86", tree: "#f6a6c3", fall: "#ffd1e0", sun: "#fff4c2" },
  summer: { sky: ["#8ccff2", "#fcfbef"], ground: "#6cbb58", far: "#5ea86a", tree: "#3a8f50", fall: "", sun: "#ffe066" },
  autumn: { sky: ["#f6c39c", "#f4e7d2"], ground: "#c88a48", far: "#b9774a", tree: "#df762c", fall: "#e5822f", sun: "#ffb562" },
  winter: { sky: ["#dbe6f2", "#ffffff"], ground: "#f3f6fb", far: "#cfd9e6", tree: "#eef3f8", fall: "#ffffff", sun: "#f4f6ff" },
} as const;

export function seasonWindow(el: El<"seasonWindow">, ctx: BriefCtx): BriefItem[] {
  const life = Math.max(0.1, el.t1 - el.t0);
  const n = el.seasons.length;
  const frame = ctx.C[el.frame];
  const R = el.shape === "arch" ? `${el.w / 2}px ${el.w / 2}px 18px 18px` : "18px";
  const r = rng(7 + n);
  const hillPath = (w: number, h: number, amp: number, seed: number) => {
    const rr = rng(seed);
    let d = `M0 ${h}`;
    for (let x = 0; x <= w; x += 60) d += ` L${x} ${(h * 0.45 + Math.sin(x / 140 + seed) * amp + rr() * amp * 0.3).toFixed(1)}`;
    return d + ` L${w} ${h} Z`;
  };
  const W = el.w;
  const H = el.h;
  const layers = el.seasons
    .map((s, i) => {
      const c = SEASON[s];
      const trees = Array.from({ length: 10 }, (_, k) => {
        const x = k * 210 + r() * 80;
        const sz = 50 + r() * 50;
        return `<g transform="translate(${x.toFixed(0)} ${(H * 0.62).toFixed(0)})"><rect x="-5" y="0" width="10" height="${(sz * 0.9).toFixed(0)}" fill="${s === "winter" ? "#8a8f99" : "#6b4a2e"}"/><circle cy="${(-sz * 0.3).toFixed(0)}" r="${sz.toFixed(0)}" fill="${c.tree}"/></g>`;
      }).join("");
      return `<div class="sw-s" data-i="${i}" style="position:absolute;inset:0;opacity:${i === 0 ? 1 : 0}">
        <div style="position:absolute;inset:0;background:linear-gradient(${c.sky[0]},${c.sky[1]})"></div>
        <div style="position:absolute;left:${W * 0.68}px;top:${H * 0.12}px;width:${W * 0.16}px;height:${W * 0.16}px;border-radius:50%;background:${c.sun}"></div>
        <svg class="sw-far" width="${W * 3}" height="${H}" style="position:absolute;left:0;top:${H * 0.08}px"><path d="${hillPath(W * 3, H, H * 0.06, 3 + i)}" fill="${c.far}"/></svg>
        <svg class="sw-mid" width="${2100 * 2}" height="${H}" style="position:absolute;left:0;top:0">${trees}<g transform="translate(2100 0)">${trees}</g></svg>
        <div style="position:absolute;left:0;right:0;bottom:0;height:${H * 0.3}px;background:${c.ground}"></div>
        ${c.fall ? Array.from({ length: 22 }, (_, k) => `<i class="sw-p" data-k="${k}" style="position:absolute;left:0;top:0;width:${s === "winter" ? 12 : 16}px;height:${s === "winter" ? 12 : 10}px;border-radius:${s === "winter" ? "50%" : "60% 0"};background:${c.fall}"></i>`).join("") : ""}
      </div>`;
    })
    .join("");
  const cup = el.cup
    ? `<svg class="sw-cup" width="260" height="230" viewBox="0 0 260 230" style="position:absolute;left:${el.x + el.w - 230}px;top:${el.y + el.h - 150}px">
        ${[0, 1, 2].map((k) => `<path class="sw-steam" data-k="${k}" d="M${105 + k * 22} 70 q-14 -22 0 -44 q14 -22 0 -44" fill="none" stroke="${rgba(inkOn(ctx), 0.35)}" stroke-width="6" stroke-linecap="round"/>`).join("")}
        <ellipse cx="128" cy="206" rx="112" ry="20" fill="${ctx.C.iv}" stroke="${ctx.C.ink}" stroke-width="5"/>
        <path d="M58 92 L198 92 L186 190 Q184 202 170 202 L86 202 Q72 202 70 190 Z" fill="${ctx.C.ter}" stroke="${ctx.C.ink}" stroke-width="5"/>
        <path d="M198 112 Q238 112 234 146 Q230 176 192 174" fill="none" stroke="${ctx.C.ink}" stroke-width="10"/>
        <ellipse cx="128" cy="94" rx="70" ry="10" fill="#4a2a17"/></svg>`
    : "";
  const html = `<div class="sw" style="position:absolute;left:0;top:0;width:1080px;height:1920px">
  <div class="sw-win" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${W}px;height:${H}px;border-radius:${R};box-shadow:0 0 0 28px ${frame},0 0 0 34px ${ctx.C.ink};overflow:hidden">${layers}
    <div style="position:absolute;left:${W / 2 - 7}px;top:0;bottom:0;width:14px;background:${frame}"></div>
    <div style="position:absolute;left:0;right:0;top:${H * 0.46}px;height:14px;background:${frame}"></div>
  </div>${cup}</div>`;
  const seg = life / n;
  return [
    stage(ctx, el.t0, el.t1, html, "fade", (node, a) => {
      // the train sways a little; the land rolls past at three speeds
      const win = q(node, ".sw-win");
      if (win) win.style.transform = `translateY(${(Math.sin(a * 2.3) * 3).toFixed(2)}px)`;
      qa(node, ".sw-s").forEach((layer, i) => {
        const fadeIn = i === 0 ? 1 : prog(a, i * seg - 0.6, i * seg + 0.6, E.inOutCubic);
        const fadeOut = i === n - 1 ? 0 : prog(a, (i + 1) * seg - 0.6, (i + 1) * seg + 0.6, E.inOutCubic);
        layer.style.opacity = String(fadeIn * (1 - fadeOut));
        const far = q(layer, ".sw-far");
        if (far) far.style.transform = `translateX(${-((a * 40) % W)}px)`;
        const mid = q(layer, ".sw-mid");
        if (mid) mid.style.transform = `translateX(${-((a * 160) % 2100)}px)`;
        qa(layer, ".sw-p").forEach((p) => {
          const k = Number(p.dataset["k"]);
          const sp = 90 + ((k * 37) % 70);
          const y = ((a * sp + k * 97) % (H + 40)) - 20;
          const x = ((k * 131 + a * -120 - y * 0.25) % W + W) % W;
          p.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(a * 120 + k * 40) % 360}deg)`;
        });
      });
      qa<SVGPathElement>(node, ".sw-steam").forEach((s) => {
        const k = Number(s.dataset["k"]);
        const ph = (a * 0.8 + k * 0.33) % 1;
        s.setAttribute("opacity", String(Math.sin(ph * Math.PI) * 0.9));
        s.setAttribute("transform", `translate(0 ${(-ph * 30).toFixed(1)})`);
      });
    }),
  ];
}

// ───────────────────────────── noteMachine ─────────────────────────────

/** C major from C5: the scale degree each key plays (semitones), shared with the sound cues. */
export const MACHINE_SCALE = [0, 2, 4, 5, 7, 9, 11, 12] as const;
const KEY_X = (k: number) => 120 + k * 120;
const KEY_Y = 660;

export function noteMachine(el: El<"noteMachine">, ctx: BriefCtx): BriefItem[] {
  const { C } = ctx;
  const ink = inkOn(ctx);
  const top = el.top;
  const keyCols = [C.ter, C.gold, ink, C.ter, C.gold, ink, C.ter, C.gold];
  const r = rng(4242);
  // pieces assemble from scattered positions before the drop (the letters "fall apart" into them)
  const parts = ["r1", "r2", "g1", "g2", "drum", ...Array.from({ length: 8 }, (_, k) => `k${k}`)];
  const from: Record<string, { x: number; y: number; rot: number; at: number }> = {};
  const centre: Record<string, [number, number]> = {
    r1: [345, 215],
    r2: [735, 430],
    g1: [815, 170],
    g2: [965, 292],
    drum: [540, 990],
    ...Object.fromEntries(Array.from({ length: 8 }, (_, k) => [`k${k}`, [KEY_X(k), KEY_Y + 85]])),
  };
  parts.forEach((p, i) => {
    // each piece starts as a "letter" somewhere along the typed line above the machine
    const sx = 200 + r() * 680;
    const sy = -70 - r() * 60;
    const [cx, cy] = centre[p]!;
    from[p] = { x: sx - cx, y: sy - cy, rot: (r() - 0.5) * 360, at: (i / parts.length) * 0.75 };
  });
  const gear = (cx: number, cy: number, rad: number, teeth: number, fill: string, id: string) => {
    const pts = Array.from({ length: teeth * 2 }, (_, i) => {
      const rr = i % 2 ? rad : rad * 1.18;
      const ang = (i / (teeth * 2)) * Math.PI * 2;
      return `${(Math.cos(ang) * rr).toFixed(1)},${(Math.sin(ang) * rr).toFixed(1)}`;
    }).join(" ");
    return `<g class="nm-part" data-p="${id}" data-x="${cx}" data-y="${cy}"><g class="nm-spin"><polygon points="${pts}" fill="${fill}" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><circle r="${rad * 0.28}" fill="${C.stage}" stroke="${ink}" stroke-width="7"/></g></g>`;
  };
  const html = `<div class="nm" style="position:absolute;left:0;top:${top}px;width:1080px;height:1100px">
  <svg width="1080" height="1100" viewBox="0 0 1080 1100" style="position:absolute;inset:0;overflow:visible">
    <g class="nm-part" data-p="r1" data-x="0" data-y="0"><line x1="90" y1="150" x2="600" y2="280" stroke="${ink}" stroke-width="22" stroke-linecap="round"/></g>
    <g class="nm-part" data-p="r2" data-x="0" data-y="0"><line x1="1000" y1="360" x2="470" y2="500" stroke="${C.ter}" stroke-width="22" stroke-linecap="round"/></g>
    ${gear(815, 170, 104, 11, C.gold, "g1")}
    ${gear(965, 292, 68, 8, C.ter, "g2")}
    ${Array.from({ length: 8 }, (_, k) => `<g class="nm-part" data-p="k${k}" data-x="0" data-y="0"><rect class="nm-key" data-k="${k}" x="${KEY_X(k) - 52}" y="${KEY_Y}" width="104" height="170" rx="12" fill="${keyCols[k]}" stroke="${ink}" stroke-width="8"/></g>`).join("")}
    <g class="nm-part" data-p="drum" data-x="540" data-y="990"><g class="nm-drum"><ellipse cx="0" cy="-36" rx="190" ry="54" fill="${C.iv}" stroke="${ink}" stroke-width="9"/><path d="M-190 -36 L-190 76 Q0 150 190 76 L190 -36" fill="${C.ter}" stroke="${ink}" stroke-width="9"/><path d="M-140 8 L-76 96 M-38 -12 L26 116 M76 0 L128 88" stroke="${C.gold}" stroke-width="10"/></g><circle class="nm-ring" cx="0" cy="-36" r="190" fill="none" stroke="${C.gold}" stroke-width="7" opacity="0"/></g>
    <circle class="nm-ball" cx="120" cy="110" r="34" fill="${ink}"/>
  </svg></div>`;
  const notes = [...el.notes].sort((x, y) => x.at - y.at);
  const ballAt = (a: number): [number, number] => {
    const start: [number, number] = [120, 110];
    if (a < el.dropAt) return [start[0], start[1] + Math.sin(a * 3) * 3];
    const first = notes[0]!;
    if (a < first.at) {
      // down ramp 1, across to ramp 2, onto the first key
      const p = prog(a, el.dropAt, first.at);
      const path: Array<[number, number]> = [start, [600, 246], [1000, 322], [470, 462], [KEY_X(first.key), KEY_Y - 36]];
      const seg = Math.min(path.length - 2, Math.floor(p * (path.length - 1)));
      const u = p * (path.length - 1) - seg;
      return [lerp(path[seg]![0], path[seg + 1]![0], u), lerp(path[seg]![1], path[seg + 1]![1], E.inCubic(u))];
    }
    for (let i = 0; i < notes.length - 1; i++) {
      const n0 = notes[i]!;
      const n1 = notes[i + 1]!;
      if (a < n1.at) {
        const u = prog(a, n0.at, n1.at);
        const x = lerp(KEY_X(n0.key), KEY_X(n1.key), u);
        const hop = 120 + Math.abs(n1.key - n0.key) * 22;
        return [x, KEY_Y - 36 - hop * 4 * u * (1 - u)];
      }
    }
    const last = notes[notes.length - 1]!;
    const drum = el.drums.find((d) => d > last.at);
    if (drum != null && a < drum) {
      const u = prog(a, last.at, drum);
      return [lerp(KEY_X(last.key), 540, u), lerp(KEY_Y - 36, 950, E.inCubic(u)) - 160 * 4 * u * (1 - u)];
    }
    return [540, 920];
  };
  return [
    stage(ctx, el.t0, el.t1, html, "fade", (node, a) => {
      qa<SVGGElement>(node, ".nm-part").forEach((g) => {
        const id = g.dataset["p"]!;
        const f = from[id]!;
        const p = prog(a, f.at * el.dropAt, f.at * el.dropAt + Math.max(0.5, el.dropAt * 0.22), E.outBack);
        const bx = Number(g.dataset["x"]);
        const by = Number(g.dataset["y"]);
        const sc = lerp(0.25, 1, p);
        const cx = centre[id]![0];
        const cy = centre[id]![1];
        // scale about the piece's own centre while it travels from the line to its place
        g.setAttribute(
          "transform",
          `translate(${bx + f.x * (1 - p)} ${by + f.y * (1 - p)}) translate(${cx - bx} ${cy - by}) scale(${sc}) rotate(${f.rot * (1 - p)}) translate(${bx - cx} ${by - cy})`,
        );
        g.setAttribute("opacity", a < f.at * el.dropAt ? "0" : "1");
      });
      const run = a >= el.dropAt;
      qa<SVGGElement>(node, ".nm-spin").forEach((s, i) => {
        // the gears tick in steps on the beat once the ball is moving
        const ticks = run ? Math.floor((a - el.dropAt) / 0.25) : 0;
        s.setAttribute("transform", `rotate(${(i ? -1 : 1) * ticks * (i ? 22.5 : 18)})`);
      });
      qa<SVGRectElement>(node, ".nm-key").forEach((k) => {
        const key = Number(k.dataset["k"]);
        let hit = 0;
        for (const n of notes) if (n.key === key) hit = Math.max(hit, 1 - clamp(Math.abs(a - n.at) / 0.18));
        k.setAttribute("transform", `translate(0 ${(hit * 16).toFixed(1)})`);
        k.setAttribute("filter", hit > 0.05 ? `brightness(${1 + hit * 0.6})` : "");
      });
      let kick = 0;
      for (const d of el.drums) kick = Math.max(kick, 1 - clamp((a - d) / 0.25) - (a < d ? 1 : 0));
      const drum = q<SVGGElement>(node, ".nm-drum");
      if (drum) drum.setAttribute("transform", `scale(${(1 + Math.max(0, kick) * 0.08).toFixed(3)})`);
      const ring = q<SVGCircleElement>(node, ".nm-ring");
      if (ring) {
        const last = [...el.drums].reverse().find((d) => d <= a);
        const u = last != null ? clamp((a - last) / 0.5) : 1;
        ring.setAttribute("r", String(190 + u * 110));
        ring.setAttribute("opacity", String((1 - u) * 0.9));
      }
      const ball = q<SVGCircleElement>(node, ".nm-ball");
      if (ball) {
        const [x, y] = ballAt(a);
        ball.setAttribute("cx", x.toFixed(1));
        ball.setAttribute("cy", y.toFixed(1));
        ball.setAttribute("opacity", a < el.dropAt * 0.8 ? "0" : "1");
      }
    }),
  ];
}
