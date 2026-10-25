"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** True when the visitor asked for less motion (read once, after mount). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * An index that steps through `count` items every `every` ms. A pick by hand jumps there and holds
 * the auto-advance for `hold` ms. Nothing advances while the tab is hidden or with reduced motion.
 */
export function useAdvance(
  count: number,
  every: number,
  hold: number,
  onStep?: (i: number) => void,
) {
  const [index, setIndex] = useState(0);
  const at = useRef(0);
  const lastPick = useRef(0);
  const step = useRef(onStep);
  step.current = onStep;
  const reduced = useReducedMotion();

  const go = useCallback((i: number) => {
    at.current = i;
    setIndex(i);
    step.current?.(i);
  }, []);

  useEffect(() => {
    if (reduced || count < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden || Date.now() - lastPick.current < hold) return;
      go((at.current + 1) % count);
    }, every);
    return () => window.clearInterval(id);
  }, [count, every, hold, reduced, go]);

  const pick = useCallback(
    (i: number) => {
      lastPick.current = Date.now();
      go(i);
    },
    [go],
  );

  return { index, pick, reduced };
}
