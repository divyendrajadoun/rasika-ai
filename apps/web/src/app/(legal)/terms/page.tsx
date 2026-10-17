import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Terms of Service" };

/* DRAFT — marked for legal review (Phase 8 finalises). */
export default function TermsPage() {
  return (
    <article>
      <p className="kicker text-ter">Draft · for legal review</p>
      <h1>Terms of Service</h1>
      <p>
        These terms govern your use of {brand.name}. By creating an account you agree to them. The
        full text is being finalised; the points below are the commitments we are building the
        product around.
      </p>
      <h2>Your content</h2>
      <p>
        You keep all rights to the videos and images you upload and to the reels you render. You
        confirm you own them or have permission to use them. {brand.name} never uses your content to
        train models.
      </p>
      <h2>What we don&apos;t do</h2>
      <p>
        No face swapping, voice cloning or generated likenesses. {brand.name} only edits footage you
        own. Content that is sexual, hateful or involves minors is blocked and refunded.
      </p>
      <h2>Billing</h2>
      <p>
        Credits are deducted when a final render starts and refunded automatically if the render
        fails. Subscriptions renew monthly and can be cancelled any time.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${brand.email}`}>{brand.email}</a>
      </p>
    </article>
  );
}
