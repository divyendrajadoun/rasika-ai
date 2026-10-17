import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <main
      id="main"
      className="jaali grain text-iv flex min-h-dvh flex-col items-center justify-center px-4 text-center"
    >
      <div className="relative z-[2]">
        <Wordmark />
        <p className="poster text-gold mt-10 text-8xl">404</p>
        <p className="font-accent mt-2 text-2xl italic">This page isn&apos;t in the edit.</p>
        <Link
          href="/"
          className="bg-ter mt-8 inline-flex h-12 items-center rounded-full px-7 font-semibold text-white"
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
