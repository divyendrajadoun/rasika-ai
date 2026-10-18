/**
 * validatePlan(plan, transcript, opts) — SPEC §6.3 validation layer.
 *
 * Runs after the planner and after every user edit. Repairs what it can (nudges times, shrinks
 * fonts, sorts modes, fills zoom points), reports the rest. Pure: no DOM. Text measurement is
 * injected (`measureText`) so the browser can pass canvas metrics and headless the same font
 * metrics; without it a per-font average-advance heuristic is used.
 */
import { z } from "zod";
import {
  ColorToken,
  Plan,
  type PlanElement,
  type PlanInput,
  type Rect,
  type TextFont,
  type TranscriptWord,
  type VideoModeName,
} from "./plan";

export type IssueLevel = "error" | "warn" | "fixed";
export interface PlanIssue {
  level: IssueLevel;
  code: string;
  message: string;
  elementId?: string;
  path?: string;
}

export interface ValidateOptions {
  /** imageIds the project owns; omit to skip the existence check. */
  imageIds?: readonly string[];
  /** Text width in px for `text` set in `font` at `size` px. Optional. */
  measureText?: (text: string, font: TextFont, size: number, tracking?: number) => number;
  /** Tolerance for anchor snapping (s). */
  anchorTolerance?: number;
  /** Elements further than this from any word are reported rather than nudged (s). */
  maxNudge?: number;
  /** Warn when one layout holds longer than this (s). */
  maxLayoutSec?: number;
}

export interface ValidateResult {
  ok: boolean;
  plan: Plan;
  issues: PlanIssue[];
}

const STAGE_W = 1080;
const CARD_TOP_LIMIT = 680;
const SIDE_MARGIN = 40;
const MIN_FONT = 24;

