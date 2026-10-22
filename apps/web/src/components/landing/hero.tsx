"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { hero as c } from "@/content/landing";
import "./hero3d.css";

/**
 * Hero — "The curved wall". The maroon stage, the headline set as a reel sets it (one gold word at
 * a time, at a speaking pace), and under it a cinema-curved wall of real Rasika reels gliding past
 * behind a phone that plays a finished one. Pure CSS 3D: the wall is a ring of posters seen from
 * inside (only its far half faces us), so it always sits behind the phone; the pointer tilts the
 * stage a few degrees. Only the phone plays video. Reduced motion: the wall and the words hold still.
 */
// the wall: style renders of one take, between films made from a brief (all real Rasika output)
const WALL = [
  "styles/launch-spotlight",
  "briefs/versus",
  "styles/mikku-royal",
  "briefs/recipe",
  "styles/katana-pop",
  "briefs/explainer",
  "styles/vox-paper",
  "briefs/launch",
  "styles/neon-pop",
  "briefs/journey",
  "styles/tabloid-headline",
  "briefs/tierlist",
  "styles/cinema-bebas",
  "briefs/editorial",
  "styles/comic-pop",
  "briefs/product",
];

export function Hero() {
  const [lit, setLit] = useState(-1);
  const stage = useRef<HTMLDivElement>(null);
  const words = useMemo(() => c.lines.map((l) => l.split(" ")), []);
  const total = words.reduce((n, w) => n + w.length, 0);

  // the caption clock: one word lights at ~150 words a minute, a breath after the sentence, again
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = -1;
    let t = 0;
    const beat = 400;
    const tick = () => {
      i = i + 1 > total + 3 ? -1 : i + 1;
      setLit(i);
      t = window.setTimeout(tick, i === total ? beat * 3 : beat);
    };
    t = window.setTimeout(tick, 1300);
    return () => window.clearTimeout(t);
  }, [total]);

  // the pointer leans the stage (a few degrees, eased by CSS)
  useEffect(() => {
    const el = stage.current;
    if (!el || window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        el.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(x * 10).toFixed(2)}deg`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  let n = 0;
  return (
    <section id="hero" className="hero3d relative isolate overflow-clip pt-[104px]">
      <div className="hero3d-glow" aria-hidden />
      <div className="hero3d-grain" aria-hidden />

      <div className="wrap relative z-10 flex flex-col items-center text-center">
        <p data-load className="hero3d-kicker" style={{ "--d": "60ms" } as CSSProperties}>
          <span className="hero3d-dot" aria-hidden /> AI reel editor · English &amp; हिन्दी
        </p>
        <h1
          className="lines display mt-5 max-w-[14ch] text-[var(--iv)]"
          style={{ fontSize: "clamp(2.6rem, 7.4vw, 6.2rem)", lineHeight: 0.96, letterSpacing: "-0.045em" }}
        >
          {c.lines.map((line, li) => (
            <span key={line} className="line">
              <span data-line style={{ "--i": li } as CSSProperties}>
                {words[li]!.map((w, wi) => {
                  const k = n++;
                  return (
                    <span key={`${li}-${wi}`}>
                      <span className={k === lit ? "hero3d-word is-lit" : "hero3d-word"}>{w}</span>
                      {wi < words[li]!.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </span>
            </span>
          ))}
        </h1>
        <p
          data-load
          className="mt-5 max-w-[58ch] text-[1.0625rem] leading-relaxed text-[color:rgb(246_236_216/0.78)] sm:text-[1.1875rem]"
          style={{ "--d": "380ms" } as CSSProperties}
        >
          {c.sub}
        </p>
        <div data-load className="mt-8 flex flex-wrap items-center justify-center gap-3" style={{ "--d": "460ms" } as CSSProperties}>
          <Link href={c.primary.href} className="hero3d-cta">
            {c.primary.label}
            <span aria-hidden className="hero3d-cta-arrow">→</span>
          </Link>
          <Link href="/help" className="hero3d-ghost">
            <span aria-hidden className="hero3d-play">▶</span> Watch the 2-minute tour
          </Link>
        </div>
        <p data-load className="mt-5 text-[13px] tracking-wide text-[color:rgb(246_236_216/0.6)]" style={{ "--d": "520ms" } as CSSProperties}>
          {c.trust.join("  ·  ")}
        </p>
      </div>

      {/* the stage: a curved wall of real reels behind the phone */}
      <div ref={stage} className="hero3d-stage" aria-hidden>
        <div className="hero3d-tilt">
          <div className="hero3d-ring" style={{ "--n": WALL.length } as CSSProperties}>
            {WALL.map((id, i) => (
              <div key={id} className="hero3d-card" style={{ "--i": i } as CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
                <img src={`/demo/${id}.jpg`} alt="" loading={i < 6 ? "eager" : "lazy"} decoding="async" draggable={false} />
              </div>
            ))}
          </div>
          <div className="hero3d-phone">
            <video
              src={c.demo.after}
              poster={c.demo.afterPoster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="hero3d-screen"
            />
            <span className="hero3d-notch" />
            <span className="hero3d-badge">Rendered by Rasika</span>
          </div>
          <div className="hero3d-floor" />
        </div>
      </div>
    </section>
  );
}
