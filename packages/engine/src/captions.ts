/**
 * Captions — one word at a time, pop-in, emphasis classes, auto Mukta for Devanagari,
 * max hold 0.85 s. Pure data side here; the DOM write happens in engine.ts.
 */
import type { Captions, TranscriptWord } from "@rasika/schema";
import { E, prog } from "./toolkit";

export interface CaptionWindow {
  txt: string;
  t: number;
  end: number;
  /** karaoke / box / clean: the words of the group with their own start times */
  words?: Array<{ txt: string; t: number }>;
}

export type CaptionStyle = "one-word" | "phrase" | "karaoke" | "box" | "clean" | "off";

const STRIP = /[.,?!]/g;
export const MAX_HOLD = 0.85;

/** The reference `CW` table: strip punctuation, hold until the next word or 0.85 s. */
export function captionWindows(
  words: readonly TranscriptWord[],
  style: CaptionStyle = "one-word",
): CaptionWindow[] {
  if (style === "off") return [];
  if (style === "karaoke" || style === "box") return groupWindows(words, 3, 1.4, true);
  if (style === "clean") return groupWindows(words, 7, 3.2, false);
  if (style === "one-word") {
    return words.map((w, i) => {
      const nx = words[i + 1] ? words[i + 1]!.t : w.t + 0.8;
      return { txt: w.w.replace(STRIP, ""), t: w.t, end: Math.min(nx, w.t + MAX_HOLD) };
    });
  }
  // phrase: up to 3 words that start within 1.2 s of each other
  const out: CaptionWindow[] = [];
  let i = 0;
  while (i < words.length) {
    const start = words[i]!;
    let j = i;
    while (
      j + 1 < words.length &&
      j - i < 2 &&
      words[j + 1]!.t - start.t < 1.2 &&
      !/[.?!]$/.test(words[j]!.w)
    ) {
      j++;
    }
    const nx = words[j + 1] ? words[j + 1]!.t : words[j]!.t + 0.8;
    out.push({
      txt: words
        .slice(i, j + 1)
        .map((w) => w.w.replace(STRIP, ""))
        .join(" "),
      t: start.t,
      end: Math.min(nx, words[j]!.t + MAX_HOLD),
    });
    i = j + 1;
  }
  return out;
}

/**
 * Groups of up to `max` words that start within `span` s; a group ends at sentence punctuation.
 * Karaoke/box groups hold until the next group (no gap); clean sentences hold until the next.
 */
function groupWindows(
  words: readonly TranscriptWord[],
  max: number,
  span: number,
  stripPunct: boolean,
): CaptionWindow[] {
  const out: CaptionWindow[] = [];
  let i = 0;
  while (i < words.length) {
    const start = words[i]!;
    let j = i;
    while (
      j + 1 < words.length &&
      j - i < max - 1 &&
      words[j + 1]!.t - start.t < span &&
      !/[.?!]$/.test(words[j]!.w)
    ) {
      j++;
    }
    const nx = words[j + 1] ? words[j + 1]!.t : words[j]!.t + 0.8;
    const grp = words.slice(i, j + 1).map((w) => ({
      txt: stripPunct ? w.w.replace(STRIP, "") : w.w,
      t: w.t,
    }));
    out.push({
      txt: grp.map((g) => g.txt).join(" "),
      t: start.t,
      end: Math.min(nx, words[j]!.t + (stripPunct ? MAX_HOLD : 1.6)),
      words: grp,
    });
    i = j + 1;
  }
  return out;
}

export const DEVANAGARI = /[ऀ-ॿ]/;

export interface CaptionState {
  txt: string;
  cls: "" | "g" | "r";
  hindi: boolean;
  s: number;
  y: number;
  /** group styles: the words and which one is being spoken now */
  words?: Array<{ txt: string; on: boolean }>;
}

export function captionAt(
  cw: readonly CaptionWindow[],
  caps: Pick<Captions, "gold" | "accent">,
  t: number,
): CaptionState | null {
  let w: CaptionWindow | null = null;
  for (const c of cw) {
    if (t >= c.t - 0.03 && t < c.end) w = c;
    if (c.t > t) break;
  }
  if (!w) return null;
  const k = normaliseKey(w.txt);
  const cls = caps.gold.some((g) => normaliseKey(g) === k)
    ? "g"
    : caps.accent.some((r) => normaliseKey(r) === k)
      ? "r"
      : "";
  const p = prog(t, w.t - 0.03, w.t + 0.16, E.outBack);
  const state: CaptionState = {
    txt: w.txt,
    cls,
    hindi: DEVANAGARI.test(w.txt),
    s: 0.72 + 0.28 * p,
    y: (1 - p) * 18,
  };
  if (w.words) {
    let on = 0;
    for (let i = 0; i < w.words.length; i++) if (t >= w.words[i]!.t - 0.03) on = i;
    state.words = w.words.map((g, i) => ({ txt: g.txt, on: i === on }));
    state.cls = "";
  }
  return state;
}

export function normaliseKey(s: string): string {
  return s
    .toLowerCase()
    .replace(STRIP, "")
    .replace(/[’']s$/, "");
}
