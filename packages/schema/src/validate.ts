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

/** Relative luma 0..1 of a #rrggbb colour. A light stage makes the framed modes a *light* context. */
export function hexLuma(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return 0;
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

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
    case "browserCard":
      return { x: el.x, y: el.y, w: el.w, h: el.h + 56 };
    case "pourGlass":
      return { x: 0, y: el.top, w: STAGE_W, h: el.size + 60 };
    case "fightHud":
      return { x: 0, y: el.top, w: STAGE_W, h: 200 };
    case "seasonWindow":
      return { x: el.x, y: el.y, w: el.w, h: el.h };
    case "noteMachine":
      return { x: 0, y: el.top, w: STAGE_W, h: 1100 };
    case "tierBoard":
      return { x: 0, y: el.top, w: STAGE_W, h: TIER_HEAD + el.tiers.length * TIER_ROW };
    case "crowd": {
      const rows = Math.ceil(el.count / crowdCols(el.count));
      return { x: 0, y: el.top, w: STAGE_W, h: rows * crowdCell(el.count) + (el.label || el.per ? 130 : 0) };
    }
    case "docCard":
      return { x: el.x, y: el.y, w: el.w, h: docCardHeight(el) };
    case "explainerWorld":
      return null; // the world is the backdrop: everything else stands in front of it
    case "screenFocus":
      return { x: el.x, y: el.y, w: el.w, h: el.h + (el.url ? 56 : 0) };
    case "throughLine":
      return null; // it travels: each key is placed by the planner against the scene it joins
    case "pageFlyover":
      return null; // it is the whole frame
    case "diagramZoom":
      return { x: 40, y: el.top, w: 1000, h: 1400 };
    case "codeScene":
      return null; // the whole frame: words placed over it are the planner's to keep clear
    default:
      return null;
  }
}

/** Geometry shared with the engine's brief elements (packages/engine/src/brief.ts). */
export const TIER_HEAD = 150;
export const TIER_ROW = 170;
export const crowdCols = (n: number) => (n <= 12 ? 4 : n <= 30 ? 6 : 10);
export const crowdCell = (n: number) => Math.floor(960 / crowdCols(n));
export function docCardHeight(el: { kind: string; headline: string; body?: string; w: number; masthead?: string }): number {
  const perLine = Math.max(10, Math.floor((el.w - 100) / 34));
  const head = Math.ceil(el.headline.length / perLine) * 74;
  const bodyPer = Math.max(20, Math.floor((el.w - 100) / 17));
  const body = el.body ? Math.ceil(el.body.length / bodyPer) * 44 + 24 : 0;
  return 80 + (el.kind === "newspaper" ? 110 : 40) + head + body + 60;
}

