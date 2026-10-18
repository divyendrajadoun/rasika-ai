/**
 * Toolkit ported 1:1 from reference/mikku/assets/template.html.
 * Pure functions only — the engine must be deterministic (same plan + inputs → same frames).
 */

export type Easing = (t: number) => number;

export const E = {
  linear: ((t) => t) as Easing,
  outCubic: ((t) => 1 - Math.pow(1 - t, 3)) as Easing,
  inCubic: ((t) => t * t * t) as Easing,
  inOutCubic: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)) as Easing,
  outQuint: ((t) => 1 - Math.pow(1 - t, 5)) as Easing,
  outExpo: ((t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))) as Easing,
  inExpo: ((t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10))) as Easing,
  outBack: ((t) => {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }) as Easing,
  outQuart: ((t) => 1 - Math.pow(1 - t, 4)) as Easing,
  inOutQuint: ((t) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2) as Easing,
} as const;

export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x));

/** Relative luma 0..1 of a #rrggbb colour (sRGB weights, no gamma — enough to tell light from dark). */
export function hexLuma(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return 0;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}
export const lerp = (a: number, b: number, p: number): number => a + (b - a) * p;

/** Eased progress of `t` through [a, b], clamped to 0..1. */
export const prog = (t: number, a: number, b: number, e: Easing = E.linear): number =>
  e(clamp((t - a) / (b - a)));

/** Mulberry32 — seeded PRNG identical to the reference composition. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Transform {
  x?: number;
  y?: number;
  s?: number;
  r?: number;
  o?: number;
  blur?: number;
}

/** Style strings for an element; applied by the DOM adapter. Kept pure so it can be unit-tested. */
export function transformStyle({ x = 0, y = 0, s = 1, r = 0, o = 1, blur = 0 }: Transform = {}): {
  transform: string;
  opacity: string;
  filter: string;
  visibility: "hidden" | "visible";
} {
  return {
    transform: `translate(${x}px,${y}px) scale(${s}) rotate(${r}deg)`,
    opacity: String(o),
    filter: blur > 0.05 ? `blur(${blur}px)` : "none",
    visibility: o <= 0.001 ? "hidden" : "visible",
  };
}

/** Frame index (1-based, matching ffmpeg's f%05d.jpg) for time t at fps. */
export const frameIndex = (t: number, fps: number, nFrames: number): number =>
  clamp(Math.round(t * fps) + 1, 1, nFrames);
