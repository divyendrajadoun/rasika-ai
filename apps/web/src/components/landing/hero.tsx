"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { DemoVideo } from "@/components/brand/demo-video";
import { FAMILY_LABEL, SFX_LABEL, presetCards, type PresetCard } from "@/config/presets";
import { STYLE_COUNT, hero as c } from "@/content/landing";
import { cn } from "@/lib/utils";
import { useAdvance, useReducedMotion } from "./use-advance";

type Variant = "styles" | "orbit";
/** The A/B flag: NEXT_PUBLIC_HERO_VARIANT sets the default, `?hero=orbit|styles` overrides it for QA. */
const DEFAULT_VARIANT: Variant =
  process.env.NEXT_PUBLIC_HERO_VARIANT === "orbit" ? "orbit" : "styles";

/** Variant A: the looks that wipe over the same raw take, in order. */
const LOOKS = [
  "mikku-royal",
  "katana-pop",
  "launch-spotlight",
  "vox-paper",
  "neon-pop",
  "tabloid-headline",
  "comic-pop",
  "festive-bandhani",
  "glass-keynote",
];
/** Variant B: the ring, style renders of one take between films made from a brief. */
const RING = [
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

/**
 * Hero: the maroon stage and the headline set the way a reel sets it (one gold word at a time, at
 * a speaking pace). Under the shared copy, one of two stages: A "styles", a 3D coverflow of style
 * posters where the centre card wipes from the raw clip to the styled render; B "orbit", a ring of
 * real renders turning behind a phone that plays a finished reel.
 */
export function Hero() {
  const [variant, setVariant] = useState<Variant>(DEFAULT_VARIANT);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("hero");
    if (q === "orbit" || q === "styles") setVariant(q);
  }, []);

  return (
    <section id="hero" className="lp-hero" data-hero-variant={variant}>
      <div className="lp-hero-bg" aria-hidden />
      <HeroCopy />
      {variant === "orbit" ? <OrbitStage /> : <StylesStage />}
    </section>
  );
}

function HeroCopy() {
  const [lit, setLit] = useState(-1);
  const words = useMemo(() => c.lines.map((l) => l.split(" ")), []);
  const total = words.reduce((n, w) => n + w.length, 0);
  const reduced = useReducedMotion();

  // the caption clock: one word lights every 400 ms, a rest after the sentence, then again
  useEffect(() => {
    if (reduced) return;
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
  }, [total, reduced]);

  let n = 0;
  return (
    <div className="lp-hero-copy">
      <span className="lp-badge lp-rise" style={{ "--d": "60ms" } as CSSProperties}>
        <span className="lp-badge-dot" aria-hidden />
        AI reel editor · English &amp; हिन्दी
      </span>
      <h1 className="lp-h1 lp-rise" style={{ "--d": "140ms" } as CSSProperties}>
        {c.lines.map((line, li) => (
          <span key={line}>
            {words[li]!.map((w, wi) => {
              const k = n++;
              return (
                <span key={`${li}-${wi}`}>
                  <span className={k === lit ? "lp-w is-lit" : "lp-w"}>{w}</span>
                  {wi < words[li]!.length - 1 ? " " : ""}
                </span>
              );
            })}
          </span>
        ))}
      </h1>
      <p className="lp-sub lp-rise" style={{ "--d": "260ms" } as CSSProperties}>
        {c.sub}
      </p>
      <div className="lp-ctas lp-rise" style={{ "--d": "340ms" } as CSSProperties}>
        <Link href={c.primary.href} className="lp-btn lp-cta-main">
          {c.primary.label} <span aria-hidden>→</span>
        </Link>
        <Link href="/help" className="lp-btn lp-cta-ghost">
          <span aria-hidden>▶</span> Watch the 2-minute tour
        </Link>
      </div>
      <p className="lp-foot lp-rise" style={{ "--d": "400ms" } as CSSProperties}>
        {c.trust.join(" · ")}
      </p>
    </div>
  );
}

