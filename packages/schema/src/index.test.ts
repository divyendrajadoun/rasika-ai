import { describe, expect, it } from "vitest";
import {
  ELEMENT_TYPES,
  PLAN_VERSION,
  Plan,
  PlanEnvelope,
  StyleTokens,
  defaultPreset,
  presets,
  validatePlan,
  type PlanInput,
} from "./index";

const words = [
  { w: "How", t: 0.22 },
  { w: "do", t: 0.3 },
  { w: "you", t: 0.46 },
  { w: "know", t: 0.58 },
  { w: "taste", t: 1.1 },
  { w: "2000", t: 2.84 },
  { w: "years", t: 3.34 },
  { w: "word", t: 4.74 },
  { w: "end.", t: 7.3 },
];

function basePlan(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    version: PLAN_VERSION,
    meta: { durationSec: 10, fps: 30, width: 1080, height: 1920, language: "en" },
    style: defaultPreset,
    subject: {
      faceBox: { x: 300, y: 700, w: 480, h: 560 },
      freeZone: { x: 0, y: 150, w: 1080, h: 530 },
    },
    videoModes: [{ t: 0, mode: "full" }],
    captions: { enabled: true, y: 1400, gold: ["taste"], accent: ["2000"] },
    elements: [],
    sfx: { auto: true, intensity: 0.8 },
    ...overrides,
  };
}

describe("@rasika/schema presets", () => {
  it("ships fourteen valid presets with Mikku Royal as default", () => {
    expect(presets).toHaveLength(14);
    expect(new Set(presets.map((p) => p.id)).size).toBe(14);
    for (const p of presets) expect(() => StyleTokens.parse(p)).not.toThrow();
    expect(defaultPreset.id).toBe("mikku-royal");
    expect(defaultPreset.palette.stage).toBe("#3a0a11");
  });

  it("validates a plan envelope and rejects the wrong version", () => {
    const ok = PlanEnvelope.safeParse({
      version: PLAN_VERSION,
      meta: { durationSec: 90.1, fps: 30, width: 1080, height: 1920, language: "en" },
      style: defaultPreset,
    });
    expect(ok.success).toBe(true);
    const bad = PlanEnvelope.safeParse({ version: 2, meta: {}, style: {} });
    expect(bad.success).toBe(false);
  });
});

describe("Plan v1", () => {
  it("knows all 16 element types from the spec", () => {
    expect([...ELEMENT_TYPES].sort()).toEqual(
      [
        "posterText",
        "counter",
        "lockCard",
        "propPunchIn",
        "feedPhone",
        "stamp",
        "chapterCard",
        "imageCard",
        "splitCards",
        "bleedPlate",
        "filmStrip",
        "patternCard",
        "equation",
        "reveal",
        "strikeLine",
        "chips",
      ].sort(),
    );
  });

  it("applies defaults and rejects raw hex in elements", () => {
    const p = Plan.parse(
      basePlan({
        elements: [
          {
            id: "a",
            type: "posterText",
            t0: 0.2,
            t1: 2,
            top: 215,
            lines: [{ text: "HELLO", font: "anton", size: 96 }],
          },
        ],
      }),
    );
    expect(p.elements[0]!.type === "posterText" && p.elements[0].anim).toBe("rise");
    const bad = Plan.safeParse(
      basePlan({
        elements: [
          {
            id: "a",
            type: "posterText",
            t0: 0.2,
            t1: 2,
            top: 215,
            lines: [{ text: "HELLO", font: "anton", size: 96, color: "#ff0000" as never }],
          },
        ],
      }),
    );
    expect(bad.success).toBe(false);
  });

  it("bleedPlate needs exactly one of imageId / patternId", () => {
    const both = Plan.safeParse(
      basePlan({
        elements: [
          {
            id: "b",
            type: "bleedPlate",
            t0: 1,
            t1: 2,
            imageId: "i1",
            patternId: "jaali",
            kicker: "A",
            title: "B",
          },
        ],
      }),
    );
    expect(both.success).toBe(false);
  });
});

