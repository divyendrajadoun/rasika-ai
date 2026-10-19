"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { Reveal } from "@/components/motion/reveal";
import { beforeAfter, features as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Features — "Panel with margin notes". The plate is the real before/after: the raw phone clip under
 * the Rasika edit, split by a handle you drag, both playing in sync. Eight notes in the margins name
 * what the edit does; hovering a note pulls the handle across so the finished edit shows whole.
 */
export function Features() {
  const [pos, setPos] = useState(50);
  const [held, setHeld] = useState<number | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const a = afterRef.current;
    const b = beforeRef.current;
    if (!a || !b) return;
    const id = window.setInterval(() => {
      if (Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  const shown = held ?? pos;
  const left = c.items.slice(0, 4);
  const right = c.items.slice(4);
  const note = (f: (typeof c.items)[number], i: number, side: "l" | "r") => (
    <li
      key={f.id}
      className={cn(
        "max-w-[26ch] transition-opacity duration-200 lg:absolute",
        side === "l" ? "lg:right-0 lg:text-right" : "lg:left-0",
        active && active !== f.id && "lg:opacity-40",
      )}
      style={{ top: `${i * 168}px` } as CSSProperties}
      onMouseEnter={() => {
        setActive(f.id);
        setHeld(100);
      }}
      onMouseLeave={() => {
        setActive(null);
        setHeld(null);
      }}
      onFocus={() => {
        setActive(f.id);
        setHeld(100);
      }}
      onBlur={() => {
        setActive(null);
        setHeld(null);
      }}
      tabIndex={0}
    >
      <h3 className="font-medium leading-snug">{f.title}</h3>
      <p className="text-muted small mt-1">{f.body}</p>
    </li>
  );

  return (
    <section id="features" className="section wrap scroll-mt-6">
      <div className="grid12">
        <div className="col-span-12 lg:col-span-4 lg:text-right">
          <h2 className="head">{c.title}</h2>
          <p className="text-muted mt-3 lg:ml-auto lg:max-w-[28ch]">{c.sub}</p>
        </div>
        <p className="text-muted col-span-12 mt-3 lg:col-start-5 lg:col-span-5 lg:mt-0 lg:pt-2">
          {beforeAfter.sub}
        </p>
      </div>

      <div className="grid12 mt-12 lg:mt-16">
        <ul className="relative col-span-12 order-2 mt-10 grid gap-8 sm:grid-cols-2 lg:order-1 lg:col-span-4 lg:mt-0 lg:block lg:min-h-[676px]">
          {left.map((f, i) => note(f, i, "l"))}
        </ul>

        <Reveal
          as="figure"
          kind="shutter"
          className="col-span-12 order-1 mx-auto w-full max-w-[380px] lg:col-start-5 lg:col-span-4 lg:order-2"
        >
          <div
            data-ui
            id="ba-frame"
            ref={frameRef}
            className="relative aspect-[9/16] w-full touch-none select-none overflow-clip bg-[#111]"
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              setFromClientX(e.clientX);
            }}
            onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
            onDragStart={(e) => e.preventDefault()}
          >
            <DemoVideo ref={beforeRef} className="absolute inset-0" src={beforeAfter.before.src} poster="/demo/styles/raw.jpg" alt={beforeAfter.before.label} />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${shown}%)` }}>
              <DemoVideo ref={afterRef} className="absolute inset-0" src={beforeAfter.after.src} poster="/demo/after-poster.webp" alt={beforeAfter.after.label} />
            </div>
            <div aria-hidden className="compare-handle" style={{ left: `${shown}%` }} />
            <div
              aria-hidden
              data-glass="knob"
              data-glass-snapshot="#ba-frame"
              className="compare-knob"
              style={{ left: `${shown}%` }}
            />
            <span data-glass="tag" data-glass-snapshot="#ba-frame" className="compare-tag left-3">
              {beforeAfter.before.label}
            </span>
            <span data-glass="tag" data-glass-snapshot="#ba-frame" className="compare-tag right-3">
              {beforeAfter.after.label}
            </span>
            <label className="sr-only" htmlFor="ba-slider">
              Comparison position
            </label>
            <input
              id="ba-slider"
              type="range"
              min={0}
              max={100}
              value={Math.round(pos)}
              onChange={(e) => setPos(Number(e.target.value))}
              className="absolute inset-x-6 bottom-6 h-1 cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:opacity-100"
              aria-valuetext={`${Math.round(pos)} percent edited`}
            />
          </div>
          <figcaption className="text-muted small mt-3">{beforeAfter.note}</figcaption>
        </Reveal>

        <ul className="relative col-span-12 order-3 mt-8 grid gap-8 sm:grid-cols-2 lg:col-start-9 lg:col-span-4 lg:mt-0 lg:block lg:min-h-[676px]">
          {right.map((f, i) => note(f, i, "r"))}
        </ul>
      </div>
    </section>
  );
}
