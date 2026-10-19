import { describe, expect, it } from "vitest";
import { creditsForDuration, formatPrice, plans } from "./pricing";
import { presetCards } from "./presets";
import { brand } from "./brand";
import * as landing from "@/content/landing";

describe("pricing config", () => {
  it("matches the spec placeholder plans", () => {
    const byId = Object.fromEntries(plans.map((p) => [p.id, p]));
    expect(byId.free?.price.INR).toBe(0);
    expect(byId.free?.watermark).toBe(true);
    expect(byId.free?.maxSeconds).toBe(60);
    expect(byId.creator?.price.INR).toBe(999);
    expect(byId.creator?.reelsPerMonth).toBe(10);
    expect(byId.pro?.price.INR).toBe(2999);
    expect(byId.pro?.reelsPerMonth).toBe(40);
    expect(byId.agency?.price.INR).toBeNull();
  });

  it("charges one credit per 90 s", () => {
    expect(creditsForDuration(30)).toBe(1);
    expect(creditsForDuration(90)).toBe(1);
    expect(creditsForDuration(91)).toBe(2);
    expect(creditsForDuration(180)).toBe(2);
  });

  it("formats prices per currency", () => {
    expect(formatPrice(2999, "INR")).toBe("₹2,999");
    expect(formatPrice(36, "USD")).toBe("$36");
    expect(formatPrice(null, "INR")).toBe("Contact");
  });
});

describe("landing content", () => {
  it("has every section the spec lists", () => {
    expect(landing.nav.links.map((l) => l.label)).toEqual([
      "How it works",
      "Styles",
      "Films",
      "Pricing",
      "FAQ",
    ]);
    expect(landing.hero.headline).toBe("Talk to your phone. Post like a studio.");
    expect(landing.hero.lines).toHaveLength(2);
    expect(landing.hero.hindiLines).toHaveLength(2);
    expect(landing.howItWorks.steps).toHaveLength(3);
    expect(landing.features.items).toHaveLength(8);
    expect(landing.showcase.styleIds).toHaveLength(4);
    expect(landing.faq.items.length).toBeGreaterThanOrEqual(6);
    expect(landing.finalCta.title).toBe(brand.tagline);
    expect(landing.footer.madeIn).toBe("Made in India");
    expect(landing.footer.links.length).toBeGreaterThanOrEqual(3);
  });

  it("exposes all twenty-six presets with the original four first", () => {
    const ids = presetCards.map((p) => p.tokens.id);
    expect(ids).toHaveLength(94);
    expect(ids.slice(0, 4)).toEqual(["mikku-royal", "katana-pop", "noir-minimal", "bold-creator"]);
    for (const p of presetCards) expect(p.preview.big.length).toBeGreaterThan(0);
    expect(presetCards[0]?.badge).toBe("Default");
  });
});
