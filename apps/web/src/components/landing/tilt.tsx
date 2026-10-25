"use client";

import { useEffect } from "react";

/**
 * The pointer tilt for every `[data-tilt]` on the page: it leans ±N° (N = the attribute) towards the
 * pointer, lifts 6px and moves a soft-light gloss with it (the element reads --rx, --ry, --lift,
 * --gx, --gy, --ga). Fine pointers only, never with reduced motion; reset when the pointer leaves.
 */
export function Tilt() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let raf = 0;
    const reset = (el: HTMLElement) => {
      for (const p of ["--rx", "--ry", "--ga", "--lift"]) el.style.removeProperty(p);
    };
    const move = (e: PointerEvent) => {
      const target =
        e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tilt]") : null;
      if (current && current !== target) reset(current);
      current = target;
      if (!target) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = target.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const s = Number(target.dataset.tilt || 8);
        target.style.setProperty("--rx", `${(-y * s).toFixed(2)}deg`);
        target.style.setProperty("--ry", `${(x * s).toFixed(2)}deg`);
        target.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(0)}%`);
        target.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(0)}%`);
        target.style.setProperty("--ga", "0.4");
        target.style.setProperty("--lift", "-6px");
      });
    };
    const leave = () => {
      if (current) reset(current);
      current = null;
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
