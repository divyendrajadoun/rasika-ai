import { describe, expect, it } from "vitest";
import { creditsForDuration, formatPrice, packs, plans } from "./pricing";
import { presetCards } from "./presets";
import { brand } from "./brand";
import * as landing from "@/content/landing";

describe("pricing config", () => {
  it("is the launch pricing: one free reel, then 1 / 10 / 30 reel packs", () => {
    expect(packs.map((p) => [p.id, p.reels, p.inr])).toEqual([
      ["free", 1, 0],
      ["one", 1, 399],
      ["ten", 10, 2999],
      ["thirty", 30, 8000],
    ]);
    expect(plans.find((p) => p.id === "free")?.maxSeconds).toBe(60);
    expect(plans.find((p) => p.id === "creator")?.maxSeconds).toBe(180);
  });

  it("charges one credit per 90 s", () => {
    expect(creditsForDuration(30)).toBe(1);
    expect(creditsForDuration(90)).toBe(1);
    expect(creditsForDuration(91)).toBe(2);
    expect(creditsForDuration(180)).toBe(2);
  });

  it("formats rupees", () => {
    expect(formatPrice(2999)).toBe("₹2,999");
    expect(formatPrice(8000)).toBe("₹8,000");
  });
});

describe("landing content", () => {
  it("has every section the spec lists", () => {
    expect(landing.nav.links.map((l) => l.label)).toEqual([
      "How it works",
      "Examples",
      "Pricing",
      "FAQ",
    ]);
    expect(landing.hero.headline).toBe("Talk to your phone. Post like a studio.");
    expect(landing.hero.lines).toHaveLength(2);
    expect(landing.hero.hindiLines).toHaveLength(2);
    expect(landing.howItWorks.steps).toHaveLength(6);
    expect(landing.features.items).toHaveLength(8);
    expect(landing.showcase.styleIds).toHaveLength(4);
    expect(landing.faq.items.length).toBeGreaterThanOrEqual(6);
    expect(landing.finalCta.title).toBe(brand.tagline);
    expect(landing.footer.madeIn).toBe("Made in India");
    expect(landing.footer.links.length).toBeGreaterThanOrEqual(3);
  });

  it("exposes every preset once (the landing says 107), the original four first", () => {
    const ids = presetCards.map((p) => p.tokens.id);
    expect(ids).toHaveLength(107);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.slice(0, 4)).toEqual(["mikku-royal", "katana-pop", "noir-minimal", "bold-creator"]);
    for (const p of presetCards) expect(p.preview.big.length).toBeGreaterThan(0);
    expect(presetCards[0]?.badge).toBe("Default");
  });
});
