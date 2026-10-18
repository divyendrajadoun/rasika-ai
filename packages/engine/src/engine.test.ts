import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Plan, validatePlan, type TranscriptWord } from "@rasika/schema";
import { captionAt, captionWindows } from "./captions";
import { buildSegments, vstate, zoomState } from "./modes";
import { deriveSfx } from "./sfx";
import { framePattern } from "./harness";

const root = resolve(__dirname, "../../..");
const planJson = JSON.parse(readFileSync(resolve(root, "plans/baisa_bling.json"), "utf8"));
const words: TranscriptWord[] = JSON.parse(
  readFileSync(resolve(root, "plans/baisa_bling.words.json"), "utf8"),
).words;
const refCues: { cues: Array<{ t: number; type: string }> } = JSON.parse(
  readFileSync(resolve(root, "reference/baisa_bling/cues.json"), "utf8"),
);

describe("plans/baisa_bling.json", () => {
  it("parses as Plan v1 and validates without errors against its transcript", () => {
    const plan = Plan.parse(planJson);
    expect(plan.elements).toHaveLength(47);
    const r = validatePlan(planJson, words, {
      imageIds: ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9", "choker"],
    });
    const errors = r.issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
    // the reference was timed by hand on the words, so almost nothing should need nudging
    expect(r.issues.filter((i) => i.code === "anchor.nudged").length).toBeLessThanOrEqual(3);
    expect(r.issues.filter((i) => i.code === "text.shrunk")).toEqual([]);
  });
});

describe("video modes", () => {
  it("reproduces the reference zoom transform from a zoom point", () => {
    expect(zoomState({ x: 480, y: 1310 }, 2.1)).toMatchObject({ s: 2.1, x: 126, y: -735 });
  });
  it("interpolates 0.5 s outExpo between modes and 0.6 s into zoom", () => {
    const segs = buildSegments(Plan.parse(planJson).videoModes);
    expect(vstate(segs, 0)).toMatchObject({ s: 1, f: 0 });
    const mid = vstate(segs, 16.72 + 0.25);
    expect(mid.s).toBeGreaterThan(0.56);
    expect(mid.s).toBeLessThan(1);
    expect(vstate(segs, 16.72 + 0.5)).toMatchObject({ s: 0.56, y: 275, r: 90, f: 1 });
    const z = vstate(segs, 12.5 + 0.3);
    expect(z.s).toBeGreaterThan(1.5);
    expect(z.s).toBeLessThan(1.6); // inOutCubic midpoint
    expect(vstate(segs, 13.2)).toMatchObject({ s: 2.1, x: 126, y: -735 });
  });
});

describe("captions", () => {
  const cw = captionWindows(words);
  const caps = { gold: ["taste"], accent: ["2000"] };
  it("holds a word until the next one or 0.85 s and strips punctuation", () => {
    expect(cw[10]).toEqual({ txt: "is", t: 2.34, end: 2.84 });
    const last = cw[cw.length - 1]!;
    expect(last.end - last.t).toBeCloseTo(0.8);
  });
  it("classifies emphasis words and pops in", () => {
    const c = captionAt(cw, caps, 1.12)!;
    expect(c.txt).toBe("taste");
    expect(c.cls).toBe("g");
    expect(c.s).toBeLessThan(1);
    expect(captionAt(cw, caps, 2.9)!.cls).toBe("r");
    expect(captionAt(cw, caps, 0.1)).toBeNull();
  });
  it("marks Devanagari for the Mukta caption font", () => {
    const c = captionAt(captionWindows([{ w: "रस", t: 1 }]), caps, 1.1)!;
    expect(c.hindi).toBe(true);
  });
});

describe("deriveSfx", () => {
  it("reproduces every cue of the reference cues.json within 0.11 s", () => {
    const sheet = deriveSfx(Plan.parse(planJson));
    const missing = refCues.cues.filter(
      (rc) => !sheet.cues.some((c) => c.type === rc.type && Math.abs(c.t - rc.t) <= 0.11),
    );
    expect(missing).toEqual([]);
    // and does not invent much beyond it
    const extra = sheet.cues.filter(
      (c) => !refCues.cues.some((rc) => rc.type === c.type && Math.abs(c.t - rc.t) <= 0.11),
    );
    expect(extra.length).toBeLessThanOrEqual(4);
  });
  it("scales with intensity and goes silent at 0", () => {
    const plan = Plan.parse(planJson);
    const loud = deriveSfx(plan).cues[0]!;
    const soft = deriveSfx({ ...plan, sfx: { ...plan.sfx, intensity: 0.5 } }).cues[0]!;
    expect(soft.gain).toBeLessThan(loud.gain);
    expect(deriveSfx({ ...plan, sfx: { ...plan.sfx, intensity: 0 } }).cues).toEqual([]);
  });
});

describe("harness", () => {
  it("expands ffmpeg-style frame patterns", () => {
    expect(framePattern("frames/f%05d.jpg")(7)).toBe("frames/f00007.jpg");
    expect(framePattern("still.jpg")(99)).toBe("still.jpg");
  });
});