/** Average advance per character in em, per font role (uppercase-heavy copy). */
const AVG_ADVANCE: Record<TextFont, number> = {
  anton: 0.45,
  serif: 0.4,
  kicker: 0.68,
  devanagari: 0.56,
};
const NARROW = /[ Iil'’.,!:;jtfr|()[\]-]/;
const WIDE = /[WMwm@%]/;

export function heuristicTextWidth(
  text: string,
  font: TextFont,
  size: number,
  tracking = 0,
): number {
  const base = font === "kicker" ? 0.14 : font === "anton" ? 0.01 : 0;
  const avg = AVG_ADVANCE[font];
  let em = 0;
  for (const ch of text) {
    const w = NARROW.test(ch) ? avg * 0.6 : WIDE.test(ch) ? avg * 1.4 : avg;
    em += w + base + tracking;
  }
  return em * size;
}

const DARK_MODES = new Set<VideoModeName>(["card", "pip", "arch"]);

function modeAt(plan: Plan, t: number): VideoModeName {
  let m: VideoModeName = "full";
  for (const vm of plan.videoModes) if (vm.t <= t + 1e-6) m = vm.mode;
  return m;
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Approximate on-stage rectangle for the element types that occupy fixed zones. */
export function elementZone(el: PlanElement): Rect | null {
  switch (el.type) {
    case "posterText": {
      const h = el.lines.reduce((s, l) => s + l.size * (l.lineHeight ?? 1.04), 0);
      const w = el.w ?? STAGE_W;
      return { x: el.left ?? 0, y: el.top, w, h };
    }
    case "chapterCard":
      return { x: 0, y: 150, w: STAGE_W, h: 210 * 1.04 + 84 * 1.04 + 90 * 1.04 };
    case "equation":
      return { x: 0, y: el.top, w: STAGE_W, h: (el.leftSize + el.rightSize) * 1.04 };
    case "counter":
      return { x: 0, y: el.top, w: STAGE_W, h: el.size + 44 * 1.1 };
    case "imageCard":
      return { x: el.x, y: el.y, w: el.w + 28, h: el.h + 88 };
    case "patternCard":
      return { x: el.x, y: el.y, w: el.w + 28, h: el.h + 88 };
    case "splitCards": {
      const [a, b] = el.cards;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      return {
        x,
        y,
        w: Math.max(a.x + a.w, b.x + b.w) + 28 - x,
        h: Math.max(a.y + a.h, b.y + b.h) + 88 - y,
      };
    }
    case "lockCard":
      return { x: 140, y: 250, w: 800, h: 300 };
    case "stamp":
      return { x: 70, y: 560, w: 700, h: 140 };
    case "chips":
      return { x: el.x, y: el.y, w: 600, h: el.items.length * (el.size * 1.3 + 18) };
    case "strikeLine":
      return { x: 0, y: el.top, w: STAGE_W, h: el.size * 1.2 };
    case "reveal":
      return { x: 0, y: el.top, w: STAGE_W, h: 250 + (el.devanagari ? 120 * 1.3 : 0) };
    default:
      return null;
  }
}

const TEXT_ZONE_TYPES = new Set<PlanElement["type"]>([
  "posterText",
  "chapterCard",
  "equation",
  "counter",
  "reveal",
  "strikeLine",
]);

export function validatePlan(
  input: PlanInput | unknown,
  transcript: readonly TranscriptWord[],
  opts: ValidateOptions = {},
): ValidateResult {
  const issues: PlanIssue[] = [];
  const parsed = Plan.safeParse(input);
  if (!parsed.success) {
    for (const e of parsed.error.issues) {
      issues.push({
        level: "error",
        code: "schema",
        message: e.message,
        path: e.path.map(String).join("."),
      });
    }
    return { ok: false, plan: parsed.data as unknown as Plan, issues };
  }
  // Work on a deep copy so callers keep their object.
  const plan: Plan = structuredClone(parsed.data);
  const tol = opts.anchorTolerance ?? 0.15;
  const maxNudge = opts.maxNudge ?? 0.5;
  const maxLayout = opts.maxLayoutSec ?? 6;
  const measure = opts.measureText ?? heuristicTextWidth;
  const D = plan.meta.durationSec;

  // ── video modes: sorted, starting at 0, zoom has a point ──
  const sorted = [...plan.videoModes].sort((a, b) => a.t - b.t);
  if (sorted.some((m, i) => m !== plan.videoModes[i])) {
    plan.videoModes = sorted;
    issues.push({ level: "fixed", code: "modes.sorted", message: "video modes sorted by time" });
  }
  if (plan.videoModes[0]!.t > 0) {
    plan.videoModes.unshift({ t: 0, mode: "full" });
    issues.push({ level: "fixed", code: "modes.start", message: "inserted full mode at t=0" });
  }
  for (const vm of plan.videoModes) {
    if (vm.mode === "zoom" && !vm.zoomPoint) {
      const f = plan.subject.faceBox;
      vm.zoomPoint = plan.subject.prop?.point ?? { x: f.x + f.w / 2, y: f.y + f.h / 2 };
      issues.push({
        level: "fixed",
        code: "modes.zoomPoint",
        message: `zoom at ${vm.t}s had no zoomPoint; used ${plan.subject.prop ? "the prop" : "the face centre"}`,
      });
    }
  }

  // ── element times ──
  for (const el of plan.elements) {
    if (el.t1 > D) {
      el.t1 = D;
      issues.push({
        level: "fixed",
        code: "time.clampEnd",
        elementId: el.id,
        message: `t1 clamped to duration ${D}s`,
      });
    }
    if (el.t1 <= el.t0) {
      issues.push({
        level: "error",
        code: "time.order",
        elementId: el.id,
        message: `t1 (${el.t1}) must be after t0 (${el.t0})`,
      });
    }
  }

  // ── anchors ──
  if (transcript.length) {
    for (const el of plan.elements) {
      const idx = el.anchorWordIndex;
      const nearest = nearestWord(transcript, el.t0);
      if (idx !== undefined && transcript[idx]) {
        const d = el.t0 - transcript[idx].t;
        if (Math.abs(d) > tol) {
          if (Math.abs(d) <= maxNudge) {
            const shift = transcript[idx].t - el.t0;
            el.t0 += shift;
            el.t1 = Math.max(el.t1 + shift, el.t0 + 0.3);
            issues.push({
              level: "fixed",
              code: "anchor.nudged",
              elementId: el.id,
              message: `moved ${shift.toFixed(2)}s onto word "${transcript[idx].w}"`,
            });
          } else {
            issues.push({
              level: "error",
              code: "anchor.far",
              elementId: el.id,
              message: `t0 is ${d.toFixed(2)}s from its anchor word "${transcript[idx].w}"`,
            });
          }
        }
      } else if (nearest) {
        const d = Math.abs(el.t0 - nearest.word.t);
        if (d <= tol) {
          el.anchorWordIndex = nearest.index;
          issues.push({
            level: "fixed",
            code: "anchor.inferred",
            elementId: el.id,
            message: `anchored to word "${nearest.word.w}" (#${nearest.index})`,
          });
        } else if (d <= maxNudge) {
          const shift = nearest.word.t - el.t0;
          el.t0 += shift;
          el.t1 = Math.max(el.t1 + shift, el.t0 + 0.3);
          el.anchorWordIndex = nearest.index;
          issues.push({
            level: "fixed",
            code: "anchor.nudged",
            elementId: el.id,
            message: `moved ${shift.toFixed(2)}s onto word "${nearest.word.w}"`,
          });
        } else {
          issues.push({
            level: "warn",
            code: "anchor.none",
            elementId: el.id,
            message: `no spoken word within ${maxNudge}s of t0=${el.t0}`,
          });
        }
      }
    }
  }

  // ── images exist ──
  if (opts.imageIds) {
    const have = new Set(opts.imageIds);
    const check = (id: string | undefined, el: PlanElement) => {
      if (id && !have.has(id)) {
        issues.push({
          level: "error",
          code: "image.missing",
          elementId: el.id,
          message: `imageId "${id}" is not one of the project's images`,
        });
      }
    };
    for (const el of plan.elements) {
      if ("imageId" in el) check(el.imageId, el);
      if (el.type === "splitCards") el.cards.forEach((c) => check(c.imageId, el));
      if (el.type === "filmStrip") el.imageIds.forEach((id) => check(id, el));
    }
    if (plan.endCard?.bgImageId && !have.has(plan.endCard.bgImageId)) {
      issues.push({
        level: "error",
        code: "image.missing",
        message: `endCard.bgImageId "${plan.endCard.bgImageId}" is not one of the project's images`,
      });
    }
  }

  // ── text fits its box; card-mode text ends above the card ──
  for (const el of plan.elements) {
    if (el.type === "posterText") {
      const avail = el.w ?? STAGE_W - 2 * SIDE_MARGIN;
      for (const [i, line] of el.lines.entries()) {
        const w = measure(line.text, line.font, line.size, line.tracking);
        if (w > avail) {
          const next = Math.max(MIN_FONT, Math.floor(line.size * (avail / w)));
          if (next < line.size) {
            if (measure(line.text, line.font, next, line.tracking) <= avail + 1) {
              issues.push({
                level: "fixed",
                code: "text.shrunk",
                elementId: el.id,
                path: `lines.${i}`,
                message: `"${line.text}" ${line.size}→${next}px to fit ${avail}px`,
              });
              line.size = next;
            } else {
              issues.push({
                level: "error",
                code: "text.overflow",
                elementId: el.id,
                path: `lines.${i}`,
                message: `"${line.text}" does not fit even at ${MIN_FONT}px — shorten it`,
              });
            }
          }
        }
      }
    }
    if (el.type === "strikeLine" || el.type === "stamp") {
      const text = el.text;
      const size = el.type === "strikeLine" ? el.size : 110;
      const avail = el.type === "strikeLine" ? STAGE_W - 2 * SIDE_MARGIN : 940;
      if (measure(text, "anton", size) > avail) {
        if (el.type === "strikeLine") {
          const next = Math.max(
            MIN_FONT,
            Math.floor(size * (avail / measure(text, "anton", size))),
          );
          el.size = next;
          issues.push({
            level: "fixed",
            code: "text.shrunk",
            elementId: el.id,
            message: `strike line shrunk to ${next}px`,
          });
        } else {
          issues.push({
            level: "warn",
            code: "text.overflow",
            elementId: el.id,
            message: `stamp "${text}" is wide for the stage — keep stamps to 1–2 words`,
          });
        }
      }
    }
    if (TEXT_ZONE_TYPES.has(el.type) && DARK_MODES.has(modeAt(plan, el.t0 + 0.05))) {
      const zone = elementZone(el);
      if (zone && zone.y + zone.h > CARD_TOP_LIMIT) {
        if (el.type === "posterText") {
          const k = (CARD_TOP_LIMIT - zone.y) / zone.h;
          if (k > 0.5) {
            for (const line of el.lines) line.size = Math.max(MIN_FONT, Math.floor(line.size * k));
            issues.push({
              level: "fixed",
              code: "card.textShrunk",
              elementId: el.id,
              message: `poster text ended at y≈${Math.round(zone.y + zone.h)} in card mode; scaled ×${k.toFixed(2)} to stay above ${CARD_TOP_LIMIT}`,
            });
          } else {
            issues.push({
              level: "error",
              code: "card.textLow",
              elementId: el.id,
              message: `poster text reaches y≈${Math.round(zone.y + zone.h)} in card mode (limit ${CARD_TOP_LIMIT})`,
            });
          }
        } else {
          issues.push({
            level: "warn",
            code: "card.textLow",
            elementId: el.id,
            message: `${el.type} reaches y≈${Math.round(zone.y + zone.h)} in card mode (limit ${CARD_TOP_LIMIT})`,
          });
        }
      }
    }
  }

  // ── colour context: light-wall tokens over the dark stage (and vice versa) are swapped ──
  const DARK_SWAP: Record<string, ColorToken> = { mar: "iv", ter: "gold", goldd: "gold" };
  const LIGHT_SWAP: Record<string, ColorToken> = { iv: "mar", gold: "ter" };
  for (const el of plan.elements) {
    if (el.type !== "posterText") continue;
    const dark = DARK_MODES.has(modeAt(plan, el.t0 + 0.05));
    for (const line of el.lines) {
      if (!line.color) continue;
      const swap = dark
        ? DARK_SWAP[line.color]
        : el.anim === "rise"
          ? LIGHT_SWAP[line.color]
          : undefined;
      if (swap) {
        issues.push({
          level: "fixed",
          code: "color.context",
          elementId: el.id,
          message: `"${line.text}" ${line.color}→${swap} for the ${dark ? "dark stage" : "light wall"}`,
        });
        line.color = swap;
      }
    }
  }

  // ── overlaps: posterText / imageCard sharing time and zone ──
  const zoned = plan.elements
    .filter((e) => e.type === "posterText" || e.type === "imageCard")
    .map((e) => ({ e, z: elementZone(e)! }));
  for (let i = 0; i < zoned.length; i++) {
    for (let j = i + 1; j < zoned.length; j++) {
      const a = zoned[i]!;
      const b = zoned[j]!;
      const overlap = Math.min(a.e.t1, b.e.t1) - Math.max(a.e.t0, b.e.t0);
      if (overlap <= 0.02 || !intersects(a.z, b.z)) continue;
      const first = a.e.t0 <= b.e.t0 ? a.e : b.e;
      const second = first === a.e ? b.e : a.e;
      if (overlap <= 0.3 && second.t0 - first.t0 > 0.3) {
        first.t1 = second.t0;
        issues.push({
          level: "fixed",
          code: "overlap.trimmed",
          elementId: first.id,
          message: `ended ${overlap.toFixed(2)}s earlier so it no longer overlaps "${second.id}"`,
        });
      } else {
        issues.push({
          level: "error",
          code: "overlap",
          elementId: second.id,
          message: `overlaps "${first.id}" in time (${overlap.toFixed(2)}s) and zone`,
        });
      }
    }
  }

  // ── layout rhythm ──
  const changes = [...plan.elements.map((e) => e.t0), ...plan.videoModes.map((m) => m.t), D].sort(
    (a, b) => a - b,
  );
  let last = 0;
  for (const t of changes) {
    if (t - last > maxLayout) {
      issues.push({
        level: "warn",
        code: "rhythm.static",
        message: `nothing new on screen between ${last.toFixed(1)}s and ${t.toFixed(1)}s (${(t - last).toFixed(1)}s)`,
      });
    }
    last = t;
  }

  // ── end card default time ──
  if (plan.endCard && plan.endCard.t0 === undefined) {
    const arch = [...plan.videoModes].reverse().find((m) => m.mode === "arch");
    plan.endCard.t0 = arch ? arch.t : Math.max(0, D - 2.5);
    issues.push({
      level: "fixed",
      code: "endCard.t0",
      message: `end card starts at ${plan.endCard.t0.toFixed(2)}s`,
    });
  }

  plan.elements.sort((a, b) => a.t0 - b.t0);
  return { ok: !issues.some((i) => i.level === "error"), plan, issues };
}

function nearestWord(
  words: readonly TranscriptWord[],
  t: number,
): { word: TranscriptWord; index: number } | null {
  let best: { word: TranscriptWord; index: number } | null = null;
  let bd = Infinity;
  for (const [i, w] of words.entries()) {
    const d = Math.abs(w.t - t);
    if (d < bd) {
      bd = d;
      best = { word: w, index: i };
    }
  }
  return best;
}

/** Zod-level parse that applies defaults, for callers that only need a typed object. */
export const parsePlan = (input: unknown): Plan => Plan.parse(input);
export const safeParsePlan = (input: unknown): z.ZodSafeParseResult<Plan> => Plan.safeParse(input);
