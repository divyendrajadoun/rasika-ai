import { LandingV1 } from "@/components/landing/page-v1";
import { LandingV2 } from "@/components/landing-v2/page-v2";

/**
 * Which landing `/` shows: v1, the design-handoff landing. v2 ("the cut room", docs/landing-v2-spec.md)
 * is the alternative; NEXT_PUBLIC_LANDING=v2 at build makes it the home page. Both stay reachable at
 * /v1 and /v2 whatever this says.
 */
const LANDING_VERSION: "v1" | "v2" = process.env.NEXT_PUBLIC_LANDING === "v2" ? "v2" : "v1";

export default function LandingPage() {
  return LANDING_VERSION === "v1" ? <LandingV1 /> : <LandingV2 />;
}
