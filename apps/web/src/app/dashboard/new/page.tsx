import type { Metadata } from "next";
import Link from "next/link";
import { presetCards, defaultPresetId } from "@/config/presets";

export const metadata: Metadata = { title: "New edit", robots: { index: false } };

/** Phase 1 placeholder for the 4-step wizard (Phase 2). Honours the `?style=` deep link. */
export default async function NewEditPage({
  searchParams,
}: {
  searchParams: Promise<{ style?: string }>;
}) {
  const { style } = await searchParams;
  const chosen =
    presetCards.find((p) => p.tokens.id === style) ??
    presetCards.find((p) => p.tokens.id === defaultPresetId);
  return (
    <main id="main" className="container-x py-16">
      <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
        ← Dashboard
      </Link>
      <h1 className="poster mt-4 text-5xl">New edit</h1>
      <p className="font-accent text-muted-foreground mt-2 text-2xl italic">
        Style: <span className="text-ter">{chosen?.tokens.name}</span>
      </p>
      <ol className="mt-10 grid gap-4 sm:grid-cols-4">
        {["Upload reel", "Your photos", "Style", "Brand & ending"].map((s, i) => (
          <li key={s} className="bg-card rounded-2xl border p-5">
            <span className="poster text-gold text-4xl">0{i + 1}</span>
            <p className="poster mt-2 text-xl">{s}</p>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground mt-8 rounded-xl border border-dashed p-5 text-sm">
        The upload wizard (resumable multipart upload, photo crop, style box, brand card) ships in
        Phase 2.
      </p>
    </main>
  );
}
