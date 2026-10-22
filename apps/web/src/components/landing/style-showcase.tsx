"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FilmTile } from "@/components/landing/brief-films";
import { BRIEF_KINDS } from "@/config/briefs";
import { FAMILY_LABEL, demoSrc, presetCards, type PresetCard } from "@/config/presets";
import { STYLE_COUNT, styles as c } from "@/content/landing";
import { cn } from "@/lib/utils";

const DEMO = (id: string) => ({
  video: demoSrc(id, "mp4"),
  poster: demoSrc(id, "jpg"),
});
const RAW = { video: "/demo/styles/raw.mp4", poster: "/demo/styles/raw.jpg" };

/** The four looks on show (the full grid of every style lives in the wizard). */
const PICKS = ["launch-spotlight", "mikku-royal", "katana-pop", "vox-paper"];

/**
 * Examples — one section, two answers. "From your video": four real renders of the same 12-second
 * take, the chosen one over the raw clip on the compare plate (drag the handle). "No video at all":
 * a rail of films made from a brief, each a real render that plays on hover and opens the wizard
 * on that kind of film.
 */
export function StyleShowcase() {
  const cards = PICKS.map((id) => presetCards.find((p) => p.tokens.id === id)).filter(
    (p): p is PresetCard => Boolean(p),
  );
  const [activeId, setActiveId] = useState(cards[0]!.tokens.id);
  const card = cards.find((p) => p.tokens.id === activeId) ?? cards[0]!;
  return (
    <section id="styles" className="section wrap scroll-mt-6">
      <div className="max-w-[46rem]">
        <p className="label">Examples</p>
        <h2 className="head mt-2">Same take. Different reel. Or no take at all.</h2>
        <p className="text-muted mt-4 max-w-[52ch]">
          Every clip here is real Rasika output. Pick a look to see it over the raw phone video, or
          scroll the films made from nothing but a brief.
        </p>
      </div>

      <div className="grid12 mt-12 items-start">
        <div className="col-span-12 lg:sticky lg:top-6 lg:col-span-4">
          <Compare card={card} />
        </div>
        <div className="col-span-12 mt-10 min-w-0 lg:col-start-6 lg:col-span-7 lg:mt-0">
          <p className="label">From your video · {STYLE_COUNT} styles, here are four</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((p) => (
              <li key={p.tokens.id}>
                <StyleTile card={p} active={p.tokens.id === activeId} onPick={() => setActiveId(p.tokens.id)} />
              </li>
            ))}
          </ul>
          <Link href="/dashboard/new" className="button button-ghost mt-6">
            See all {STYLE_COUNT} styles when you make a reel
          </Link>
        </div>
      </div>

      <div className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">No video at all</p>
            <h3 className="mt-2 text-[clamp(1.6rem,1.2rem+1.6vw,2.4rem)] font-semibold leading-tight tracking-[-0.02em]">
              Films from a brief
            </h3>
            <p className="text-muted mt-2 max-w-[56ch]">
              Give a website, a recipe, two contenders or a single line. Rasika writes, scores and
              designs the whole film.
            </p>
          </div>
          <p className="text-muted small">
            <span className="hidden md:inline">Hover to play · </span>Scroll for more →
          </p>
        </div>
        <ul className="films-rail mt-6">
          {BRIEF_KINDS.map((k) => (
            <li key={k.id}>
              <FilmTile kind={k} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Compare({ card }: { card: PresetCard }) {
  const [pos, setPos] = useState(58);
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
    <div className="mx-auto w-full max-w-[380px]">
      <div
        data-ui
        id="style-frame"
        ref={frameRef}
        className="relative aspect-[9/16] cursor-ew-resize select-none overflow-clip bg-[#111]"
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
        <img src={RAW.poster} alt="" draggable={false} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <video ref={rawRef} src={RAW.video} poster={RAW.poster} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label="Raw phone clip" />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clip */}
          <img src={demo.poster} alt="" draggable={false} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <video ref={styleRef} src={demo.video} poster={demo.poster} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={`${card.tokens.name} edit`} />
        </div>
        <div aria-hidden className="compare-handle" style={{ left: `${pos}%` }} />
        <div
          aria-hidden
          data-glass="knob"
          data-glass-snapshot="#style-frame"
          className="compare-knob"
          style={{ left: `${pos}%` }}
        />
        <span data-glass="tag" data-glass-snapshot="#style-frame" className="compare-tag left-3">
          Raw
        </span>
        <span data-glass="tag" data-glass-snapshot="#style-frame" className="compare-tag right-3">
          {card.tokens.name}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button type="button" onClick={toggle} className="link h-11 font-medium" aria-pressed={playing}>
          {playing ? "Pause" : "Play"}
        </button>
        <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="chip-range flex-1" aria-label="Reveal the styled version" />
      </div>
      <p className="mt-4 font-medium leading-snug">{card.tokens.name}</p>
      <p className="text-muted mt-1">{card.tokens.tagline}</p>
      <Link href={`/dashboard/new?style=${card.tokens.id}`} className="button button-accent mt-5 w-full">
        {c.ctaLabel}
      </Link>
    </div>
  );
}

function StyleTile({ card, active, onPick }: { card: PresetCard; active: boolean; onPick: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const demo = DEMO(card.tokens.id);
  // the clip is attached on first hover/focus so every tile costs a lazy poster, not a video
  const play = () => {
    const v = vid.current;
    if (!v) return;
    if (!v.src) v.src = demo.video;
    void v.play().catch(() => undefined);
  };
  const stop = () => {
    const v = vid.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };
  return (
    <button
      type="button"
      onClick={onPick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-pressed={active}
      className={cn("tile group flex h-full w-full flex-col text-left", active && "is-active")}
    >
      <div className="relative aspect-[9/16] w-full overflow-clip bg-[#111]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img src={demo.poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <video
          ref={vid}
          poster={demo.poster}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
          tabIndex={-1}
        />
      </div>
      <div className="flex flex-1 flex-col px-3 pb-3 pt-2">
        <span className="font-medium leading-snug">{card.tokens.name}</span>
        <span className="text-muted small mt-0.5">
          {FAMILY_LABEL[card.tokens.motion.family]}
          {card.badge ? ` · ${card.badge}` : ""}
        </span>
      </div>
    </button>
  );
}
