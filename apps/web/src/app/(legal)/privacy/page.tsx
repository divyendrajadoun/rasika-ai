import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

/* DRAFT — marked for legal review (Phase 8 finalises). */
export default function PrivacyPage() {
  return (
    <article>
      <p className="kicker text-ter">Draft · for legal review</p>
      <h1>Privacy Policy</h1>
      <p>
        {brand.name} stores the minimum needed to make your reels: your email, your uploads,
        transcripts, edit plans and rendered outputs.
      </p>
      <h2>Retention</h2>
      <p>
        Source videos and outputs are kept for 30 days by default (configurable per plan), then
        deleted. Frames extracted for rendering are deleted immediately after the render. You can
        delete a project instantly, and request deletion of all your data from your settings page.
      </p>
      <h2>Processors</h2>
      <p>
        Transcription runs on our own workers. Edit planning uses the Anthropic API under a
        zero-retention arrangement where available. Files are stored on S3-compatible storage;
        payments are handled by Razorpay or Stripe, who never share card details with us.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${brand.email}`}>{brand.email}</a>
      </p>
    </article>
  );
}
