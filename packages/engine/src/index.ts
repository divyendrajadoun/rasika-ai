/**
 * @rasika/engine — public surface.
 *
 * `createEngine(root, { plan, transcript, assets, assetMode })` turns a Plan into DOM state at
 * time t, in the browser (video mode) or headless (frames mode). `deriveSfx(plan)` produces the
 * cue sheet. `harness.ts` is the IIFE entry the worker loads.
 */
export * from "./toolkit";
export * from "./engine";
export * from "./sfx";
export { captionWindows, captionAt, normaliseKey } from "./captions";
export { buildSegments, vstate, modeAt, zoomState, MODES, DEFAULT_ZOOM_SCALE } from "./modes";
export { patternSvg } from "./patterns";
export { FONT_FILES, FONT_LOADS, engineCss, fontFaceCss } from "./css";
export { autoColor, type Item } from "./elements";
export { framePattern, mountHarness, type HarnessConfig } from "./harness";

export const ENGINE_VERSION = "0.3.0";
export const STAGE = { width: 1080, height: 1920, fps: 30 } as const;
