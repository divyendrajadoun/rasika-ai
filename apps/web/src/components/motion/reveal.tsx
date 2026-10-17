"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds. */
  delay?: number;
  /** "up" = rise + fade (default). "card" = fly in from below with outBack, like the engine's cards. */
  kind?: "up" | "card";
}

/* ── batched scheduler: read every pending element's rect first, then write classes once ──
   (one Reveal per card × ~40 cards would otherwise force ~40 synchronous layouts). */
const pending = new Set<HTMLElement>();
let flushScheduled = false;
let observer: IntersectionObserver | null = null;

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          (e.target as HTMLElement).classList.add("reveal-shown");
          observer?.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  return observer;
}

function flush() {
  flushScheduled = false;
  const vh = window.innerHeight;
  const toHide: HTMLElement[] = [];
  for (const el of pending) {
    const r = el.getBoundingClientRect(); // reads only
    if (!(r.top < vh && r.bottom > 0)) toHide.push(el);
  }
  pending.clear();
  const io = getObserver();
  for (const el of toHide) {
    el.classList.add("reveal-hidden"); // writes only
    io.observe(el);
  }
}

function schedule(el: HTMLElement) {
  pending.add(el);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flush);
  }
}

/**
 * Scroll-linked reveal that is visible in server HTML (good LCP, works without JS).
 * After hydration, elements still below the fold are hidden and animated in when they
 * intersect; elements already on screen are left alone (no flash). Reduced motion → static.
 */
export function Reveal({ children, className, delay = 0, kind = "up" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    schedule(el);
    return () => {
      pending.delete(el);
      observer?.unobserve(el);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("reveal", kind === "card" ? "reveal-card" : "reveal-up", className)}
      style={{ transitionDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
