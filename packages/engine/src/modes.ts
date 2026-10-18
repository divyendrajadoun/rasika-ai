/**
 * Video modes — `M` / `SEG` / `vstate` from the reference composition.
 * full | zoom | card | pip | arch. 0.5 s outExpo between modes, 0.6 s inOutCubic into/out of zoom.
 */
import type { CameraKind, VideoMode, VideoModeName } from "@rasika/schema";
import { E, lerp, prog, type Easing } from "./toolkit";

export interface ModeState {
  s: number;
  x: number;
  y: number;
  /** corner radius (px) */
  r: number;
  /** frame factor 0..1 — gold border + shadow + no breathing */
  f: number;
  /** arch factor 0..1 — top corners become a half-circle */
  ar: number;
}

export const MODES: Record<Exclude<VideoModeName, "zoom">, ModeState> = {
  full: { s: 1, x: 0, y: 0, r: 0, f: 0, ar: 0 },
  card: { s: 0.56, x: 0, y: 275, r: 90, f: 1, ar: 0 },
  pip: { s: 0.34, x: 318, y: 560, r: 150, f: 1, ar: 0 },
  arch: { s: 0.6, x: 0, y: 150, r: 40, f: 1, ar: 1 },
};

export const DEFAULT_ZOOM_SCALE = 2.1;

/** zoom on point (px,py): x=(540−px)·s, y=(960−py)·s */
export function zoomState(point: { x: number; y: number }, scale = DEFAULT_ZOOM_SCALE): ModeState {
  return { s: scale, x: (540 - point.x) * scale, y: (960 - point.y) * scale, r: 0, f: 0, ar: 0 };
}

export interface Segment {
  t: number;
  mode: VideoModeName;
  state: ModeState;
}

export function buildSegments(modes: readonly VideoMode[]): Segment[] {
  return [...modes]
    .sort((a, b) => a.t - b.t)
    .map((m) => ({
      t: m.t,
      mode: m.mode,
      state:
        m.mode === "zoom"
          ? zoomState(m.zoomPoint ?? { x: 540, y: 960 }, m.zoomScale ?? DEFAULT_ZOOM_SCALE)
          : MODES[m.mode],
    }));
}

export function modeAt(segs: readonly Segment[], t: number): VideoModeName {
  let m: VideoModeName = "full";
  for (const s of segs) if (t >= s.t) m = s.mode;
  return m;
}

/** How long a mode change takes per camera style (zoom moves are a touch slower). */
export function cameraMove(camera: CameraKind, zoom: boolean): { dur: number; ease: Easing } {
  switch (camera) {
    case "cut":
      return { dur: 0.034, ease: E.linear };
    case "whip":
      return { dur: zoom ? 0.3 : 0.22, ease: E.inOutQuint };
    case "still":
      return { dur: zoom ? 0.7 : 0.6, ease: E.inOutCubic };
    default:
      return { dur: zoom ? 0.6 : 0.5, ease: zoom ? E.inOutCubic : E.outExpo };
  }
}

/** Interpolated video transform at time t (identical maths to the reference `vstate`). */
export function vstate(
  segs: readonly Segment[],
  t: number,
  camera: CameraKind = "glide",
): ModeState {
  let i = 0;
  for (let k = 0; k < segs.length; k++) if (t >= segs[k]!.t) i = k;
  const cur = segs[i]!;
  if (i === 0) return { ...cur.state };
  const prev = segs[i - 1]!;
  const z = cur.mode === "zoom" || prev.mode === "zoom";
  const mv = cameraMove(camera, z);
  const p = prog(t, cur.t, cur.t + mv.dur, mv.ease);
  return {
    s: lerp(prev.state.s, cur.state.s, p),
    x: lerp(prev.state.x, cur.state.x, p),
    y: lerp(prev.state.y, cur.state.y, p),
    r: lerp(prev.state.r, cur.state.r, p),
    f: lerp(prev.state.f, cur.state.f, p),
    ar: lerp(prev.state.ar, cur.state.ar, p),
  };
}

/** Style strings for the video wrapper at state v and time t (breathing only when unframed). */
export function videoWrapperStyle(
  v: ModeState,
  t: number,
  gold: string,
  camera: CameraKind = "glide",
): { transform: string; borderRadius: string; boxShadow: string } {
  const still = camera === "still" || camera === "cut";
  const breathe = still ? 1 : 1 + 0.012 * Math.sin(t * 0.45) * (1 - v.f);
  const rt = lerp(v.r, 540, v.ar);
  return {
    transform: `translate(${v.x}px,${v.y}px) scale(${v.s * breathe})`,
    borderRadius: `${rt}px ${rt}px ${v.r}px ${v.r}px / ${rt}px ${rt}px ${v.r}px ${v.r}px`,
    boxShadow:
      v.f > 0.01
        ? `0 0 0 ${(10 / v.s) * v.f}px ${hexToRgba(gold, v.f)}, 0 60px 120px rgba(0,0,0,${0.55 * v.f})`
        : "none",
  };
}

function hexToRgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
