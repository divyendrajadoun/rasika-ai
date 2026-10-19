"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { reelColours } from "@/components/brand/reel-fragment";
import { refreshGlass } from "@/components/motion/liquid-glass";
import { presetCards } from "@/config/presets";
import { hero as c } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Hero — "Controls on the sentence". A flat field in the chosen style's stage colour, the headline
 * on two authored lines, and three of the product's own controls beside it, each live:
 *  Style        a range over the 94 edit styles; the field, the ink and the lit word take that preset's tokens
 *  Caption pace words per minute; the words of the sentence light one by one at that pace
 *  Language     English ↔ Hindi; the sentence is set in Devanagari, as the reel would set it
 * The three controls are panes of liquid glass in a row under the sentence, lit faintly from inside
 * so they read against the flat field; the field behind them takes the chosen style's colour.
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
      // between cycles no word is lit: let the glass over the sentence re-take its picture then
      if (i === -1) window.setTimeout(() => refreshGlass("#hero"), 60);
      t = window.setTimeout(tick, i === total ? beat * 2 : beat);
    };
    t = window.setTimeout(tick, 1400);
    return () => window.clearTimeout(t);
  }, [wpm, total]);

  // the field and the sentence behind the glass changed: re-take the snapshot once the colour settles
  useEffect(() => {
    const t = window.setTimeout(() => refreshGlass("#hero"), 560);
    return () => window.clearTimeout(t);
  }, [styleIx, hindi]);

  // light stages (paper, porcelain, white) take the preset's dark ink, so every style stays readable
  const ink = contrast(colours.stage, colours.ink) >= 4.5 ? colours.ink : colours.dark;
  // the dye multiplies what lies behind: a pale one keeps the field's own colour inside the glass
  const tint = hexA(ink, 0.12);
  const field = {
    background: colours.stage,
    color: ink,
    "--chip": colours.panel,
    "--chip-ink": ink,
    "--lit": colours.accent,
    "--on": ink,
    "--on-ink": colours.stage,
  } as CSSProperties;

  let n = 0;
  return (
    <section
      id="hero"
      className="relative flex min-h-[94svh] flex-col pt-[88px] transition-[background-color,color] duration-500"
      style={field}
    >
      <div className="wrap relative flex flex-1 flex-col items-center justify-center pb-[6svh] pt-6 sm:pt-0">
        {/* the sentence, with its three controls in a row beneath it */}
        <div className="relative w-full max-w-[1120px]">

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

          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:mt-12 lg:flex lg:justify-center lg:gap-5">
            <Chip
              label={c.chips.style}
              readout={`${card.tokens.name} · ${styleIx + 1} of ${presetCards.length}`}
              tint={tint}
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
            <Chip
              label={c.chips.captions}
              readout={`${wpm} words a minute`}
              tint={tint}
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
              tint={tint}
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
          className="mx-auto mt-10 max-w-[40ch] text-center leading-normal"
          style={{ "--d": "420ms" } as CSSProperties}
        >
          {c.sub}
        </p>
        <div data-load className="mt-7 flex flex-col items-center gap-4" style={{ "--d": "480ms" } as CSSProperties}>
          <Link
            href={c.primary.href}
            className="button"
            style={{ background: ink, color: colours.stage }}
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

/** WCAG contrast ratio of two `#rrggbb` colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
    if (!m) return 0;
    const ch = [m[1]!, m[2]!, m[3]!].map((x) => {
      const v = parseInt(x, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

/** `#rrggbb` → `rgba(r, g, b, a)` for the glass dye. */
function hexA(hex: string, a: number) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(20, 6, 8, ${a})`;
  return `rgba(${parseInt(m[1]!, 16)}, ${parseInt(m[2]!, 16)}, ${parseInt(m[3]!, 16)}, ${a})`;
}

/** One of the product's control chips, as a pane of liquid glass: a label, a live readout, the control. */
function Chip({
  label,
  readout,
  tint,
  flip = false,
  className,
  children,
}: {
  label: string;
  readout: string;
  tint: string;
  /** label row at the foot (for the panes whose top lies across the letters) */
  flip?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-ui
      data-glass="chip"
      data-glass-snapshot="#hero"
      data-glass-tint={tint}
      style={{ "--glass-tint": tint } as CSSProperties}
      className={cn(
        "chip flex w-full justify-between gap-2 px-4 py-3 lg:h-[84px] lg:w-[300px]",
        flip ? "flex-col lg:flex-col-reverse" : "flex-col",
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
