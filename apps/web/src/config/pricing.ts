/**
 * Pricing config (placeholder plans from SPEC §5.8). INR is the primary currency;
 * USD values are display-only until Stripe lands (Phase 7).
 */
export type Currency = "INR" | "USD";

export interface Plan {
  id: "free" | "creator" | "pro" | "agency";
  name: string;
  blurb: string;
  price: Record<Currency, number | null>; // null → "Contact"
  period: "mo" | "custom";
  reelsPerMonth: number | null;
  maxSeconds: number;
  resolution: "720p" | "1080p";
  watermark: boolean;
  features: string[];
  cta: string;
  href: string;
  highlight?: boolean;
}

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    blurb: "Try the edit on one reel.",
    price: { INR: 0, USD: 0 },
    period: "mo",
    reelsPerMonth: 1,
    maxSeconds: 60,
    resolution: "720p",
    watermark: true,
    features: ["1 reel / month", "720p export", "Up to 60 s", "Small Rasika mark on the end card"],
    cta: "Start free",
    href: "/dashboard",
  },
  {
    id: "creator",
    name: "Creator",
    blurb: "For creators posting every week.",
    price: { INR: 999, USD: 12 },
    period: "mo",
    reelsPerMonth: 10,
    maxSeconds: 180,
    resolution: "1080p",
    watermark: false,
    features: [
      "10 reels / month",
      "1080p export",
      "Up to 3 min",
      "No watermark",
      "All style presets",
    ],
    cta: "Get Creator",
    href: "/dashboard?plan=creator",
    highlight: true,
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For brands and busy studios.",
    price: { INR: 2999, USD: 36 },
    period: "mo",
    reelsPerMonth: 40,
    maxSeconds: 180,
    resolution: "1080p",
    watermark: false,
    features: [
      "40 reels / month",
      "Brand kit: logo, colours, fonts, end card",
      "Priority render queue",
      "Everything in Creator",
    ],
    cta: "Get Pro",
    href: "/dashboard?plan=pro",
  },
  {
    id: "agency",
    name: "Agency",
    blurb: "Teams, shared brand kits, per-seat billing.",
    price: { INR: null, USD: null },
    period: "custom",
    reelsPerMonth: null,
    maxSeconds: 180,
    resolution: "1080p",
    watermark: false,
    features: ["Workspaces & seats", "Shared brand kits", "Volume credits", "Dedicated support"],
    cta: "Contact us",
    href: "mailto:hello@rasika.app?subject=Rasika%20Agency",
  },
];

export interface CreditPack {
  id: string;
  credits: number;
  price: Record<Currency, number>;
  note: string;
}

/** 1 credit = 1 reel ≤ 90 s. Longer reels cost more credits (see `creditsForDuration`). */
export const creditPacks: CreditPack[] = [
  { id: "pack-5", credits: 5, price: { INR: 599, USD: 8 }, note: "₹120 / reel" },
  { id: "pack-20", credits: 20, price: { INR: 1999, USD: 25 }, note: "₹100 / reel" },
  { id: "pack-50", credits: 50, price: { INR: 3999, USD: 49 }, note: "₹80 / reel" },
];

export function creditsForDuration(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 90));
}

export function formatPrice(amount: number | null, currency: Currency): string {
  if (amount === null) return "Contact";
  if (amount === 0) return currency === "INR" ? "₹0" : "$0";
  return currency === "INR" ? `₹${amount.toLocaleString("en-IN")}` : `$${amount}`;
}
