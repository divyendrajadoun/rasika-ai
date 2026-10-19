"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FamilyChips, useStyleFilter } from "@/components/style-filter";
import { FAMILY_LABEL, presetCards, type PresetCard } from "@/config/presets";
import { styles as c } from "@/content/landing";
import { cn } from "@/lib/utils";

const DEMO = (id: string) => ({
  video: `/demo/styles/${id}.mp4`,
  poster: `/demo/styles/${id}.jpg`,
});
const RAW = { video: "/demo/styles/raw.mp4", poster: "/demo/styles/raw.jpg" };
const FIRST = 23;

/**
 * Proof — "Large marks on tiles". The board is the 94 real renders of one 12-second take: each tile
 * a style's demo poster that plays on hover, the first tile the heading. Pick a tile and the compare
 * plate on the left shows that style over the raw clip, split by a handle.
 */
export function StyleShowcase() {
  const [activeId, setActiveId] = useState(presetCards[0]!.tokens.id);
  const [all, setAll] = useState(false);
  const card = presetCards.find((p) => p.tokens.id === activeId) ?? presetCards[0]!;
  const filter = useStyleFilter(presetCards);
  const list = all || filter.family !== "all" || filter.query ? filter.filtered : filter.filtered.slice(0, FIRST);
  return (
    <section id="styles" className="section wrap scroll-mt-6">
      <div className="grid12 items-start">
        <div className="col-span-12 lg:sticky lg:top-6 lg:col-span-4">
          <Compare card={card} />
        </div>
        <div className="col-span-12 mt-12 min-w-0 lg:col-start-5 lg:col-span-8 lg:mt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <FamilyChips counts={filter.counts} total={presetCards.length} value={filter.family} onChange={filter.setFamily} />
            <label className="sr-only" htmlFor="style-search">
              Search styles
            </label>
            <input
              id="style-search"
              type="search"
              placeholder="Search a look"
              value={filter.query}
              onChange={(e) => filter.setQuery(e.target.value)}
              className="input h-11 md:max-w-[240px]"
            />
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <li className="col-span-2 flex flex-col justify-between p-6" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>
              <h2 className="text-[clamp(2rem,3vw,3rem)] font-semibold leading-[0.98] tracking-[-0.03em]">{c.title}</h2>
              <p className="mt-6 max-w-[30ch]">{c.sub}</p>
            </li>
            {list.map((p) => (
              <li key={p.tokens.id}>
                <StyleTile card={p} active={p.tokens.id === activeId} onPick={() => setActiveId(p.tokens.id)} />
              </li>
            ))}
          </ul>
          {!all && filter.family === "all" && !filter.query && filter.filtered.length > FIRST && (
            <button type="button" onClick={() => setAll(true)} className="button button-ghost mt-6 w-full sm:w-auto">
              Show all {presetCards.length} styles
            </button>
          )}
          <p className="text-muted mt-8 max-w-[62ch]">{c.note2}</p>
          <p className="text-muted small mt-4 max-w-[62ch]">{c.note}</p>
        </div>
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
