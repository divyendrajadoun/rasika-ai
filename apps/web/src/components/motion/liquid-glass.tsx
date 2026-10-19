"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Liquid glass (liquidGL 3.0.0, MIT, https://github.com/naughtyduk/liquidGL).
 *
 * Any element marked `data-glass="<kind>"` becomes a refracting glass pane. The library snapshots
 * the area behind it (WebGPU → WebGL2 → WebGL1, or a CSS backdrop blur where none exist) and draws
 * the pane on a canvas *under* the element, so the element's own children (links, sliders, buttons,
 * inputs) stay the real DOM controls on top: `content: false` stops the library from re-drawing
 * them, and globals.css gives the children `pointer-events: auto` because the library turns
 * pointer events off on the pane itself.
 *
 * Kinds:
 *  bar     the floating navigation and app bars (sticky), dark glass
 *  chip    the hero's live controls lying across the headline
 *  knob    the compare slider's handle, a magnifying lens over the two clips
 *  tag     the small labels on the compare plates
 *  panel   larger frosted panes: the closing dialog, the sign-in panel, the wizard's action bar
 *
 * An element may carry `data-glass-snapshot="#selector"` to refract only that region (sharper and
 * cheaper than the whole page), `data-glass-tint="rgba(…)"` to dye its glass, and
 * `data-glass-shadow="false"` when it sits in the page flow and should cast no shadow.
 *
 * The layer re-builds on every route change; anything can ask for a fresh snapshot by
 * dispatching `window.dispatchEvent(new Event("rasika:glass"))` (the hero does when the style or
 * the language changes the field behind its chips).
 */

type Kind = "bar" | "chip" | "knob" | "tag" | "panel";

type LiquidOptions = Record<string, unknown>;
interface Lens {
  destroy?: () => void;
  setTint?: (tint: string | null) => void;
  renderer?: { captureSnapshot?: () => void };
}
type LiquidFn = ((o: LiquidOptions) => Lens | Lens[] | undefined) & {
  registerDynamic?: (el: string | Element | Element[]) => void;
};

const BASE: Record<Kind, LiquidOptions> = {
  bar: { refraction: 0.012, bevelDepth: 0.05, bevelWidth: 0.18, frost: 4, shadow: true, specular: true, resolution: 1 },
  chip: { refraction: 0.04, bevelDepth: 0.18, bevelWidth: 0.28, frost: 0, shadow: false, specular: true, magnify: 1.05, tilt: true, tiltFactor: 4, resolution: 1.5 },
  knob: { refraction: 0.05, bevelDepth: 0.2, bevelWidth: 0.35, frost: 0, shadow: false, specular: true, magnify: 1.35, resolution: 1.5 },
  tag: { refraction: 0.015, bevelDepth: 0.06, bevelWidth: 0.3, frost: 2, shadow: false, specular: false, resolution: 1.5 },
  panel: { refraction: 0.02, bevelDepth: 0.06, bevelWidth: 0.12, frost: 3, shadow: true, specular: true, resolution: 1 },
};

/**
 * The dye each kind takes when its element names none: bars are always dark glass (their ink is
 * ivory, over light and dark pages alike); panels are bone glass on the light theme and oxblood
 * glass on the dark one, so their ink reads on whatever moves behind them.
 */
function defaultTint(kind: Kind): string | null {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  if (kind === "bar") return "rgba(28, 7, 11, 0.62)";
  if (kind === "panel") return dark ? "rgba(26, 8, 11, 0.7)" : "rgba(241, 240, 236, 0.8)";
  if (kind === "tag") return "rgba(12, 12, 12, 0.45)";
  return null;
}

/** z-index per kind: every lens in one liquidGL() call must share one, so each kind gets its own. */
const Z: Record<Kind, number> = { bar: 60, chip: 12, knob: 14, tag: 13, panel: 20 };

