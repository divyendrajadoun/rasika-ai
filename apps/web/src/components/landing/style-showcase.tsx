"use client";

import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PhoneMockup } from "@/components/brand/phone-mockup";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/brand/section";
import { presetCards, type PresetCard } from "@/config/presets";
import { styles as c } from "@/content/landing";

const DEMO = (id: string) => ({
  video: `/demo/styles/${id}.mp4`,
  poster: `/demo/styles/${id}.jpg`,
});
const RAW = { video: "/demo/styles/raw.mp4", poster: "/demo/styles/raw.jpg" };

/**
 * Styles — the same 12 seconds of a real take rendered by the engine in every preset.
 * Left: a phone with the raw clip underneath and the chosen style on top, split by a draggable
 * divider, both playing in sync. Right: the style index; hovering a card plays its loop.
 */
export function StyleShowcase() {
  const [active, setActive] = useState(0);
  const card = presetCards[active]!;
  return (
    <Section id="styles" eyebrow={c.eyebrow} title={c.title} sub={c.sub} tone="maroon">
      <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[400px_1fr] lg:gap-14">
        <Reveal
          kind="card"
          className="mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:sticky lg:top-24"
        >
          <Compare key={card.tokens.id} card={card} />
        </Reveal>
        <div className="min-w-0">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {presetCards.map((p, i) => (
              <li key={p.tokens.id}>
                <StyleCard card={p} active={i === active} onPick={() => setActive(i)} index={i} />
              </li>
            ))}
          </ul>
          <p className="text-iv/60 mt-6 max-w-2xl text-sm">{c.note}</p>
        </div>
      </div>
    </Section>
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
    <div>
      <PhoneMockup>
        <div
          ref={frameRef}
          className="absolute inset-0 cursor-ew-resize select-none"
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setFromClientX(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && setFromClientX(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clips */}
          <img
            src={RAW.poster}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <video
            ref={rawRef}
            src={RAW.video}
            muted
            loop
            playsInline
            preload="none"
            className="absolute inset-0 h-full w-full object-cover"
            aria-label="Raw phone clip"
          />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- lazy poster under the clip */}
            <img
              src={demo.poster}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              ref={styleRef}
              src={demo.video}
              muted
              loop
              playsInline
              preload="none"
              className="absolute inset-0 h-full w-full object-cover"
              aria-label={`${card.tokens.name} edit`}
            />
          </div>
          <div
            className="bg-gold pointer-events-none absolute bottom-0 top-0 w-[2px] shadow-[0_0_0_1px_rgba(0,0,0,.35)]"
            style={{ left: `${pos}%` }}
          >
            <span className="bg-gold text-ink absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold shadow-lg">
              ⇔
            </span>
          </div>
          <span className="kicker absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[0.55rem] text-white">
            Raw
          </span>
          <span className="kicker absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[0.55rem] text-white">
            {card.tokens.name}
          </span>
        </div>
      </PhoneMockup>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          className="border-gold/40 text-gold hover:bg-gold/10 inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs"
          aria-pressed={playing}
        >
          {playing ? (
            <Pause className="size-3.5" aria-hidden />
          ) : (
            <Play className="size-3.5" aria-hidden />
          )}
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="accent-gold flex-1"
          aria-label="Reveal the styled version"
        />
      </div>
      <p className="font-accent text-iv/80 mt-3 text-center text-lg italic">
        {card.tokens.tagline}
      </p>
      <Link
        href={`/dashboard/new?style=${card.tokens.id}`}
        className="btn-ter mt-3 flex w-full justify-center"
      >
        {c.ctaLabel}: {card.tokens.name}
      </Link>
    </div>
  );
}

function StyleCard({
  card,
  active,
  onPick,
  index,
}: {
  card: PresetCard;
  active: boolean;
  onPick: () => void;
  index: number;
}) {
  const vid = useRef<HTMLVideoElement>(null);
  const demo = DEMO(card.tokens.id);
  // the clip is attached on first hover/focus so 14 cards cost 14 lazy posters, not 14 videos
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
      className={
        "group relative w-full overflow-hidden rounded-2xl text-left transition " +
        (active
          ? "ring-gold shadow-[0_20px_60px_rgba(0,0,0,.45)] ring-2"
          : "ring-1 ring-white/10 hover:ring-white/30")
      }
    >
      <div className="relative aspect-[9/16] w-full bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img
          src={demo.poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={vid}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
          tabIndex={-1}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
          <p className="kicker text-[0.55rem] text-white/60">
            {String(index + 1).padStart(2, "0")}
          </p>
          <p className="poster text-lg leading-none text-white">{card.tokens.name}</p>
          <p className="mt-1 line-clamp-2 text-[11px] text-white/70">{card.tokens.tagline}</p>
        </div>
        {card.badge && (
          <span className="kicker bg-gold text-ink absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.5rem]">
            {card.badge}
          </span>
        )}
      </div>
    </button>
  );
}
