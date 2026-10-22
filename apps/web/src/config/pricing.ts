/**
 * Pricing: the first reel is free, then one-off packs paid by UPI (confirmed by hand on /admin).
 * INR only for now. 1 credit = 1 reel up to 90 s; longer reels use more (`creditsForDuration`).
 */
export type Currency = "INR";

export interface Plan {
  /** the account's tier after buying: "free" until a pack is paid for, then "creator" */
  id: "free" | "creator";
  name: string;
  blurb: string;
  maxSeconds: number;
}

export const plans: Plan[] = [
  { id: "free", name: "Free", blurb: "Your first reel, on us.", maxSeconds: 60 },
  { id: "creator", name: "Paid", blurb: "Reels up to 3 minutes.", maxSeconds: 180 },
];

export interface Pack {
  id: "free" | "one" | "ten" | "thirty";
  name: string;
  /** reels (credits) in the pack */
  reels: number;
  /** rupees; 0 for the free first reel */
  inr: number;
  blurb: string;
  highlight?: boolean;
}

export const packs: Pack[] = [
  { id: "free", name: "First reel", reels: 1, inr: 0, blurb: "Free when you sign up. Up to 60 s." },
  { id: "one", name: "1 reel", reels: 1, inr: 399, blurb: "One reel, when you need it." },
  {
    id: "ten",
    name: "10 reels",
    reels: 10,
    inr: 2999,
    blurb: "For posting every week.",
    highlight: true,
  },
  { id: "thirty", name: "30 reels", reels: 30, inr: 8000, blurb: "For brands and busy studios." },
];

export const paidPacks = packs.filter((p) => p.inr > 0);

export function creditsForDuration(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 90));
}

export function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** what one reel costs in a pack, rounded to the rupee */
export const perReel = (p: Pack) => Math.round(p.inr / p.reels);
