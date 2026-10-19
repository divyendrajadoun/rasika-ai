import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <main id="main" className="wrap flex min-h-dvh flex-col">
      <div className="flex h-16 items-center">
        <Wordmark />
      </div>
      <div className="flex flex-1 flex-col justify-center pb-24">
        <p className="head">This page isn&apos;t in the edit.</p>
        <p className="text-muted mt-4 max-w-[40ch]">
          The link may be old, or the reel it pointed at was deleted.
        </p>
        <Link href="/" className="button mt-8 w-fit">
          Back to the start
        </Link>
      </div>
    </main>
  );
}
