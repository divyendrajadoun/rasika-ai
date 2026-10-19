"use client";

import { useEffect, useRef, useState } from "react";
import { ReelFragment } from "@/components/brand/reel-fragment";
import { presetCards } from "@/config/presets";
import { showcase as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Showcase — "Headline you can type". The section's headline is a real input holding a spoken line.
 * Under it, at true size, the product's answer: that line set in the chosen style's own tokens (the
 * poster type, the caption, the lit word), updating as you type. Three more lines refill it.
 */
export function Showcase() {
  const [line, setLine] = useState(c.initial);
  const [styleId, setStyleId] = useState(c.styleIds[0]!);
  const [lit, setLit] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const card = presetCards.find((p) => p.tokens.id === styleId) ?? presetCards[0]!;
  const n = line.trim().split(/\s+/).filter(Boolean).length || 1;

  // the caption clock runs only while the section is on screen
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let t = 0;
    const start = () => {
      window.clearInterval(t);
      t = window.setInterval(() => setLit((i) => (i + 1) % n), 420);
    };
    const io = new IntersectionObserver(
      ([e]) => (e?.isIntersecting ? start() : window.clearInterval(t)),
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(t);
    };
  }, [n]);

  return (
    <section ref={ref} id="showcase" className="wrap section-tight">
      <h2 className="sr-only">{c.title}</h2>
      <div data-ui className="w-full">
        <label htmlFor="say" className="sr-only">
          A line you would say to camera
        </label>
        <input
          id="say"
          type="text"
          value={line}
          onChange={(e) => setLine(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          maxLength={80}
          className="say w-full bg-transparent font-semibold"
          style={{
            fontSize: "clamp(1.9rem, 8vw, 8.25rem)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            caretColor: "var(--accent)",
          }}
        />
      </div>

      <div className="mt-10 flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        <div className="w-full max-w-[560px]">
          <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Style">
            {c.styleIds.map((id) => {
              const p = presetCards.find((x) => x.tokens.id === id);
              if (!p) return null;
              const on = id === styleId;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setStyleId(id)}
                  className={cn("link h-11", on ? "text-text font-medium underline" : "text-muted")}
                >
                  {p.tokens.name}
                </button>
              );
            })}
          </div>
          <ReelFragment
            key={card.tokens.id}
            tokens={card.tokens}
            line={line.trim() || c.initial}
            lit={lit}
            className="mt-4 w-full max-w-[360px]"
          />
        </div>
        <div className="max-w-[40ch] lg:pt-14">
          <p className="text-muted">{c.note}</p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 lg:flex-col lg:gap-y-3" aria-label="Try another line">
            {c.examples.map((ex) => (
              <li key={ex}>
                <button type="button" onClick={() => setLine(ex)} className="link h-11 text-left font-medium">
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
