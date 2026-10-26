"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRIEF_KINDS, type BriefKind } from "@/config/briefs";
import { FAMILY_LABEL, SFX_LABEL, demoSrc, presetCards, type PresetCard } from "@/config/presets";
import { STYLE_COUNT, styles as c } from "@/content/landing";
import { cn } from "@/lib/utils";
import { useHoverClip } from "../landing/use-advance";

const DEMO = (id: string) => ({ video: demoSrc(id, "mp4"), poster: demoSrc(id, "jpg") });
const RAW = { video: "/demo/styles/raw.mp4", poster: "/demo/styles/raw.jpg" };
/** The four looks on show (the full grid of every style lives in the wizard). */
const PICKS = ["launch-spotlight", "mikku-royal", "katana-pop", "vox-paper"];

/**
 * Examples, a cinema sheet over the ivory: "from your video", four real renders of one 12-second
 * take, the chosen one over the raw clip on the compare plate; then "no video at all", a rail of
 * films made from a brief. Every tile and card plays on hover; each card opens the wizard.
 */
export function Examples() {
  const cards = PICKS.map((id) => presetCards.find((p) => p.tokens.id === id)).filter(
    (p): p is PresetCard => Boolean(p),
  );
  const [activeId, setActiveId] = useState(cards[1]?.tokens.id ?? cards[0]!.tokens.id);
  const card = cards.find((p) => p.tokens.id === activeId) ?? cards[0]!;

  return (
    <section id="styles" className="v2-cin v2-sec v2-overlap v2-examples">
      <div className="v2-in">
        <header className="v2-head" data-rv>
          <span className="v2-label">[ 03 ] Examples</span>
          <h2 className="v2-h2">
            Same take. Different reel. <br />
            Or no take <em className="v2-serif v2-accent">at all.</em>
          </h2>
          <p className="v2-lede">
            Every clip here is real Rasika output. Pick a look to see it over the raw phone video,
            or scroll the films made from nothing but a brief.
          </p>
        </header>

        <div className="v2-ex-grid">
          <div className="v2-ex-plate" data-rv>
            <Compare card={card} />
          </div>
          <div className="v2-ex-side" data-rv style={{ "--rv-d": "120ms" } as React.CSSProperties}>
            <span className="v2-label">From your video · {STYLE_COUNT} styles, here are four</span>
            <ul className="v2-tiles">
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
            <Link href="/dashboard/new" className="v2-link">
              See all {STYLE_COUNT} styles when you make a reel <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <Films />
      </div>
    </section>
  );
}

function Compare({ card }: { card: PresetCard }) {
  const [pos, setPos] = useState(42);
  const [playing, setPlaying] = useState(true);
  const styleRef = useRef<HTMLVideoElement>(null);
  const rawRef = useRef<HTMLVideoElement>(null);
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
      <div
        data-ui
        id="style-frame"
        ref={frameRef}
        className="v2-cmp"
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
        <img src={RAW.poster} alt="" draggable={false} loading="lazy" decoding="async" />
        <video
          ref={rawRef}
          src={RAW.video}
          poster={RAW.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label="Raw phone clip"
        />
        <div className="v2-cmp-top" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clip */}
          <img src={demo.poster} alt="" draggable={false} loading="lazy" decoding="async" />
          <video
            ref={styleRef}
            src={demo.video}
            poster={demo.poster}
            muted
            loop
            playsInline
            preload="none"
            aria-label={`${card.tokens.name} edit`}
          />
        </div>
        <div className="v2-cmp-line" style={{ left: `${pos}%` }} aria-hidden>
          <span className="v2-cmp-knob">
            <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
              <path
                d="M5 1 1 5l4 4M13 1l4 4-4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </span>
        </div>
        <span className="v2-cmp-tag" style={{ left: 12 }}>
          Raw
        </span>
        <span className="v2-cmp-tag is-gold" style={{ right: 12 }}>
          {card.tokens.name}
        </span>
      </div>
      <div className="v2-range v2-range-play">
        <button type="button" onClick={toggle} className="v2-play" aria-pressed={playing}>
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
      <div className="v2-ex-meta">
        <div>
          <div className="v2-ex-name">{card.tokens.name}</div>
          <div className="v2-ex-fam">
            {FAMILY_LABEL[card.tokens.motion.family]} · {SFX_LABEL[card.tokens.motion.sfxKit]}
          </div>
        </div>
        <Link href={`/dashboard/new?style=${card.tokens.id}`} className="v2-btn v2-btn-ivory">
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
      onClick={onPick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-pressed={active}
      className="v2-tile"
    >
      <span className="v2-tile-media">
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
      <span className="v2-tile-name">{card.tokens.name}</span>
      <span className="v2-tile-meta">
        {FAMILY_LABEL[card.tokens.motion.family]}
        {card.badge ? ` · ${card.badge}` : ""}
      </span>
    </button>
  );
}

function Films() {
  return (
    <div className="v2-films">
      <div className="v2-films-head" data-rv>
        <div>
          <span className="v2-label">No video at all</span>
          <h3 className="v2-h3">
            Films from a <em className="v2-serif v2-accent">brief.</em>
          </h3>
          <p className="v2-lede">
            Give a website, a recipe, two contenders or a single line. Rasika writes, scores and
            designs the whole film.
          </p>
        </div>
        <span className="v2-label">
          <span className="hidden md:inline">Hover to play · </span>Scroll for more →
        </span>
      </div>
      <ul className="v2-rail">
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
      className={cn("v2-film")}
    >
      <span className="v2-film-media">
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
        <span className="v2-film-go" aria-hidden>
          ↗
        </span>
      </span>
      <span className="v2-film-title">{kind.title}</span>
      <span className="v2-film-give">You give: {kind.youGive}</span>
    </Link>
  );
}
