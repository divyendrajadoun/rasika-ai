import type { Metadata } from "next";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy Policy" };

/* DRAFT — marked for legal review (Phase 8 finalises). */
export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p className="text-muted text-[14px]">Draft, for legal review.</p>
      <p>
        {brand.name} stores the minimum needed to make your reels and run your account: your email
        (and your name, if you sign in with Google), your uploads, transcripts, edit plans and
        rendered reels, your credits, and for each payment the amount, the UPI reference (UTR) you
        send us and whether we confirmed it.
      </p>
      <h2>Retention</h2>
      <p>
        Your projects, uploads and reels are kept until you delete them; deleting a project removes
        it from your dashboard straight away. Frames extracted for rendering are deleted after the
        render. To delete your account and everything in it, email us and we will do it within 7
        days. We keep payment records as the law requires.
      </p>
      <h2>Who processes your data</h2>
      <p>
        Supabase (accounts, database and file storage), Netlify (the website), Upstash (the job
        queue), Deepgram (transcription and narration voices), Anthropic (Claude plans the edit),
        Higgsfield (AI images, only when you ask for them), HeyGen (the AI presenter, only if you
        use it), Pexels (stock footage) and Google (only
        if you sign in with Google). Payments are made by UPI directly to our bank account; we never
        see your bank or card details. We do not sell your data or use your videos to train models.
      </p>
      <h2>Contact</h2>
      <p>
        <a href={`mailto:${brand.email}`}>{brand.email}</a>
      </p>
    </article>
  );
}
