import { describe, expect, it } from "vitest";
import {
  DEFAULT_PART,
  MAX_PARTS,
  MIN_PART,
  extensionFor,
  fileFingerprint,
  planParts,
  remainingParts,
} from "./plan";

describe("multipart planning", () => {
  it("slices a file into ≥5 MiB parts with a smaller tail", () => {
    const parts = planParts(20 * 1024 * 1024 + 7);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ partNumber: 1, start: 0, end: DEFAULT_PART });
    expect(parts.at(-1)?.end).toBe(20 * 1024 * 1024 + 7);
    expect(parts.every((p, i) => i === parts.length - 1 || p.end - p.start >= MIN_PART)).toBe(true);
  });

  it("never exceeds 10,000 parts", () => {
    const parts = planParts(200 * 1024 * 1024 * 1024); // 200 GB
    expect(parts.length).toBeLessThanOrEqual(MAX_PARTS);
  });

  it("resumes: skips parts S3 already has with the right size", () => {
    const plan = planParts(3 * DEFAULT_PART);
    const left = remainingParts(plan, [
      { partNumber: 1, size: DEFAULT_PART },
      { partNumber: 2, size: 1234 }, // truncated → re-upload
    ]);
    expect(left.map((p) => p.partNumber)).toEqual([2, 3]);
  });

  it("fingerprints and extensions", () => {
    expect(fileFingerprint({ name: "a.mov", size: 1, lastModified: 2 })).toBe("a.mov|1|2");
    expect(extensionFor("IMG_7571.MP4", "")).toBe("mp4");
    expect(extensionFor("clip", "video/quicktime")).toBe("mov");
    expect(extensionFor("x", "application/octet-stream")).toBe("bin");
  });
});
