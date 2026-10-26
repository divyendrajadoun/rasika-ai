"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { beforeAfter, hero as c } from "@/content/landing";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "../landing/use-advance";

/**
 * Hero: the headline on the left, and on the right the signature, the lens. The raw phone take
 * plays; a circle that follows the pointer shows the Rasika edit of the same take underneath, in
 * sync. Nobody pointing: the lens drifts on its own. One button opens the whole edit.
 */
export function Hero() {
  let n = 0;
  return (
    <section id="hero" className="v2-cin v2-hero">
      <div className="v2-hero-in">
        <div className="v2-hero-copy">
          <p className="v2-badge v2-glass v2-enter" style={{ "--d": "150ms" } as CSSProperties}>
            <span className="v2-badge-chip">EN · हिं</span>
            The AI reel editor for people who talk to camera
          </p>
          <h1 className="v2-h1">
            {c.lines.map((line, li) => {
              const words = line.split(" ");
              return (
                <span key={line} className="v2-h1-line">
                  {words.map((w, wi) => {
                    const i = n++;
                    const accent = li === c.lines.length - 1 && wi === words.length - 1;
                    return (
                      <span key={w}>
                        <span
                          className={cn("v2-w", accent && "v2-serif v2-accent")}
                          style={{ "--i": i } as CSSProperties}
                        >
                          {w}
                        </span>
                        {wi < words.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </span>
              );
            })}
          </h1>
          <p className="v2-hero-sub v2-enter" style={{ "--d": "700ms" } as CSSProperties}>
            {c.sub}
          </p>
          <div className="v2-ctas v2-enter" style={{ "--d": "800ms" } as CSSProperties}>
            <Link href={c.primary.href} className="v2-btn v2-btn-ivory v2-btn-arrow">
              {c.primary.label}
              <span className="v2-disc" aria-hidden>
                →
              </span>
            </Link>
            <Link href="/help" className="v2-btn v2-glass">
              <span aria-hidden className="v2-play-glyph">
                ▶
              </span>
              Watch the 2-minute tour
            </Link>
          </div>
          <ul className="v2-strip v2-enter" style={{ "--d": "900ms" } as CSSProperties}>
            {c.trust.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
        <Lens />
      </div>
    </section>
  );
}

function Lens() {
  const box = useRef<HTMLDivElement>(null);
  const rawRef = useRef<HTMLVideoElement>(null);
  const editRef = useRef<HTMLVideoElement>(null);
  const [whole, setWhole] = useState(false);
  const [lit, setLit] = useState(false);
  const reduced = useReducedMotion();

  // the edit leads; the raw take follows it within 120 ms so the lens never shows a different moment
  useEffect(() => {
    const id = window.setInterval(() => {
      const a = editRef.current;
      const b = rawRef.current;
      if (a && b && Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // the lens: lerp 0.12 towards the pointer, or along a slow Lissajous path over the upper frame
  // (where the edit's poster type sits) when nobody points
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let w = el.clientWidth;
    let h = el.clientHeight;
    const ro = new ResizeObserver(() => {
      w = el.clientWidth;
      h = el.clientHeight;
    });
    ro.observe(el);
    const put = (x: number, y: number) => {
      el.style.setProperty("--lx", `${x.toFixed(1)}px`);
      el.style.setProperty("--ly", `${y.toFixed(1)}px`);
    };
    const lightT = window.setTimeout(() => setLit(true), 900);
    if (reduced) {
      put(w * 0.5, h * 0.32);
      return () => {
        ro.disconnect();
        window.clearTimeout(lightT);
      };
    }

    let tx = w * 0.5;
    let ty = h * 0.32;
    let sx = tx;
    let sy = ty;
    let pointing = false;
    let raf = 0;
    let visible = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (!pointing) {
        const p = (now - t0) / 1000;
        tx = w * (0.5 + 0.24 * Math.sin(p * 0.5));
        ty = h * (0.32 + 0.13 * Math.sin(p * 0.83));
      }
      sx += (tx - sx) * 0.12;
      sy += (ty - sy) * 0.12;
      put(sx, sy);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      pointing = true;
      start();
    };
    const leave = () => {
      pointing = false;
    };
    const io = new IntersectionObserver(([e]) => {
      visible = Boolean(e?.isIntersecting);
      if (visible) start();
    });
    io.observe(el);
    const onVis = () => !document.hidden && start();
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.clearTimeout(lightT);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced]);

  return (
    <figure className="v2-lens-wrap v2-enter" style={{ "--d": "400ms" } as CSSProperties}>
      <div
        ref={box}
        data-ui
        className={cn("v2-lens", lit && "is-lit", whole && "is-whole")}
        onClick={() => setWhole((v) => !v)}
      >
        <DemoVideo
          ref={rawRef}
          className="absolute inset-0"
          src={beforeAfter.before.src}
          poster="/demo/styles/raw.jpg"
          alt={beforeAfter.before.label}
          start="load"
        />
        <div className="v2-lens-edit">
          <DemoVideo
            ref={editRef}
            className="absolute inset-0"
            src={c.demo.after}
            poster={c.demo.afterPoster}
            alt={c.demo.alt}
            start="load"
          />
        </div>
        <div className="v2-lens-ring" aria-hidden>
          <span>Rasika edit</span>
        </div>
      </div>
      <figcaption className="v2-lens-cap">
        <span>{whole ? beforeAfter.after.label : "Raw take"}</span>
        <button type="button" aria-pressed={whole} onClick={() => setWhole((v) => !v)}>
          {whole ? "Back to the raw take" : "Show the whole edit"}
        </button>
      </figcaption>
    </figure>
  );
}
