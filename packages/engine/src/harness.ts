/**
 * Headless harness entry — bundled to dist/rasika-engine.js (IIFE, global `RasikaEngine`).
 *
 * harness/index.html loads `config.js` (sets window.HARNESS) and this bundle, then exposes the
 * render contract the worker's render.py expects:
 *   window.COMP, window.renderFrame(t), window.__ready
 */
import { Plan, Transcript, validatePlan, type TranscriptWord } from "@rasika/schema";
import { createEngine, type Engine } from "./engine";
import { deriveSfx } from "./sfx";

export * from "./engine";
export * from "./sfx";
/** Exposed for the worker: validate a plan inside Chromium with real canvas font metrics. */
export { validatePlan, Plan as PlanSchema };
// the validator page loads a plan's own fonts before measuring (planner.ChromiumValidator)
export { fontFaceCss, fontFamily, fontLoadDescriptor, fontsForStyle } from "./css";
export * from "./toolkit";
export { captionWindows } from "./captions";
export { buildSegments, vstate, MODES } from "./modes";

/** Canvas-based text measurement for validatePlan (the same fonts the render uses). */
export function measureTextCanvas(fonts?: {
  poster: string;
  accent: string;
  ui: string;
  devanagari: string;
}): (text: string, font: string, size: number, tracking?: number) => number {
  const ctx = document.createElement("canvas").getContext("2d");
  const family: Record<string, string> = {
    anton: fonts?.poster ?? "Anton",
    serif: fonts?.accent ?? "Instrument Serif",
    kicker: fonts?.ui ?? "Inter",
    devanagari: fonts?.devanagari ?? "Tiro Devanagari Hindi",
  };
  return (text, font, size, tracking = 0) => {
    if (!ctx) return text.length * size * 0.5;
    const weight = font === "kicker" ? "800 " : "";
    const style = font === "serif" ? "italic " : "";
    ctx.font = `${style}${weight}${size}px "${family[font] ?? "Inter"}"`;
    const base = font === "kicker" ? 0.14 : font === "anton" ? 0.01 : 0;
    const txt = font === "anton" || font === "kicker" ? text.toUpperCase() : text;
    return ctx.measureText(txt).width + text.length * (base + tracking) * size;
  };
}

export interface HarnessConfig {
  /** Raw plan JSON — parsed with Zod here so defaults are applied before the engine sees it. */
  plan: unknown;
  words: TranscriptWord[];
  images: Record<string, string>;
  frames: { pattern: string; count: number };
  /** stock B-roll per element id: frame pattern + count (the worker prepares them) */
  broll?: Record<string, { pattern: string; count: number }>;
  fontBaseUrl?: string;
  grain?: boolean;
  /** Stage scale for headless renders at other sizes (0.5 → 540×960 preview). */
  scale?: number;
}

declare global {
  interface Window {
    HARNESS?: HarnessConfig;
    COMP?: { width: number; height: number; fps: number; duration: number };
    renderFrame?: (t: number) => Promise<void>;
    __ready?: Promise<void>;
    __RENDER__?: boolean;
    __engine?: Engine;
  }
}

/** Expand `frames/f%05d.jpg` for frame n. */
export function framePattern(pattern: string): (n: number) => string {
  const m = /%0(\d+)d/.exec(pattern);
  if (!m) return () => pattern;
  const width = Number(m[1]);
  return (n) => pattern.replace(m[0], String(n).padStart(width, "0"));
}

export function mountHarness(cfg: HarnessConfig, root: HTMLElement = document.body): Engine {
  const plan = Plan.parse(cfg.plan);
  const words = Transcript.shape.words.parse(cfg.words);
  const engine = createEngine(root, {
    plan,
    transcript: words,
    assets: {
      images: cfg.images,
      frames: { url: framePattern(cfg.frames.pattern), count: cfg.frames.count },
      broll: cfg.broll
        ? Object.fromEntries(
            Object.entries(cfg.broll).map(([id, b]) => [id, { url: framePattern(b.pattern), count: b.count }]),
          )
        : undefined,
    },
    assetMode: "frames",
    fontBaseUrl: cfg.fontBaseUrl ?? "fonts",
    grain: cfg.grain ?? true,
  });
  window.COMP = { width: 1080, height: 1920, fps: plan.meta.fps, duration: plan.meta.durationSec };
  window.renderFrame = (t: number) => engine.renderFrame(t);
  window.__ready = engine.ready;
  window.__engine = engine;
  if (cfg.scale && cfg.scale !== 1) engine.stage.style.transform = `scale(${cfg.scale})`;
  if (!window.__RENDER__) {
    const fit = () => {
      const s = Math.min(innerWidth / 1080, innerHeight / 1920);
      engine.stage.style.transform = `scale(${s})`;
    };
    addEventListener("resize", fit);
    fit();
    let t = 0;
    let last = performance.now();
    void engine.ready.then(() => {
      const tick = async (now: number) => {
        t = (t + (now - last) / 1000) % plan.meta.durationSec;
        last = now;
        await engine.renderFrame(t);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  return engine;
}

if (typeof window !== "undefined" && window.HARNESS) {
  const eng = mountHarness(window.HARNESS);
  // cues for the worker: window.__cues
  (window as Window & { __cues?: unknown }).__cues = deriveSfx(Plan.parse(window.HARNESS.plan));
  void eng;
}
