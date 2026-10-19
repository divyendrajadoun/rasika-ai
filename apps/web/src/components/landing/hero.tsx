"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { reelColours } from "@/components/brand/reel-fragment";
import { Nav } from "@/components/landing/nav";
import { presetCards } from "@/config/presets";
import { hero as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Hero — "Controls on the sentence". A flat field in the chosen style's stage colour, the headline
 * on two authored lines, and three of the product's own controls beside it, each live:
 *  Style        a range over the 93 presets; the field, the ink and the lit word take that preset's tokens
 *  Caption pace words per minute; the words of the sentence light one by one at that pace
 *  Language     English ↔ Hindi; the sentence is set in Devanagari, as the reel would set it
 * The headline is in the HTML and painted on the first frame; the masked line rise only adds arrival.
 */
export function Hero() {
  const [styleIx, setStyleIx] = useState(0);
  const [wpm, setWpm] = useState(150);
  const [hindi, setHindi] = useState(false);
  const [lit, setLit] = useState(-1);

  const card = presetCards[styleIx] ?? presetCards[0]!;
  const colours = useMemo(() => reelColours(card.tokens), [card]);
  const lines = hindi ? c.hindiLines : c.lines;
  const words = useMemo(() => lines.map((l) => l.split(" ")), [lines]);
  const total = words[0]!.length + words[1]!.length;

  // the caption clock: one word per beat, a pause after the sentence, then again
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const beat = 60000 / wpm;
    let i = -1;
    let t = 0;
    const tick = () => {
      i = i + 1;
      if (i >= total + 3) i = -1;
      setLit(i);
      t = window.setTimeout(tick, i === total ? beat * 2 : beat);
    };
    t = window.setTimeout(tick, 1400);
    return () => window.clearTimeout(t);
  }, [wpm, total]);

  const field = {
    background: colours.stage,
    color: colours.ink,
    "--chip": colours.panel,
    "--chip-ink": colours.ink,
    "--lit": colours.accent,
    "--on": colours.ink,
    "--on-ink": colours.stage,
  } as CSSProperties;

  let n = 0;
  return (
    <section
      className="relative flex min-h-[94svh] flex-col transition-[background-color,color] duration-500"
      style={field}
    >
      <Nav />
      <div className="wrap relative flex flex-1 flex-col items-center justify-center pb-[6svh] pt-6 sm:pt-0">
        {/* the sentence, with the controls around it */}
        <div className="relative w-full max-w-[1120px]">
          <Chip
            label={c.chips.style}
            readout={`${card.tokens.name} · ${styleIx + 1} of ${presetCards.length}`}
            className="lg:absolute lg:-top-[88px] lg:left-[2%] lg:-rotate-2"
          >
            <input
              type="range"
              min={0}
              max={presetCards.length - 1}
              value={styleIx}
              onChange={(e) => setStyleIx(Number(e.target.value))}
              aria-label="Style preset"
              aria-valuetext={card.tokens.name}
              className="chip-range"
            />
          </Chip>

          <h1
            className={cn(
              "lines display mx-auto text-center",
              hindi ? "font-devanagari" : undefined,
            )}
            style={{ fontSize: "clamp(2.3rem, 9.4vw, 7.4rem)", lineHeight: 1, letterSpacing: hindi ? 0 : "-0.04em" }}
            lang={hindi ? "hi" : "en"}
          >
            {lines.map((line, li) => (
              <span key={line} className="line">
                <span data-line style={{ "--i": li } as CSSProperties}>
                  {words[li]!.map((w, wi) => {
                    const k = n++;
                    return (
                      <span
                        key={`${li}-${wi}`}
                        className="inline-block transition-colors duration-150"
                        style={{ color: lit === k ? colours.accent : undefined }}
                      >
                        {w}
                        {wi < words[li]!.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </span>
              </span>
            ))}
          </h1>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-0 lg:block">
            <Chip
              label={c.chips.captions}
              readout={`${wpm} words a minute`}
              className="lg:absolute lg:-bottom-[100px] lg:left-[3%] lg:rotate-[2.5deg]"
            >
              <input
                type="range"
                min={90}
                max={240}
                step={10}
                value={wpm}
                onChange={(e) => setWpm(Number(e.target.value))}
                aria-label="Caption pace, words a minute"
                className="chip-range"
              />
            </Chip>
            <Chip
              label={c.chips.hindi}
              readout={hindi ? "हिन्दी · Devanagari" : "English"}
              className="lg:absolute lg:-bottom-[100px] lg:right-[3%] lg:rotate-[-2deg]"
            >
              <div className="chip-switch" role="group" aria-label="Language">
                <button type="button" aria-pressed={!hindi} onClick={() => setHindi(false)}>
                  English
                </button>
                <button type="button" aria-pressed={hindi} onClick={() => setHindi(true)} lang="hi">
                  हिन्दी
                </button>
              </div>
            </Chip>
          </div>
        </div>

        <p
          data-load
          className="mx-auto mt-10 max-w-[40ch] text-center leading-normal lg:mt-[136px]"
          style={{ "--d": "420ms" } as CSSProperties}
        >
          {c.sub}
        </p>
        <div data-load className="mt-7 flex flex-col items-center gap-4" style={{ "--d": "480ms" } as CSSProperties}>
          <Link
            href={c.primary.href}
            className="button"
            style={{ background: colours.ink, color: colours.stage }}
          >
            {c.primary.label}
          </Link>
          <p className="small text-center opacity-80">
            {c.trust.join(" · ")} ·{" "}
            <a href={c.secondary.href} className="link">
              {c.secondary.label}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

/** One of the product's control chips: a label, a live readout and the control itself. */
function Chip({
  label,
  readout,
  className,
  children,
}: {
  label: string;
  readout: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-ui
      className={cn(
        "chip z-[2] flex w-full flex-col justify-between gap-2 px-4 py-3 lg:h-[84px] lg:w-[300px]",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3 text-[14px] leading-none">
        <span className="font-medium">{label}</span>
        <span className="truncate opacity-80">{readout}</span>
      </div>
      {children}
    </div>
  );
}
