/**
 * createEngine — Plan → DOM at time t.
 *
 * One code path for both uses (SPEC §6.1):
 *  - `assetMode: "video"`   browser preview, a <video> synced to t (scrubbable, real-time)
 *  - `assetMode: "frames"`  headless render, pre-extracted JPEG frames (frame-exact)
 */
import type { ColorToken, Plan, TranscriptWord, VideoModeName } from "@rasika/schema";
import { captionAt, captionWindows, type CaptionWindow } from "./captions";
import { FONT_LOADS, engineCss, fontFaceCss } from "./css";
import { div } from "./dom";
import {
  applyTransform,
  buildElements,
  buildEndCard,
  updateItem,
  type BuildCtx,
  type Item,
} from "./elements";
import { createGrain } from "./grain";
import { buildSegments, modeAt, videoWrapperStyle, vstate, type Segment } from "./modes";
import type { Colors } from "./patterns";
import { clamp } from "./toolkit";

export type AssetMode = "video" | "frames";

export interface EngineAssets {
  /** imageId → URL */
  images: Record<string, string>;
  /** video mode: the source clip */
  video?: string;
  /** frames mode: URL for 1-based frame n, and how many exist */
  frames?: { url: (n: number) => string; count: number };
}

export interface EngineOptions {
  plan: Plan;
  transcript: readonly TranscriptWord[];
  assets: EngineAssets;
  assetMode: AssetMode;
  /** Where the engine TTFs live (default "fonts"). `null` = host already declared @font-face. */
  fontBaseUrl?: string | null;
  /** Draw film grain (default true). The golden test turns it off on both sides. */
  grain?: boolean;
  /** Mute the <video> in video mode (default false). */
  muted?: boolean;
}

export interface Engine {
  readonly stage: HTMLElement;
  readonly video: HTMLVideoElement | null;
  readonly duration: number;
  readonly ready: Promise<void>;
  /** Draw time t. In video mode `seek` (default true) also moves the <video> when it is paused. */
  renderFrame(t: number, opts?: { seek?: boolean }): Promise<void>;
  /** Swap the plan (and optionally transcript) without recreating the stage — for the editor. */
  setPlan(plan: Plan, transcript?: readonly TranscriptWord[]): void;
  /** Current video mode name at t. */
  modeAt(t: number): VideoModeName;
  /** The items on stage, for hit-testing / debugging. */
  items(): readonly Item[];
  dispose(): void;
}

export const STAGE_W = 1080;
export const STAGE_H = 1920;

