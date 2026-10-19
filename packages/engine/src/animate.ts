/**
 * codeScene: one shot of an /animate film, drawn by code on a 1080×1920 canvas.
 *
 * The shot's code is the body of `draw(g, t, W, H, rnd, S)`. It is called for every frame with
 * the time since the shot began, a seeded random that restarts each frame (so the same frame is
 * always drawn the same) and a small helper kit. The page it runs in has no network
 * (render.py refuses every request) and validatePlan rejects code that reaches for timers, clocks,
 * storage, the document or the network.
 */
import type { PlanElement } from "@rasika/schema";
import { div, px } from "./dom";
import type { BriefCtx, BriefItem } from "./brief";
import { E, clamp, lerp, rng } from "./toolkit";

type El = Extract<PlanElement, { type: "codeScene" }>;
type Draw = (
  g: CanvasRenderingContext2D,
  t: number,
  W: number,
  H: number,
  rnd: () => number,
  S: typeof HELPERS & { D: number },
) => void;

/** Smooth value noise in [0, 1], seeded and stateless. */
function hash(x: number, y: number): number {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x: number, y = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

export const HELPERS = {
  lerp,
  clamp,
  ease: E,
  noise,
  /** eased progress of t through [a, b] */
  prog: (t: number, a: number, b: number, e: (x: number) => number = E.inOutCubic) => e(clamp((t - a) / (b - a))),
  /** a spring with a small overshoot, for p in [0, 1] */
  spring: (p: number) =>
    p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-6.5 * p) * (Math.cos(7.5 * p) + (6.5 / 7.5) * Math.sin(7.5 * p)),
  /** blend two #rrggbb colours */
  mix: (a: string, b: string, p: number) => {
    const pa = parseInt(a.slice(1), 16);
    const pb = parseInt(b.slice(1), 16);
    const ch = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(p)));
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  },
  smooth: (a: number, b: number, x: number) => {
    const p = clamp((x - a) / (b - a));
    return p * p * (3 - 2 * p);
  },
  TAU: Math.PI * 2,
};

export function codeScene(el: El, ctx: BriefCtx): BriefItem[] {
  const node = div("", { position: "absolute", left: "0", top: "0", width: px(1080), height: px(1920) });
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  canvas.style.cssText = "position:absolute;left:0;top:0;width:1080px;height:1920px";
  node.appendChild(canvas);
  // behind everything else: words set over the picture stay on top
  ctx.fx.insertBefore(node, ctx.fx.firstChild);
  const g = canvas.getContext("2d");
  let draw: Draw | null = null;
  try {
    // the engine compiles the shot once; the code itself may not construct functions
    draw = new Function("g", "t", "W", "H", "rnd", "S", `"use strict";\n${el.code}`) as Draw;
  } catch (e) {
    (window as unknown as { __codeErrors?: string[] }).__codeErrors?.push(`${el.id}: ${String(e)}`);
  }
  let failed = false;
  return [
    {
      el: node,
      t0: el.t0,
      t1: el.t1,
      kind: "none",
      fn: (_n, a) => {
        if (!g || !draw || failed) return;
        g.save();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, 1080, 1920);
        try {
          draw(g, Math.max(0, a), 1080, 1920, rng(el.seed), { ...HELPERS, D: el.t1 - el.t0 });
        } catch (e) {
          failed = true; // one bad shot stays blank rather than breaking the film
          const w = window as unknown as { __codeErrors?: string[] };
          (w.__codeErrors ??= []).push(`${el.id} at ${a.toFixed(2)}s: ${String(e)}`);
        }
        g.restore();
      },
    },
  ];
}
