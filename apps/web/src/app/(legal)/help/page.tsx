import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to use Rasika",
  description: "Four short videos: your first reel, a film without a camera, editing and exports, buying reels.",
};

const VIDEOS = [
  {
    id: "first-reel",
    file: "rasika-how-to-1-first-reel",
    title: "1 · Make your first reel",
    text: "Upload a video of you talking, pick a style, and Rasika times every word, designs the edit and renders the reel. Your first one is free.",
  },
  {
    id: "film-from-a-brief",
    file: "rasika-how-to-2-film-from-a-brief",
    title: "2 · Make a film without a camera",
    text: "No footage? Give Rasika a website link or a brief, and it writes, scores and renders a whole film.",
  },
  {
    id: "edit-and-export",
    file: "rasika-how-to-3-edit-and-export",
    title: "3 · Edit your reel and export it",
    text: "Cut words straight from the transcript, clean the sound, render again, and make square or wide copies for YouTube and LinkedIn.",
  },
  {
    id: "buy-reels",
    file: "rasika-how-to-4-buy-reels",
    title: "4 · Buy more reels",
    text: "Pick a pack, pay by UPI from any app, send the 12-digit UTR, and your reels are added once the payment is confirmed.",
  },
];

/** The four how-to videos, recorded on the real app (tools/tutorials). */
export default function HelpPage() {
  return (
    <article>
      <h1>How to use Rasika</h1>
      <p className="text-muted">Four short videos, each under two minutes, with sound.</p>
      {VIDEOS.map((v) => (
        <section key={v.id} id={v.id} className="scroll-mt-8">
          <h2>{v.title}</h2>
          <p>{v.text}</p>
          <video
            src={`/tutorials/${v.file}.mp4`}
            poster={`/tutorials/${v.file}.jpg`}
            controls
            playsInline
            preload="none"
            className="mt-5 aspect-video w-full rounded-[10px] bg-[#111]"
          />
        </section>
      ))}
      <p className="mt-12">
        <Link href="/dashboard/new" className="button !no-underline">
          Make my free reel
        </Link>
      </p>
    </article>
  );
}