describe("validatePlan", () => {
  it("anchors elements to the nearest word and nudges small drifts", () => {
    const r = validatePlan(
      basePlan({
        elements: [
          {
            id: "hook",
            type: "posterText",
            t0: 0.25,
            t1: 2.0,
            top: 215,
            lines: [{ text: "HOW DO YOU KNOW", font: "anton", size: 96, color: "mar" }],
          },
          {
            id: "late",
            type: "posterText",
            t0: 3.6,
            t1: 4.5,
            top: 215,
            lines: [{ text: "YEARS", font: "anton", size: 96, color: "mar" }],
          },
        ],
      }),
      words,
    );
    expect(r.ok).toBe(true);
    const hook = r.plan.elements.find((e) => e.id === "hook")!;
    expect(hook.anchorWordIndex).toBe(0);
    const late = r.plan.elements.find((e) => e.id === "late")!;
    expect(late.t0).toBeCloseTo(3.34, 5);
    expect(late.anchorWordIndex).toBe(6);
    expect(r.issues.filter((i) => i.code === "anchor.nudged")).toHaveLength(1);
  });

  it("shrinks text that does not fit and flags card-mode text that runs low", () => {
    const r = validatePlan(
      basePlan({
        videoModes: [
          { t: 0, mode: "full" },
          { t: 2, mode: "card" },
        ],
        elements: [
          {
            id: "wide",
            type: "posterText",
            t0: 0.22,
            t1: 1.5,
            top: 215,
            lines: [
              {
                text: "THIS LINE IS FAR TOO LONG TO FIT ON THE STAGE AT ALL",
                font: "anton",
                size: 200,
                color: "mar",
              },
            ],
          },
          {
            id: "low",
            type: "posterText",
            t0: 2.84,
            t1: 4,
            top: 400,
            lines: [
              { text: "ONE", font: "anton", size: 150, color: "iv" },
              { text: "TWO", font: "anton", size: 150, color: "iv" },
            ],
          },
        ],
      }),
      words,
    );
    const wide = r.plan.elements.find((e) => e.id === "wide")!;
    expect(wide.type === "posterText" && wide.lines[0]!.size).toBeLessThan(200);
    expect(r.issues.some((i) => i.code === "text.shrunk")).toBe(true);
    expect(r.issues.some((i) => i.code === "card.textShrunk" || i.code === "card.textLow")).toBe(
      true,
    );
  });

  it("reports missing images, overlaps and static stretches", () => {
    const r = validatePlan(
      basePlan({
        meta: { durationSec: 20, fps: 30, width: 1080, height: 1920, language: "en" },
        elements: [
          {
            id: "c1",
            type: "imageCard",
            t0: 0.22,
            t1: 3,
            imageId: "nope",
            x: 40,
            y: 200,
            w: 400,
            h: 500,
          },
          {
            id: "t1",
            type: "posterText",
            t0: 0.3,
            t1: 3,
            top: 215,
            lines: [{ text: "OVERLAPS", font: "anton", size: 96, color: "mar" }],
          },
        ],
      }),
      words,
      { imageIds: ["i1"] },
    );
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.code === "image.missing")).toBe(true);
    expect(r.issues.some((i) => i.code === "overlap")).toBe(true);
    expect(r.issues.some((i) => i.code === "rhythm.static")).toBe(true);
  });

  it("swaps light-wall colour tokens for stage tokens in dark modes", () => {
    const r = validatePlan(
      basePlan({
        videoModes: [
          { t: 0, mode: "full" },
          { t: 2, mode: "card" },
        ],
        elements: [
          {
            id: "dark",
            type: "posterText",
            t0: 2.84,
            t1: 4,
            top: 215,
            lines: [
              { text: "ONE", font: "anton", size: 100, color: "mar" },
              { text: "two", font: "serif", size: 80, color: "ter" },
            ],
          },
        ],
      }),
      words,
    );
    const el = r.plan.elements[0]!;
    expect(el.type === "posterText" && el.lines.map((l) => l.color)).toEqual(["iv", "gold"]);
    expect(r.issues.filter((i) => i.code === "color.context" && i.level === "fixed")).toHaveLength(
      2,
    );
  });

  it("fills a missing zoom point from the prop and defaults the end card time", () => {
    const r = validatePlan(
      basePlan({
        subject: {
          faceBox: { x: 300, y: 700, w: 480, h: 560 },
          freeZone: { x: 0, y: 150, w: 1080, h: 530 },
          prop: { label: "choker", point: { x: 480, y: 1310 } },
        },
        videoModes: [
          { t: 0, mode: "full" },
          { t: 2.84, mode: "zoom" },
          { t: 7.3, mode: "arch" },
        ],
        endCard: { brand: "BAISA BLING", line1: "a little bit of you." },
      }),
      words,
    );
    expect(r.plan.videoModes[1]!.zoomPoint).toEqual({ x: 480, y: 1310 });
    expect(r.plan.endCard!.t0).toBe(7.3);
  });
});
