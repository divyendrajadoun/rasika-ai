import type { Metadata } from "next";
import { LandingV2 } from "@/components/landing-v2/page-v2";

/** The v2 landing, always reachable for comparison; `/` is the one that counts for search. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default function LandingV2Page() {
  return <LandingV2 />;
}
