import { describe, expect, it } from "vitest";
import { E, clamp, frameIndex, lerp, prog, rng, transformStyle } from "./toolkit";

describe("engine toolkit", () => {
  it("easings are 0 at 0 and 1 at 1", () => {
    for (const [name, fn] of Object.entries(E)) {
      expect(fn(0), name).toBeCloseTo(0, 6);
      expect(fn(1), name).toBeCloseTo(1, 6);
    }
  });

  it("prog clamps and eases", () => {
    expect(prog(-1, 0, 1)).toBe(0);
    expect(prog(2, 0, 1)).toBe(1);
    expect(prog(0.5, 0, 1)).toBe(0.5);
    expect(prog(0.5, 0, 1, E.outExpo)).toBeCloseTo(1 - Math.pow(2, -5), 6);
  });

  it("rng is deterministic for the same seed", () => {
    const a = rng(7);
    const b = rng(7);
    const sa = Array.from({ length: 5 }, () => a());
    const sb = Array.from({ length: 5 }, () => b());
    expect(sa).toEqual(sb);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
    expect(sa).not.toEqual(Array.from({ length: 5 }, () => rng(8)()));
  });

  it("transformStyle hides fully transparent items and skips tiny blur", () => {
    expect(transformStyle({ o: 0 }).visibility).toBe("hidden");
    expect(transformStyle({ blur: 0.01 }).filter).toBe("none");
    expect(transformStyle({ x: 1, y: 2, s: 3, r: 4 }).transform).toBe(
      "translate(1px,2px) scale(3) rotate(4deg)",
    );
  });

  it("frameIndex matches the reference composition (1-based, clamped)", () => {
    expect(frameIndex(0, 30, 2703)).toBe(1);
    expect(frameIndex(1, 30, 2703)).toBe(31);
    expect(frameIndex(999, 30, 2703)).toBe(2703);
    expect(clamp(5, 0, 1)).toBe(1);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});
