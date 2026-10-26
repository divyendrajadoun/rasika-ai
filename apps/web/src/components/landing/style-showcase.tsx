"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRIEF_KINDS, type BriefKind } from "@/config/briefs";
import { FAMILY_LABEL, SFX_LABEL, demoSrc, presetCards, type PresetCard } from "@/config/presets";
import { STYLE_COUNT, styles as c } from "@/content/landing";
import { cn } from "@/lib/utils";
import { useHoverClip, useReducedMotion } from "./use-advance";

const DEMO = (id: string) => ({
  video: demoSrc(id, "mp4"),
  poster: demoSrc(id, "jpg"),
});
const RAW = { video: "/demo/styles/raw.mp4", poster: "/demo/styles/raw.jpg" };

/** The four looks on show (the full grid of every style lives in the wizard). */
const PICKS = ["launch-spotlight", "mikku-royal", "katana-pop", "vox-paper"];

/**
 * Examples: one section, two answers. "From your video": four real renders of the same 12-second
 * take, the chosen one over the raw clip on the sticky compare plate (drag the handle). "No video at
 * all": a rail of films made from a brief whose cards angle away from the centre as it scrolls; each
 * plays on hover and opens the wizard on that kind of film.
 */
export function StyleShowcase() {
  const cards = PICKS.map((id) => presetCards.find((p) => p.tokens.id === id)).filter(
    (p): p is PresetCard => Boolean(p),
  );
  const [activeId, setActiveId] = useState(cards[1]?.tokens.id ?? cards[0]!.tokens.id);
  const card = cards.find((p) => p.tokens.id === activeId) ?? cards[0]!;
  return (
    <section id="styles" className="lp-sec lp-styles">
      <div className="lp-in">
        <div className="lp-kicker">Examples</div>
        <h2 className="lp-h2" style={{ marginTop: 12, maxWidth: "18ch" }}>
          One video. Many looks. Or no video at all.
        </h2>
        <p className="lp-muted" style={{ margin: "16px 0 0", maxWidth: "58ch" }}>
          Every clip here was made by Rasika from the same 12-second phone video. Tap a style to
          compare it with the original, or scroll down for films made from just a typed idea.
        </p>

        <div className="lp-ex-grid">
          <div className="lp-ex-plate">
            <Compare card={card} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="lp-muted" style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>
              From your video · 4 of {STYLE_COUNT} styles
            </div>
            <ul className="lp-tiles">
              {cards.map((p) => (
                <li key={p.tokens.id}>
                  <StyleTile
                    card={p}
                    active={p.tokens.id === activeId}
                    onPick={() => setActiveId(p.tokens.id)}
                  />
                </li>
              ))}
            </ul>
            <Link href="/dashboard/new" className="lp-btn lp-btn-quiet" style={{ marginTop: 22 }}>
              See all {STYLE_COUNT} styles when you make a Reel →
            </Link>
          </div>
        </div>

        <Films />
      </div>
    </section>
  );
}

