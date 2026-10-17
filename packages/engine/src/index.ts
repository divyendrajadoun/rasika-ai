/**
 * @rasika/engine — public surface.
 * Phase 0: the deterministic toolkit. Phase 3 adds the Plan → DOM engine
 * (video modes, captions, element builders, grain) behind the
 * `window.renderFrame(t)` / `window.__ready` render contract.
 */
export * from "./toolkit";

export const ENGINE_VERSION = "0.1.0";
export const STAGE = { width: 1080, height: 1920, fps: 30 } as const;
