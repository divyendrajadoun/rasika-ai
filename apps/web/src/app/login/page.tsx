import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";
import { mockSignIn } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/dashboard", error } = await searchParams;
  return (
    <main
      id="main"
      className="jaali grain text-iv flex min-h-dvh items-center justify-center px-4 py-16"
    >
      <div className="border-gold/25 bg-mar/60 relative z-[2] w-full max-w-md rounded-3xl border p-8 shadow-[0_40px_90px_rgba(0,0,0,.45)] backdrop-blur-sm">
        <Wordmark />
        <h1 className="poster mt-6 text-4xl">Sign in</h1>
        <p className="font-accent text-iv/85 mt-2 text-xl italic">
          We&apos;ll email you a magic link. No password.
        </p>
        {/* MOCK: Phase 2 wires this form to Supabase Auth (magic link + Google). */}
        <form action={mockSignIn} className="mt-8 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <label htmlFor="email" className="kicker text-gold mb-2 block text-[0.65rem]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="you@brand.in"
              className="border-gold/30 bg-ink/40 text-iv placeholder:text-iv/40 h-12 w-full rounded-xl border px-4 text-base"
              aria-invalid={error === "email" || undefined}
              aria-describedby={error === "email" ? "email-error" : undefined}
            />
            {error === "email" && (
              <p id="email-error" className="mt-2 text-sm text-[#ff8a66]">
                That doesn&apos;t look like an email address.
              </p>
            )}
          </div>
          <button
            type="submit"
            className="bg-ter inline-flex h-12 w-full items-center justify-center rounded-full text-base font-semibold text-white transition hover:bg-[#d8553d]"
          >
            Send magic link
          </button>
          <p className="text-iv/60 text-center text-xs">
            Preview build: signing in creates a local session only. Google sign-in arrives with
            Phase 2.
          </p>
        </form>
        <p className="text-iv/60 mt-6 text-center text-xs">
          By continuing you agree to {brand.name}&apos;s{" "}
          <a href="/terms" className="hover:text-gold underline">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="hover:text-gold underline">
            Privacy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