function Films() {
  const rail = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();
  // each card turns away from the rail's centre: rotateY(k * -26deg) translateZ(-|k| * 90px)
  const angle = useCallback(() => {
    const r = rail.current;
    if (!r) return;
    const cx = r.scrollLeft + r.clientWidth / 2;
    for (const li of Array.from(r.children) as HTMLElement[]) {
      const a = li.firstElementChild as HTMLElement | null;
      if (!a) continue;
      if (reduced) {
        a.style.setProperty("--cf", "0deg");
        a.style.setProperty("--cz", "0px");
        continue;
      }
      const k = Math.max(
        -1,
        Math.min(1, ((li.offsetLeft + li.offsetWidth / 2 - cx) / r.clientWidth) * 1.8),
      );
      a.style.setProperty("--cf", `${(k * -26).toFixed(2)}deg`);
      a.style.setProperty("--cz", `${(-Math.abs(k) * 90).toFixed(1)}px`);
    }
  }, [reduced]);
  useEffect(() => {
    angle();
    window.addEventListener("resize", angle);
    return () => window.removeEventListener("resize", angle);
  }, [angle]);

  return (
    <div style={{ marginTop: 96 }}>
      <div className="lp-kicker">No video at all</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            style={{
              margin: "10px 0 0",
              fontWeight: 600,
              fontSize: "clamp(1.6rem, 1.1rem + 2vw, 2.6rem)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            No video? Type an idea.
          </h3>
          <p className="lp-muted" style={{ margin: "12px 0 0", maxWidth: "56ch" }}>
            Paste a website, a recipe, two products to compare or a one-line idea. Rasika writes it,
            designs every frame and adds the sound.
          </p>
        </div>
        <span className="lp-muted" style={{ fontSize: 13 }}>
          <span className="hidden md:inline">Hover to play · </span>Scroll for more →
        </span>
      </div>
      <ul ref={rail} className="lp-rail" onScroll={angle}>
        {BRIEF_KINDS.map((k) => (
          <li key={k.id}>
            <FilmCard kind={k} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilmCard({ kind }: { kind: BriefKind }) {
  const { vid, play, stop } = useHoverClip(`/demo/briefs/${kind.id}.mp4`);
  return (
    <Link
      href={`/dashboard/new?source=brief&kind=${kind.id}`}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className="lp-film"
    >
      <span className="lp-tile-media" style={{ display: "block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img
          src={`/demo/briefs/${kind.id}.jpg`}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
        />
        <video
          ref={vid}
          poster={`/demo/briefs/${kind.id}.jpg`}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
        <span className="lp-film-sheen" aria-hidden />
      </span>
      <span
        style={{ display: "block", marginTop: 12, fontWeight: 600, fontSize: 15, lineHeight: 1.25 }}
      >
        {kind.title}
      </span>
      <span
        className="lp-muted"
        style={{ display: "block", marginTop: 4, fontSize: 13, lineHeight: 1.4 }}
      >
        You give: {kind.youGive}
      </span>
    </Link>
  );
}

function Compare({ card }: { card: PresetCard }) {
  const [pos, setPos] = useState(42);
  const [playing, setPlaying] = useState(true);
  const rawRef = useRef<HTMLVideoElement>(null);
  const styleRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const demo = DEMO(card.tokens.id);

  useEffect(() => {
    const a = styleRef.current;
    const b = rawRef.current;
    if (!a || !b) return;
    const id = window.setInterval(() => {
      if (Math.abs(a.currentTime - b.currentTime) > 0.12) b.currentTime = a.currentTime;
    }, 250);
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          void a.play().catch(() => undefined);
          void b.play().catch(() => undefined);
        } else {
          a.pause();
          b.pause();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(a);
    return () => {
      window.clearInterval(id);
      io.disconnect();
    };
  }, []);

  // a new style: the clip's src changed under the same element; start both from the top together
  useEffect(() => {
    const a = styleRef.current;
    const b = rawRef.current;
    if (!a || !b) return;
    a.load();
    b.currentTime = 0;
    setPos(42);
    if (playing) {
      void a.play().catch(() => undefined);
      void b.play().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo.video]);

  const toggle = useCallback(() => {
    const a = styleRef.current;
    const b = rawRef.current;
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
  const setFromClientX = useCallback((x: number) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  }, []);

  return (
    <>
      <div className="lp-tilt-plate" data-tilt="6">
        <div
          data-ui
          id="style-frame"
          ref={frameRef}
          className="lp-cmp"
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
          {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clips */}
          <img
            src={RAW.poster}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <video
            ref={rawRef}
            src={RAW.video}
            poster={RAW.poster}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Raw phone clip"
          />
          <div className="lp-cmp-top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clip */}
            <img
              src={demo.poster}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              ref={styleRef}
              src={demo.video}
              poster={demo.poster}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover"
              aria-label={`${card.tokens.name} edit`}
            />
          </div>
          <div className="lp-cmp-line" style={{ left: `${pos}%` }} aria-hidden>
            <div className="lp-cmp-knob">⟷</div>
          </div>
          <span className="lp-cmp-tag" style={{ left: 14 }}>
            Raw
          </span>
          <span className="lp-cmp-tag" style={{ right: 14 }}>
            {card.tokens.name}
          </span>
        </div>
      </div>
      <div className="lp-range" style={{ marginTop: 20 }}>
        <button type="button" onClick={toggle} className="lp-play" aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(100 - pos)}
          onChange={(e) => setPos(100 - Number(e.target.value))}
          aria-label="Reveal the styled version"
          aria-valuetext={`${Math.round(100 - pos)} percent styled`}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginTop: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 18 }}>{card.tokens.name}</div>
          <div className="lp-muted" style={{ fontSize: 13 }}>
            {FAMILY_LABEL[card.tokens.motion.family]} · {SFX_LABEL[card.tokens.motion.sfxKit]}
          </div>
        </div>
        <Link href={`/dashboard/new?style=${card.tokens.id}`} className="lp-btn lp-btn-gold">
          {c.ctaLabel}
        </Link>
      </div>
    </>
  );
}

function StyleTile({
  card,
  active,
  onPick,
}: {
  card: PresetCard;
  active: boolean;
  onPick: () => void;
}) {
  const demo = DEMO(card.tokens.id);
  const { vid, play, stop } = useHoverClip(demo.video);
  return (
    <button
      type="button"
      data-tilt="10"
      onClick={onPick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-pressed={active}
      className={cn("lp-tile")}
    >
      <span className="lp-tile-media">
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img src={demo.poster} alt="" loading="lazy" decoding="async" />
        <video
          ref={vid}
          poster={demo.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden
          tabIndex={-1}
        />
      </span>
      <span className="lp-tile-name">{card.tokens.name}</span>
      <span className="lp-tile-meta">
        {FAMILY_LABEL[card.tokens.motion.family]}
        {card.badge ? ` · ${card.badge}` : ""}
      </span>
      <span className="lp-gloss" aria-hidden />
    </button>
  );
}
