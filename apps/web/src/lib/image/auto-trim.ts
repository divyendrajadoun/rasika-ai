/**
 * "Auto-trim screenshot UI": phone screenshots carry a status bar, nav bar, black letterbox
 * bars or app chrome at the top/bottom. We detect near-uniform horizontal bands at the edges
 * and propose a crop. Pure function over row statistics so it is unit-testable; the canvas
 * glue lives in the crop dialog.
 */
export interface RowStat {
  /** mean luma 0..255 */
  mean: number;
  /** std-dev of luma across the row */
  spread: number;
}

export interface TrimResult {
  top: number;
  bottom: number; // rows to drop from the bottom
  reason: string[];
}

const UNIFORM_SPREAD = 14; // rows flatter than this are "chrome"
const MAX_BAND_FRACTION = 0.22; // never eat more than 22 % from one edge

/** Given per-row stats of an image, how many rows to trim from top and bottom. */
export function detectBands(rows: RowStat[]): TrimResult {
  const n = rows.length;
  const limit = Math.floor(n * MAX_BAND_FRACTION);
  const reason: string[] = [];

  const scan = (indices: number[]): number => {
    let count = 0;
    let refMean = rows[indices[0] ?? 0]?.mean ?? 0;
    for (const i of indices) {
      const r = rows[i];
      if (!r) break;
      const flat = r.spread < UNIFORM_SPREAD;
      const sameTone = Math.abs(r.mean - refMean) < 24;
      if (!(flat && sameTone)) break;
      refMean = (refMean * count + r.mean) / (count + 1);
      count++;
      if (count >= limit) break;
    }
    return count;
  };

  const top = scan(Array.from({ length: limit }, (_, i) => i));
  const bottom = scan(Array.from({ length: limit }, (_, i) => n - 1 - i));
  // ignore tiny bands (a 1–2 px border isn't UI)
  const minBand = Math.max(6, Math.round(n * 0.012));
  const t = top >= minBand ? top : 0;
  const b = bottom >= minBand ? bottom : 0;
  if (t) reason.push(`top band ${t}px`);
  if (b) reason.push(`bottom band ${b}px`);
  return { top: t, bottom: b, reason };
}

/** Row statistics from RGBA pixel data (sampled every `step` columns for speed). */
export function rowStats(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  step = 4,
): RowStat[] {
  const out: RowStat[] = [];
  for (let y = 0; y < height; y++) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const l = 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
      sum += l;
      sumSq += l * l;
      count++;
    }
    const mean = sum / count;
    out.push({ mean, spread: Math.sqrt(Math.max(0, sumSq / count - mean * mean)) });
  }
  return out;
}
