import { describe, expect, it } from "vitest";
import { PLAN_VERSION, PlanEnvelope, StyleTokens, presets, defaultPreset } from "./index";

describe("@rasika/schema presets", () => {
  it("ships four valid presets with Mikku Royal as default", () => {
    expect(presets).toHaveLength(4);
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
