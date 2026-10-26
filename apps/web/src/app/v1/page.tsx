import type { Metadata } from "next";
import { LandingV1 } from "@/components/landing/page-v1";

/** The v1 landing, always reachable for comparison; `/` is the one that counts for search. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
};

export default function LandingV1Page() {
  return <LandingV1 />;
}
