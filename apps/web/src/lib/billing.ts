import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import type { Pack } from "@/config/pricing";

/**
 * Manual UPI: the buyer pays the shop's UPI ID from any app (the order's reference in the note),
 * then types the 12-digit UTR; an admin matches it against the bank statement and approves it on
 * /admin, which adds the credits. No gateway, no fee.
 */
export interface UpiConfig {
  vpa: string;
  payee: string;
}

export function upiConfig(): UpiConfig | null {
  const vpa = (process.env.UPI_VPA ?? "").trim();
  if (!/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(vpa)) return null;
  return { vpa, payee: (process.env.UPI_PAYEE_NAME ?? "Rasika").trim() || "Rasika" };
}

/** A short reference the buyer puts in the UPI note, e.g. RSK7Q2M9K (no 0/O/1/I to misread). */
export function orderRef(): string {
  const abc = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = randomBytes(6);
  return "RSK" + [...b].map((x) => abc[x % abc.length]).join("");
}

export function upiLink(cfg: UpiConfig, rupees: number, ref: string): string {
  // %20 for spaces: some UPI apps show a "+" literally
  const q: Array<[string, string]> = [
    ["pa", cfg.vpa],
    ["pn", cfg.payee],
    ["am", rupees.toFixed(2)],
    ["cu", "INR"],
    ["tn", `${ref} Rasika`],
  ];
  return `upi://pay?${q.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, "@")}`).join("&")}`;
}

export async function upiQrSvg(link: string): Promise<string> {
  return QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

/** what a payments row keeps in `raw` */
export interface OrderRaw {
  pack: Pack["id"];
  reels: number;
  ref: string;
  utr?: string;
  submittedAt?: string;
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}

export const UTR_RE = /^\d{12}$/;
