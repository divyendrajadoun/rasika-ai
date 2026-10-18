"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Section } from "@/components/brand/section";
import { industries as c } from "@/content/landing";
import "@/styles/demos.css";

const v = (o: Record<string, number | string>) => o as CSSProperties;
type Item = (typeof c.items)[number];

/**
 * "Every industry" — an editorial index on the left (01 · REAL ESTATE …) and a live mini stage on
 * the right that re-plays the beat for the chosen industry: poster lines rising, a counter rolling
 * in, a polaroid landing on the word, a one-word caption. Pure CSS loops + one counter effect.
 */
export function Industries() {
  const [active, setActive] = useState(0);
  const item = c.items[active]!;
  const baseId = useId();

  return (
    <Section id="industries" eyebrow={c.eyebrow} title={c.title} sub={c.sub} tone="maroon">
      <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* index */}
        <div className="min-w-0">
          <ol
            role="tablist"
            aria-label="Industries"
            className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0 lg:overflow-visible lg:px-0"
          >
            {c.items.map((it, i) => {
              const on = i === active;
              return (
                <li key={it.id} className="lg:border-gold/20 snap-start lg:border-b">
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
                </li>
              );
            })}
          </ol>
          <p className="font-accent text-iv/85 mt-8 max-w-md text-2xl italic leading-snug">
            {item.line}
          </p>
          <p className="text-iv/60 mt-3 text-sm">
            That is the whole brief. Rasika hears the number, the ordinal and the thing you name,
            and builds the beat around them.
          </p>
          <Link
            href={`/dashboard/new?industry=${item.id}`}
            className="btn-outline-gold mt-6 inline-flex"
          >
            Start a {item.label.toLowerCase()} reel
          </Link>
        </div>

        {/* stage */}
        <div
          id={`${baseId}-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${item.id}`}
          className="mx-auto w-full min-w-0 max-w-[320px]"
        >
          <Stage key={item.id} item={item} />
          <p className="kicker text-gold/70 mt-3 text-center text-[0.6rem]">
            {item.who} · designed from the words
          </p>
        </div>
      </div>
    </Section>
  );
}

function Stage({ item }: { item: Item }) {
  const n = useCounter(item.counter.from, item.counter.to);
  return (
    <div className="demo" data-play>
      <div className="d-stage shadow-[0_40px_90px_rgba(0,0,0,.45)] ring-1 ring-black/20">
        {/* poster type above the head */}
        <div className="absolute inset-x-3 top-[5%] text-center">
          <div className="d-mask">
            <span
              className="d-rise poster text-mar text-[13px]"
              style={v({ "--i": 0, "--dur": "5s" })}
            >
              {item.poster[0]}
            </span>
          </div>
          <div className="d-mask">
            <span
              className="d-rise poster text-ter text-[30px] leading-none"
              style={v({ "--i": 1, "--dur": "5s" })}
            >
              {item.poster[1]}
            </span>
          </div>
          <div className="d-mask">
            <span
              className="d-rise font-accent text-goldd text-[15px] italic"
              style={v({ "--i": 2, "--dur": "5s" })}
            >
              {item.poster[2]}
            </span>
          </div>
        </div>
        {/* rolling counter, bottom-left of the free zone */}
        <div className="absolute left-3 top-[31%] text-left">
          <div className="poster text-ter text-[26px] tabular-nums leading-none">
            {n.toLocaleString("en-IN")}
            {item.counter.suffix}
          </div>
          <div className="kicker text-mar/80 text-[7px]">{item.counter.label}</div>
        </div>
        {/* chapter stamp */}
        <div className="absolute right-3 top-[31%]">
          <span className="kicker bg-mar text-iv rounded-sm px-1.5 py-0.5 text-[7px]">
            {item.chapter}
          </span>
        </div>
        {/* polaroid landing on the word */}
        <div
          className="d-polaroid absolute right-2 top-[42%] w-[44%]"
          style={v({ "--tilt": "6deg" })}
        >
          <div className="polaroid !p-1 !pb-4">
            <div className="aspect-[4/5] w-full rounded-sm bg-[linear-gradient(135deg,#c8452f,#9a6a14)] opacity-90" />
            <p className="poster text-mar mt-1 text-center text-[8px]">{item.card}</p>
          </div>
        </div>
        <div className="d-head" />
        {/* one-word caption */}
        <div className="absolute inset-x-0 bottom-[20%] text-center">
          <span className="d-cap-once caption-red text-[16px]">{item.caption}</span>
        </div>
        <div className="absolute inset-x-0 bottom-[3%] text-center">
          <span className="kicker text-mar/60 text-[6px]">rasika · 1080 × 1920</span>
        </div>
      </div>
    </div>
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
