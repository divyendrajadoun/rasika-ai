import { LandingV1 } from "@/components/landing/page-v1";
import { LandingV2 } from "@/components/landing-v2/page-v2";

/**
 * Which landing `/` shows. v2 is "the cut room" (docs/landing-v2-spec.md); v1 is the design-handoff
 * landing. To go back, set this to "v1" (or NEXT_PUBLIC_LANDING=v1 at build). Both stay reachable at
 * /v1 and /v2 whatever this says.
 */
const LANDING_VERSION: "v1" | "v2" = process.env.NEXT_PUBLIC_LANDING === "v1" ? "v1" : "v2";

export default function LandingPage() {
  return LANDING_VERSION === "v1" ? <LandingV1 /> : <LandingV2 />;
}
