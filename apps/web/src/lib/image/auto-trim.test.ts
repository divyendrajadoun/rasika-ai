import { describe, expect, it } from "vitest";
import { detectBands, rowStats, type RowStat } from "./auto-trim";

const flat = (mean: number): RowStat => ({ mean, spread: 2 });
const busy = (): RowStat => ({ mean: 120, spread: 60 });

describe("auto-trim band detection", () => {
  it("finds a status bar and a nav bar around a busy photo", () => {
    const rows = [
      ...Array(40).fill(flat(250)),
      ...Array(600).fill(busy()),
      ...Array(60).fill(flat(0)),
    ];
    const r = detectBands(rows);
    expect(r.top).toBe(40);
    expect(r.bottom).toBe(60);
  });

  it("ignores hairline borders and caps the band at 22 %", () => {
    const rows = [...Array(3).fill(flat(0)), ...Array(500).fill(busy())];
    expect(detectBands(rows)).toMatchObject({ top: 0, bottom: 0 });
    const allFlat = Array(1000).fill(flat(10));
    const r = detectBands(allFlat);
    expect(r.top).toBe(220);
    expect(r.bottom).toBe(220);
  });

  it("rowStats computes mean and spread from RGBA data", () => {
    const w = 4;
    const data = new Uint8ClampedArray(w * 2 * 4);
    for (let x = 0; x < w; x++) {
      data.set([255, 255, 255, 255], x * 4); // row 0 white
      data.set([x * 80, x * 80, x * 80, 255], (w + x) * 4); // row 1 gradient
    }
    const s = rowStats(data, w, 2, 1);
    expect(s[0]?.mean).toBeCloseTo(255, 3);
    expect(s[0]?.spread).toBeCloseTo(0, 3);
    expect((s[1]?.spread ?? 0) > 50).toBe(true);
  });
});
