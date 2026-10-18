"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { PhoneMockup } from "@/components/brand/phone-mockup";
import { Section } from "@/components/brand/section";
import { presetCards } from "@/config/presets";
import { industries as c } from "@/content/landing";
import portraits from "@/content/portraits.json";

const PORTRAITS = portraits as Record<
  string,
  { src: string; width: number; height: number; color: string }
>;

type Item = (typeof c.items)[number];

/**
 * "Every industry" — an editorial index (01 · REAL ESTATE …) on the left; on the right a phone
 * playing a REAL render (the engine's output on a real take) in the style we suggest for that
 * industry, with the beat Rasika would design from the speaker's words underneath.
 */
export function Industries() {
  const [active, setActive] = useState(0);
  const item = c.items[active]!;
  const baseId = useId();
  const preset = presetCards.find((p) => p.tokens.id === item.preset) ?? presetCards[0]!;

  return (
    <Section id="industries" eyebrow={c.eyebrow} title={c.title} sub={c.sub} tone="maroon">
      <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div className="min-w-0">
          <div
            role="tablist"
            aria-label="Industries"
            className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0 lg:overflow-visible lg:px-0"
          >
            {c.items.map((it, i) => {
              const on = i === active;
              return (
                <div key={it.id} className="lg:border-gold/20 snap-start lg:border-b">
                  <button
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${it.id}`}
                    aria-selected={on}
                    aria-controls={`${baseId}-panel`}
                    onClick={() => setActive(i)}
                    className={
                      "group flex w-full shrink-0 items-baseline gap-3 rounded-full px-4 py-2 text-left transition lg:rounded-none lg:px-0 lg:py-4 " +
                      (on
                        ? "bg-gold/15 text-gold lg:bg-transparent"
                        : "text-iv/70 hover:text-iv lg:hover:bg-transparent")
                    }
                  >
                    {PORTRAITS[it.id] && (
                      // eslint-disable-next-line @next/next/no-img-element -- static portrait
                      <img
                        src={PORTRAITS[it.id]!.src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={40}
                        height={40}
                        className={
                          "size-8 shrink-0 self-center rounded-full object-cover object-top ring-1 transition lg:size-10 " +
                          (on ? "ring-gold" : "opacity-80 ring-white/20 group-hover:opacity-100")
                        }
                        style={{ background: PORTRAITS[it.id]!.color }}
                      />
                    )}
                    <span className="kicker shrink-0 text-[0.6rem] opacity-70">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="poster whitespace-nowrap text-xl sm:text-2xl lg:text-4xl">
                      {it.label}
                    </span>
                    <span className="font-accent hidden text-lg italic opacity-70 lg:inline">
                      {it.who}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          <Beat key={item.id} item={item} />

          <Link
            href={`/dashboard/new?industry=${item.id}&style=${preset.tokens.id}`}
            className="btn-outline-gold mt-6 inline-flex"
          >
            Start a {item.label.toLowerCase()} reel in {preset.tokens.name}
          </Link>
        </div>

        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          className="mx-auto w-full min-w-0 max-w-[300px] sm:max-w-[330px]"
        >
          <RealDemo key={preset.tokens.id} presetId={preset.tokens.id} name={preset.tokens.name} />
          <p className="kicker text-gold/70 mt-3 text-center text-[0.6rem]">
            {item.who} · suggested style: {preset.tokens.name}
          </p>
          <p className="text-iv/55 mt-2 text-center text-xs">{c.realNote}</p>
        </div>
      </div>
    </Section>
  );
}

/** The beat Rasika designs from this industry's sentence: poster lines, the counter, a chapter. */
function Beat({ item }: { item: Item }) {
  const n = useCounter(item.counter.from, item.counter.to);
  const photo = PORTRAITS[item.id];
  return (
    <div className="border-gold/20 bg-ink/40 mt-8 rounded-2xl border p-5">
      <div className="flex items-start gap-4">
        {photo && (
          <div className="polaroid w-24 shrink-0 !p-1 !pb-3 sm:w-28">
            {/* eslint-disable-next-line @next/next/no-img-element -- static portrait */}
            <img
              src={photo.src}
              alt={`${item.who}: the kind of person this beat is designed for`}
              loading="lazy"
              decoding="async"
              width={photo.width}
              height={photo.height}
              className="aspect-[4/5] w-full rounded-sm object-cover"
              style={{ background: photo.color }}
            />
          </div>
        )}
        <p className="font-accent text-iv/85 text-2xl italic leading-snug">{item.line}</p>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-4">
        <div>
          <p className="kicker text-gold/70 text-[0.55rem]">Poster above the head</p>
          <p className="poster text-iv mt-1 text-2xl leading-none">{item.poster[0]}</p>
          <p className="poster text-gold text-4xl leading-none">{item.poster[1]}</p>
          <p className="font-accent text-iv/80 text-xl italic">{item.poster[2]}</p>
        </div>
        <div className="text-right">
          <p className="kicker text-gold/70 text-[0.55rem]">Counter</p>
          <p className="poster text-ter text-4xl tabular-nums leading-none">
            {n.toLocaleString("en-IN")}
            {item.counter.suffix}
          </p>
          <p className="kicker text-iv/60 text-[0.5rem]">{item.counter.label}</p>
          <span className="kicker bg-gold text-ink mt-2 inline-block rounded-sm px-1.5 py-0.5 text-[0.5rem]">
            {item.chapter}
          </span>
        </div>
      </div>
      <p className="text-iv/60 mt-4 text-sm">
        The number becomes a counter, the ordinal a chapter, the thing you name a photo on that
        word. Caption: <span className="text-gold">{item.caption}</span>.
      </p>
    </div>
  );
}

function RealDemo({ presetId, name }: { presetId: string; name: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => (e?.isIntersecting ? void v.play().catch(() => undefined) : v.pause()),
      { threshold: 0.3 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <PhoneMockup>
      <video
        ref={ref}
        src={`/demo/styles/${presetId}.mp4`}
        poster={`/demo/styles/${presetId}.jpg`}
        muted
        loop
        playsInline
        preload="none"
        className="absolute inset-0 h-full w-full object-cover"
        aria-label={`A real take rendered in the ${name} style`}
      />
    </PhoneMockup>
  );
}

/** Counts from → to with outQuint easing, restarting whenever the target changes. */
function useCounter(from: number, to: number, ms = 1300): number {
  const [n, setN] = useState(from);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setN(to);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - p, 5);
      setN(Math.round(from + (to - from) * e));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [from, to, ms]);
  return n;
}