function StylesStage() {
  const looks = useMemo(
    () =>
      LOOKS.map((id) => presetCards.find((p) => p.tokens.id === id)).filter((p): p is PresetCard =>
        Boolean(p),
      ),
    [],
  );
  const N = looks.length;
  // two-phase wipe: the new centre card shows the raw clip at once, then the style sweeps over it
  const [wiping, setWiping] = useState(true);
  const wipeT = useRef(0);
  const { index, pick } = useAdvance(N, 2900, 6000, () => {
    window.clearTimeout(wipeT.current);
    setWiping(false);
    wipeT.current = window.setTimeout(() => setWiping(true), 60);
  });
  useEffect(() => () => window.clearTimeout(wipeT.current), []);
  const active = looks[index]!;

  return (
    <div className="lp-cf" data-tilt="4">
      <div className="lp-floor" style={{ bottom: 70, width: "60%" }} aria-hidden />
      <div className="lp-cf-group">
        {looks.map((p, i) => {
          let off = (((i - index) % N) + N) % N;
          if (off > N / 2) off -= N;
          const ab = Math.abs(off);
          const on = off === 0;
          const style = {
            transform: `translateX(calc(${off} * var(--cw) * 0.82)) translateZ(${on ? 80 : -ab * 150}px) rotateY(${off * -28}deg) scale(${on ? 1.18 : 1})`,
            opacity: ab >= 4 ? 0 : Math.max(0.4, 1 - ab * 0.18),
            zIndex: 20 - ab,
            "--cut": on && !wiping ? "100%" : "0%",
          } as CSSProperties;
          return (
            <button
              key={p.tokens.id}
              type="button"
              aria-label={p.tokens.name}
              aria-pressed={on}
              tabIndex={ab >= 4 ? -1 : 0}
              onClick={() => pick(i)}
              className={cn("lp-cf-card", on && "is-on", on && wiping && "is-wiping")}
              style={style}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
              <img src="/demo/styles/raw.jpg" alt="" draggable={false} decoding="async" />
              {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
              <img
                src={`/demo/styles/${p.tokens.id}.jpg`}
                alt=""
                draggable={false}
                decoding="async"
                loading={i < 4 || i > N - 4 ? "eager" : "lazy"}
                className="lp-cf-styled"
              />
              {on && <span className="lp-cf-edge" aria-hidden />}
              <span className="lp-sheen" aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="lp-cf-label" aria-live="polite">
        <div className="lp-cf-count">
          SAME TAKE · {index + 1} OF {STYLE_COUNT} LOOKS
        </div>
        <div className="lp-cf-name">{active.tokens.name}</div>
        <div className="lp-cf-fam">
          {FAMILY_LABEL[active.tokens.motion.family]} · {SFX_LABEL[active.tokens.motion.sfxKit]}
        </div>
      </div>
    </div>
  );
}

function OrbitStage() {
  const stage = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // the ring turns once every 90 s; the pointer leans the stage a few degrees
  useEffect(() => {
    const el = stage.current;
    const r = ring.current;
    if (!el || !r || reduced) return;
    let raf = 0;
    let angle = 0;
    let last = performance.now();
    const spin = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!document.hidden) {
        angle = (angle + (dt / 90000) * 360) % 360;
        r.style.transform = `rotateY(${angle.toFixed(3)}deg)`;
      }
      raf = requestAnimationFrame(spin);
    };
    raf = requestAnimationFrame(spin);
    const fine = window.matchMedia("(pointer: fine)").matches;
    const move = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--tx", `${(-y * 6).toFixed(2)}deg`);
      el.style.setProperty("--ty", `${(x * 10).toFixed(2)}deg`);
    };
    if (fine) window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, [reduced]);

  return (
    <div ref={stage} className="lp-orbit" aria-hidden>
      <div className="lp-floor" style={{ bottom: 6, width: "70%" }} />
      <div className="lp-orbit-tilt">
        <div className="lp-orbit-push">
          <div ref={ring} className="lp-orbit-ring">
            {RING.map((id, i) => (
              <div key={id} className="lp-orbit-card" style={{ "--i": i } as CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
                <img
                  src={`/demo/${id}.jpg`}
                  alt=""
                  loading={i < 6 ? "eager" : "lazy"}
                  decoding="async"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="lp-phone lp-orbit-phone">
          <div className="lp-phone-screen">
            <DemoVideo
              className="absolute inset-0"
              src={c.demo.after}
              poster={c.demo.afterPoster}
              alt={c.demo.alt}
              start="load"
            />
            <span className="lp-notch" />
            <span
              className="lp-sheen"
              style={{
                background: "linear-gradient(125deg, rgba(255,255,255,0.18), transparent 35%)",
              }}
            />
          </div>
        </div>
      </div>
      <div className="lp-orbit-cap">RENDERED BY RASIKA</div>
    </div>
  );
}