export function LiquidGlass() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const lenses: Lens[] = [];
    let refresh: ((e?: Event) => void) | null = null;
    let retheme: (() => void) | null = null;

    const build = async () => {
      const mod = (await import("liquid-gl")) as unknown as { default?: LiquidFn };
      const liquidGL = (mod.default ?? (window as unknown as { liquidGL?: LiquidFn }).liquidGL) as LiquidFn | undefined;
      if (cancelled || !liquidGL) return;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // no pane is photographed into another pane's picture (glass inside glass reads as noise)
      document.querySelectorAll<HTMLElement>("[data-glass]").forEach((el) => el.setAttribute("data-liquid-ignore", ""));

      // group the marked elements by kind, snapshot region and tint (one liquidGL() call per group)
      const groups = new Map<string, { kind: Kind; snapshot: string; tint: string | null; flat: boolean; nodes: HTMLElement[] }>();
      document.querySelectorAll<HTMLElement>("[data-glass]").forEach((el, i) => {
        const kind = el.dataset.glass as Kind;
        if (!(kind in BASE)) return;
        const snapshot = el.dataset.glassSnapshot || "body";
        const tint = el.dataset.glassTint || defaultTint(kind);
        // a pane that sits in the page flow (not floating) takes no drop shadow
        const flat = el.dataset.glassShadow === "false";
        // one group (one canvas) per kind, region, dye and shadow
        const key = `${kind}|${snapshot}|${tint ?? ""}|${flat}`;
        if (!el.id) el.id = `glass-${kind}-${i}`;
        const g = groups.get(key) ?? { kind, snapshot, tint, flat, nodes: [] };
        g.nodes.push(el);
        groups.set(key, g);
      });

      for (const g of groups.values()) {
        if (cancelled) return;
        const target = g.nodes.map((n) => `#${CSS.escape(n.id)}`).join(", ");
        const opts: LiquidOptions = {
          ...BASE[g.kind],
          target,
          snapshot: g.snapshot,
          zIndex: Z[g.kind],
          content: false,
          reveal: still ? "none" : "fade",
          tint: g.tint,
          ...(g.flat ? { shadow: false } : {}),
        };
        if (still) Object.assign(opts, { specular: false, tilt: false, interaction: "none" });
        try {
          const made = liquidGL(opts);
          if (made) lenses.push(...(Array.isArray(made) ? made : [made]));
        } catch (err) {
          console.warn("liquid glass: skipped a group", err);
        }
      }

      refresh = (e?: Event) => {
        // a scoped refresh re-takes only the snapshots of that region (the hero asks every caption cycle)
        const scope = (e as CustomEvent<string | undefined> | undefined)?.detail;
        const seen = new Set<unknown>();
        for (const l of lenses) {
          const r = l.renderer as { captureSnapshot?: () => void; snapshotTarget?: Element } | undefined;
          if (!r || seen.has(r)) continue;
          if (scope && !(r.snapshotTarget && r.snapshotTarget.matches(scope))) continue;
          seen.add(r);
          r.captureSnapshot?.();
        }
        // tints may have changed with the content
        document.querySelectorAll<HTMLElement>("[data-glass][data-glass-tint]").forEach((el) => {
          const lens = lenses.find((l) => (l as { el?: HTMLElement }).el === el);
          lens?.setTint?.(el.dataset.glassTint ?? null);
        });
      };
      window.addEventListener("rasika:glass", refresh);

      retheme = () => {
        for (const l of lenses) {
          const el = (l as { el?: HTMLElement }).el;
          const kind = el?.dataset.glass as Kind | undefined;
          if (el && kind && !el.dataset.glassTint) l.setTint?.(defaultTint(kind));
        }
        window.setTimeout(() => refresh?.(), 80);
      };
      window.addEventListener("rasika:theme", retheme);
    };

    // after the fonts and the page's load sequence (the headline rises for about 1.1 s, and the
    // library cannot follow CSS animations), so the snapshot holds the finished page
    const settle = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1300;
    const start = () => {
      const go = () => window.setTimeout(() => requestAnimationFrame(() => void build()), settle);
      if (document.fonts?.ready) void document.fonts.ready.then(go);
      else go();
    };
    let timer = 0;
    if (document.readyState === "complete") timer = window.setTimeout(start, 120);
    else window.addEventListener("load", start, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("load", start);
      if (refresh) window.removeEventListener("rasika:glass", refresh);
      if (retheme) window.removeEventListener("rasika:theme", retheme);
      for (const l of lenses) {
        try {
          l.destroy?.();
        } catch {
          /* already gone */
        }
      }
    };
  }, [pathname]);

  return null;
}

/**
 * Ask the glass layer for a fresh snapshot (call after the content behind a pane changes). With a
 * selector, only the panes that refract that region re-take theirs.
 */
export function refreshGlass(scope?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("rasika:glass", { detail: scope }));
}
