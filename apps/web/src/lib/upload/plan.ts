/**
 * Pure helpers for resumable multipart uploads (no DOM, unit-tested).
 * S3 rules: parts are 5 MiB–5 GiB (last part may be smaller), at most 10,000 parts.
 */
export const MIN_PART = 5 * 1024 * 1024;
export const DEFAULT_PART = 8 * 1024 * 1024;
export const MAX_PARTS = 10_000;

export interface PartRange {
  partNumber: number;
  start: number;
  end: number; // exclusive
}

/** Picks a part size that keeps the count under MAX_PARTS, then slices the file. */
export function planParts(sizeBytes: number, preferredPart = DEFAULT_PART): PartRange[] {
  if (sizeBytes <= 0) return [];
  let part = Math.max(MIN_PART, preferredPart);
  while (Math.ceil(sizeBytes / part) > MAX_PARTS) part *= 2;
  const parts: PartRange[] = [];
  for (let start = 0, n = 1; start < sizeBytes; start += part, n++) {
    parts.push({ partNumber: n, start, end: Math.min(sizeBytes, start + part) });
  }
  return parts;
}

/** Parts still to upload, given the ones S3 already holds (by number and size). */
export function remainingParts(
  plan: PartRange[],
  uploaded: Array<{ partNumber: number; size: number }>,
): PartRange[] {
  const done = new Map(uploaded.map((p) => [p.partNumber, p.size]));
  return plan.filter((p) => done.get(p.partNumber) !== p.end - p.start);
}

/** Stable id for "the same file" across reloads: name + size + mtime. */
export function fileFingerprint(f: { name: string; size: number; lastModified: number }): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

export function extensionFor(name: string, mime: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()?.toLowerCase() : undefined;
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  const map: Record<string, string> = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-matroska": "mkv",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[mime] ?? "bin";
}

export const ACCEPTED_VIDEO = [
  "video/mp4",
  "video/quicktime",
  "video/x-m4v",
  "video/hevc",
  "video/x-matroska",
  "",
];
export const ACCEPTED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
