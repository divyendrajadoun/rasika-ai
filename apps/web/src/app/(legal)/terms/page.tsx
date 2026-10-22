import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Terms of Service" };

/* DRAFT — marked for legal review (Phase 8 finalises). */
export default function TermsPage() {
  return (
    <article>
      
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
        Your first reel is free (one per person). After that, reels are bought in one-off packs paid
        by UPI; there is no subscription. A credit is taken when you submit a reel, and credits never
        expire. Payments are confirmed by hand, usually within a few hours; if one cannot be matched
        we will write to you. If a render fails, Retry runs it again at no charge; if a reel cannot
        be made at all, write to us and we refund its credit.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${brand.email}`}>{brand.email}</a>
      </p>
    </article>
  );
}
