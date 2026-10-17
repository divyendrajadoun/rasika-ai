"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { PhoneMockup } from "@/components/brand/phone-mockup";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { beforeAfter as c } from "@/content/landing";

/**
 * Before/after comparison: raw clip underneath, edited clip on top clipped by a draggable
 * divider. Both <video>s play muted, looped and in sync (drift corrected every ~250 ms).
 */
export function BeforeAfter() {
  const [pos, setPos] = useState(50); // percent, where the divider sits
  const [playing, setPlaying] = useState(true);
  // DemoVideo arms both clips when the section scrolls into view; sync runs regardless.
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // keep the two clips in sync
  useEffect(() => {
    const a = afterRef.current;
    const b = beforeRef.current;
    if (!a || !b) return;
    const id = window.setInterval(() => {
      if (Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  const togglePlay = useCallback(() => {
    const a = afterRef.current;
    const b = beforeRef.current;
    if (!a || !b) return;
    if (a.paused) {
      void a.play();
      void b.play();
      setPlaying(true);
    } else {
      a.pause();
      b.pause();
      setPlaying(false);
    }
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <Section id="before-after" eyebrow={c.eyebrow} title={c.title} sub={c.sub}>
      <Reveal kind="card" className="mx-auto w-full max-w-[340px] sm:max-w-[380px]">
        <PhoneMockup>
          <div
            ref={frameRef}
            className="relative h-full w-full touch-none select-none"
            onPointerDown={(e) => {
              dragging.current = true;
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              setFromClientX(e.clientX);
            }}
            onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
            onPointerUp={() => (dragging.current = false)}
            onPointerCancel={() => (dragging.current = false)}
          >
            <DemoVideo
              ref={beforeRef}
              className="absolute inset-0"
              src={c.before.src}
              alt={c.before.label}
            />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <DemoVideo
                ref={afterRef}
                className="absolute inset-0"
                src={c.after.src}
                alt={c.after.label}
              />
            </div>
            {/* divider */}
            <div
              aria-hidden
              className="bg-gold absolute bottom-0 top-0 w-[3px] -translate-x-1/2 shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
              style={{ left: `${pos}%` }}
            >
              <div className="bg-gold text-ink absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-lg">
                <span className="font-display text-sm tracking-widest">⇔</span>
              </div>
            </div>
            <span className="kicker text-iv absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[0.55rem]">
              {c.before.label}
            </span>
            <span className="kicker bg-gold text-ink absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.55rem]">
              {c.after.label}
            </span>
            {/* accessible slider */}
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
              className="absolute inset-x-6 bottom-14 h-1 cursor-ew-resize appearance-none bg-transparent opacity-0 focus-visible:opacity-100"
              aria-valuetext={`${Math.round(pos)} percent edited`}
            />
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause both clips" : "Play both clips"}
              className="bg-ink/70 text-iv hover:bg-ink/90 absolute bottom-4 left-1/2 inline-flex size-10 -translate-x-1/2 items-center justify-center rounded-full backdrop-blur"
            >
              {playing ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </PhoneMockup>
      </Reveal>
      <p className="text-muted-foreground mt-8 text-center text-sm">{c.note}</p>
    </Section>
  );
}