export function createEngine(root: HTMLElement, opts: EngineOptions): Engine {
  const { assets, assetMode } = opts;
  let plan = opts.plan;
  let transcript = opts.transcript;
  const fps = plan.meta.fps;
  const palette = plan.style.palette;

  // ── stage + layers ──
  const stage = div("rk");
  const style = document.createElement("style");
  style.textContent =
    (opts.fontBaseUrl === null ? "" : fontFaceCss(opts.fontBaseUrl ?? "fonts")) +
    engineCss(palette, plan.style.captionSize);
  stage.appendChild(style);

  const pattern = div(`L rk-pattern${plan.style.pattern === "none" ? " none" : ""}`);
  const bl = div("L rk-bleed", { zIndex: "0", isolation: "isolate" });
  const vw = div("rk-vw", { zIndex: "1" });
  const fx = div("L rk-fx", { zIndex: "2" });
  const cap = div("rk-cap", { top: `${plan.captions.y}px` });
  const capi = document.createElement("span");
  capi.className = "rk-capi";
  cap.appendChild(capi);

  let video: HTMLVideoElement | null = null;
  let img: HTMLImageElement | null = null;
  if (assetMode === "video") {
    video = document.createElement("video");
    video.className = "rk-vid";
    video.playsInline = true;
    video.preload = "auto";
    video.muted = opts.muted ?? false;
    if (assets.video) video.src = assets.video;
    vw.appendChild(video);
  } else {
    img = document.createElement("img");
    img.className = "rk-vid";
    img.alt = "";
    vw.appendChild(img);
  }

  const grain = createGrain(STAGE_W, STAGE_H, fps);
  stage.append(pattern, bl, vw, fx, cap, grain.canvas);
  root.appendChild(stage);

  // ── plan-derived state ──
  let segs: Segment[] = [];
  let items: Item[] = [];
  let cw: CaptionWindow[] = [];
  let C: Colors;

  function build() {
    fx.replaceChildren();
    bl.replaceChildren();
    const p = plan.style.palette;
    C = {
      mar: p.mar,
      ter: p.ter,
      gold: p.gold,
      goldd: p.goldd,
      iv: p.iv,
      stage: p.stage,
      ink: p.ink,
    } satisfies Record<ColorToken, string>;
    segs = buildSegments(plan.videoModes);
    const ctx: BuildCtx = {
      C,
      stageHex: p.stage,
      images: assets.images,
      fx,
      bl,
      durationSec: plan.meta.durationSec,
      modeAt: (t) => modeAt(segs, t),
    };
    items = buildElements(plan.elements, ctx);
    if (plan.endCard) {
      const arch = [...segs].reverse().find((s) => s.mode === "arch");
      const t0 = plan.endCard.t0 ?? arch?.t ?? Math.max(0, plan.meta.durationSec - 2.5);
      items.push(...buildEndCard(plan.endCard, t0, ctx));
    }
    cw = plan.captions.enabled ? captionWindows(transcript, plan.style.captionStyle) : [];
    cap.style.top = `${plan.captions.y}px`;
    pattern.className = `L rk-pattern${plan.style.pattern === "none" ? " none" : ""}`;
  }
  build();

  // ── readiness: every font + every image (SPEC §6.2). A font that fails to load rejects
  // `ready` on purpose: a headless render must stop rather than paint blank text. ──
  const ready: Promise<void> = (async () => {
    const fontsApi = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fontsApi) {
      await Promise.all(FONT_LOADS.map((f) => fontsApi.load(f)));
      await fontsApi.ready;
    }
    await Promise.all(
      [...stage.querySelectorAll("img")].map((i) =>
        i.src ? i.decode().catch(() => undefined) : Promise.resolve(),
      ),
    );
    if (video && video.src && video.readyState < 1) {
      await new Promise<void>((res) => {
        const done = () => res();
        video!.addEventListener("loadedmetadata", done, { once: true });
        video!.addEventListener("error", done, { once: true });
        setTimeout(done, 8000);
      });
    }
  })();

  // ── frame source ──
  async function showFrame(t: number, seek: boolean) {
    if (img && assets.frames) {
      const n = clamp(Math.round(t * fps) + 1, 1, assets.frames.count);
      const src = assets.frames.url(n);
      if (!img.src.endsWith(src) && img.src !== src) {
        img.src = src;
        try {
          await img.decode();
        } catch {
          /* missing frame: keep the previous one */
        }
      }
    } else if (video && seek && video.paused && video.readyState >= 1) {
      if (Math.abs(video.currentTime - t) > 0.5 / fps) {
        video.currentTime = t;
        await new Promise<void>((res) => {
          const done = () => res();
          video!.addEventListener("seeked", done, { once: true });
          setTimeout(done, 400);
        });
      }
    }
  }

  const grainOn = opts.grain ?? true;

  async function renderFrame(t: number, o: { seek?: boolean } = {}) {
    await showFrame(t, o.seek ?? true);
    const v = vstate(segs, t);
    const vs = videoWrapperStyle(v, t, C.gold);
    vw.style.transform = vs.transform;
    vw.style.borderRadius = vs.borderRadius;
    vw.style.boxShadow = vs.boxShadow;
    pattern.style.transform = `translateY(${(-t * 14) % 60}px)`;
    for (const it of items) updateItem(it, t);
    // captions
    const c = captionAt(cw, plan.captions, t);
    if (!c) {
      capi.style.visibility = "hidden";
    } else {
      if (capi.textContent !== c.txt) capi.textContent = c.txt;
      capi.className = `rk-capi${c.cls ? ` ${c.cls}` : ""}${c.hindi ? " hi" : ""}`;
      applyTransform(capi, { s: c.s, y: c.y, o: 1 });
    }
    grain.draw(t, grainOn ? Math.round(plan.style.grain * 100) : 0);
  }

  return {
    stage,
    video,
    get duration() {
      return plan.meta.durationSec;
    },
    ready,
    renderFrame,
    setPlan(next, words) {
      plan = next;
      if (words) transcript = words;
      build();
    },
    modeAt: (t) => modeAt(segs, t),
    items: () => items,
    dispose() {
      if (video) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      stage.remove();
    },
  };
}

/** Scale a stage root to fit a box, keeping 1080×1920 coordinates. Returns the scale. */
export function fitStage(root: HTMLElement, boxW: number, boxH: number): number {
  const s = Math.min(boxW / STAGE_W, boxH / STAGE_H);
  root.style.width = `${STAGE_W * s}px`;
  root.style.height = `${STAGE_H * s}px`;
  const stage = root.querySelector<HTMLElement>(".rk");
  if (stage) stage.style.transform = `scale(${s})`;
  return s;
}