/** What drawing code may never touch: timers, clocks, network, storage, navigation, eval. */
export const CODE_BANNED: RegExp[] = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /EventSource/,
  /\bimport\s*\(/,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /Math\.random/,
  /\bDate\b/,
  /performance\.now/,
  /requestAnimationFrame/,
  /setTimeout|setInterval/,
  /localStorage|sessionStorage|indexedDB|document\.cookie/,
  /\blocation\b|window\.open|navigator\./,
  /\bdocument\./,
  /postMessage|Worker\s*\(/,
];

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
  // ── brief-film elements: every inner timing (a pour, a hit, a note) inside the element's life ──
  for (const el of plan.elements) {
    const life = el.t1 - el.t0;
    const offs: number[] =
      el.type === "pourGlass"
        ? [...el.layers.map((l) => l.at + l.dur), ...(el.garnish ? [el.garnish.at] : [])]
        : el.type === "fightHud"
          ? [...el.hits.map((h) => h.at), ...(el.koAt != null ? [el.koAt] : [])]
          : el.type === "noteMachine"
            ? [el.dropAt, ...el.notes.map((n) => n.at), ...el.drums]
            : el.type === "tierBoard"
              ? el.items.map((i) => i.at)
              : el.type === "explainerWorld"
                ? el.host.map((h) => h.at)
                : el.type === "crowd"
                  ? [el.at]
                  : el.type === "screenFocus"
                    ? el.steps.map((x) => x.at)
                    : el.type === "throughLine"
                      ? el.keys.map((k) => k.at)
                      : el.type === "diagramZoom"
                        ? el.steps.map((x) => x.at)
                  : el.type === "docCard" && el.mark
                    ? [el.markAt]
                    : [];
    const late = offs.filter((o) => o > life + 0.05);
    if (late.length)
      issues.push({
        level: "error",
        code: "inner-timing",
        message: `${el.type} "${el.id}": ${late.length} inner time(s) fall after its end (${life.toFixed(2)} s after t0)`,
        elementId: el.id,
      });
    if (el.type === "pourGlass") {
      const total = el.layers.reduce((a, l) => a + l.fill, 0);
      if (total > 1.0001)
        issues.push({
          level: "error",
          code: "overfill",
          message: `pourGlass "${el.id}": layers fill ${(total * 100).toFixed(0)}% of the glass (max 100%)`,
          elementId: el.id,
        });
    }
    if (el.type === "tierBoard" && el.items.some((i) => i.tier >= el.tiers.length))
      issues.push({
        level: "error",
        code: "tier-missing",
        message: `tierBoard "${el.id}": an item is ranked into a tier that does not exist (${el.tiers.length} tiers)`,
        elementId: el.id,
      });
    if (el.type === "diagramZoom") {
      const ids = new Set(el.nodes.map((n) => n.id));
      const bad = [
        ...el.edges.flatMap((e) => [e.from, e.to]),
        ...el.steps.map((x) => x.focus).filter((f): f is string => f !== null),
      ].filter((id) => !ids.has(id));
      if (bad.length)
        issues.push({
          level: "error",
          code: "diagram-missing-part",
          message: `diagramZoom "${el.id}": links or steps name parts that are not in the diagram (${[...new Set(bad)].join(", ")})`,
          elementId: el.id,
        });
    }
    if (
      (el.type === "throughLine" && el.keys.some((k, i) => i > 0 && k.at <= el.keys[i - 1]!.at)) ||
      ((el.type === "screenFocus" || el.type === "diagramZoom") && el.steps.some((x, i) => i > 0 && x.at <= el.steps[i - 1]!.at))
    )
      issues.push({
        level: "error",
        code: "keys-out-of-order",
        message: `${el.type} "${el.id}": its keys or steps must be in time order`,
        elementId: el.id,
      });
    if (el.type === "codeScene") {
      const banned = CODE_BANNED.filter((re) => re.test(el.code));
      if (banned.length)
        issues.push({
          level: "error",
          code: "code-unsafe",
          message: `codeScene "${el.id}": the drawing code uses ${banned.map((r) => r.source).join(", ")} (it must be a pure function of t)`,
          elementId: el.id,
        });
    }
    if (el.type === "explainerWorld" && plan.meta.faceless !== true)
      issues.push({
        level: "error",
        code: "world-over-footage",
        message: `explainerWorld "${el.id}": a world fills the frame, so it is only for films with no footage (it would hide the speaker)`,
        elementId: el.id,
      });
    if (el.type === "crowd" && el.highlight > el.count)
      issues.push({
        level: "error",
        code: "crowd-highlight",
        message: `crowd "${el.id}": highlights ${el.highlight} of only ${el.count} figures`,
        elementId: el.id,
      });
    if (el.type === "docCard" && el.mark && !el.headline.toLowerCase().includes(el.mark.toLowerCase()))
      issues.push({
        level: "error",
        code: "mark-missing",
        message: `docCard "${el.id}": the marked phrase "${el.mark}" is not in the headline`,
        elementId: el.id,
      });
    if (el.type === "noteMachine" && el.notes.some((n) => n.at < el.dropAt))
      issues.push({
        level: "error",
        code: "note-before-drop",
        message: `noteMachine "${el.id}": a note plays before the ball drops`,
        elementId: el.id,
      });
  }

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
      if (el.type === "roundupScene") {
        el.shots.forEach((sh) => check(sh.imageId, el));
        el.thumbs.forEach((id) => check(id, el));
      }
      if (el.type === "pageFlyover") [el.heroImageId, el.logoImageId].forEach((id) => id && check(id, el));
      if (el.type === "throughLine") el.keys.forEach((k) => k.imageId && check(k.imageId, el));
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
  const stageDark = hexLuma(plan.style.palette.stage) < 0.5;
  // with no speaker (script-only and brief films) there is no wall: the stage plate is behind
  // every line in every mode, so its own lightness decides
  const faceless = plan.meta.faceless === true;
  for (const el of plan.elements) {
    if (el.type !== "posterText") continue;
    const framed = DARK_MODES.has(modeAt(plan, el.t0 + 0.05));
    const dark = faceless ? stageDark : framed && stageDark;
    for (const line of el.lines) {
      if (!line.color) continue;
      const swap = dark
        ? DARK_SWAP[line.color]
        : faceless || el.anim === "rise" || (framed && !stageDark)
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
      // with no speaker the stage itself is behind the words: a token too close to it can't be read
      if (faceless && line.color) {
        const pal = plan.style.palette as Record<string, string>;
        const c = pal[line.color];
        if (c && Math.abs(hexLuma(c) - hexLuma(pal.stage!)) < 0.22) {
          const to: ColorToken = stageDark ? "iv" : "ink";
          if (to !== line.color) {
            issues.push({
              level: "fixed",
              code: "color.contrast",
              elementId: el.id,
              message: `"${line.text}" ${line.color}→${to}: too close to the stage colour to read`,
            });
            line.color = to;
          }
        }
      }
    }
  }

  // ── stock B-roll: length, not in the hook, no stacking, breathing room between cutaways ──
  {
    const brolls = plan.elements
      .filter((e): e is Extract<PlanElement, { type: "broll" }> => e.type === "broll")
      .sort((a, b) => a.t0 - b.t0);
    let lastEnd = -Infinity;
    for (const b of brolls) {
      if (b.t0 < 1.5) {
        b.t0 = 1.5;
        issues.push({ level: "fixed", code: "broll.hook", elementId: b.id, message: "B-roll moved out of the first 1.5 s" });
      }
      if (b.t1 - b.t0 > 6) {
        b.t1 = b.t0 + 6;
        issues.push({ level: "fixed", code: "broll.long", elementId: b.id, message: "B-roll capped at 6 s" });
      }
      if (b.t0 - lastEnd < 1.5 && lastEnd > -Infinity) {
        issues.push({ level: "error", code: "broll.crowded", elementId: b.id, message: "two B-roll cutaways need ≥ 1.5 s of the speaker between them" });
      }
      if (b.t1 - b.t0 < 1.2) {
        issues.push({ level: "error", code: "broll.short", elementId: b.id, message: "B-roll shorter than 1.2 s" });
      }
      lastEnd = Math.max(lastEnd, b.t1);
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
