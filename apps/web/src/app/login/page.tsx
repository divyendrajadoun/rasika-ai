import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Q = { next?: string; error?: string; sent?: string; email?: string; mode?: string };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Q> }) {
  const { next = "/dashboard", error, sent, email = "", mode } = await searchParams;
  const passwordMode = mode === "password";
  const errorText =
    error === "email"
      ? "That doesn't look like an email address."
      : error
        ? decodeURIComponent(error)
        : null;
  const label = (id: string, text: string) => (
    <label htmlFor={id} className="kicker text-gold mb-2 block text-[0.65rem]">
      {text}
    </label>
  );

  return (
    <main
      id="main"
      className="jaali grain text-iv flex min-h-dvh items-center justify-center px-4 py-16"
    >
      <div className="border-gold/25 bg-mar/60 relative z-[2] w-full max-w-md rounded-3xl border p-8 shadow-[0_40px_90px_rgba(0,0,0,.45)] backdrop-blur-sm">
        <Wordmark />
        <h1 className="poster mt-6 text-4xl">Sign in</h1>

        {sent === "link" && (
          <div className="border-gold/40 bg-ink/40 mt-6 rounded-xl border p-4" role="status">
            <p className="font-accent text-gold text-xl italic">Check your inbox</p>
            <p className="text-iv/80 mt-1 text-sm">
              We sent a magic link to <strong>{email}</strong>. Open it on this device to continue.
            </p>
          </div>
        )}
        {sent === "confirm" && (
          <div className="border-gold/40 bg-ink/40 mt-6 rounded-xl border p-4" role="status">
            <p className="font-accent text-gold text-xl italic">Confirm your email</p>
            <p className="text-iv/80 mt-1 text-sm">
              We sent a confirmation link to <strong>{email}</strong>. After confirming, sign in
              with your password.
            </p>
          </div>
        )}
        {errorText && (
          <p
            className="mt-4 rounded-lg bg-[#ff8a66]/15 px-3 py-2 text-sm text-[#ff8a66]"
            role="alert"
          >
            {errorText}
          </p>
        )}

        {!passwordMode ? (
          <form action={sendMagicLink} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
            <p className="font-accent text-iv/85 text-xl italic">
              We&apos;ll email you a magic link. No password.
            </p>
            <div>
              {label("email", "Email")}
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                defaultValue={email}
                placeholder="you@brand.in"
                className="input-dark"
              />
            </div>
            <button type="submit" className="btn-ter w-full">
              Send magic link
            </button>
            <p className="text-iv/60 text-center text-xs">
              <a
                href={`/login?next=${encodeURIComponent(next)}&mode=password`}
                className="hover:text-gold underline"
              >
                Use a password instead
              </a>
            </p>
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <form action={signInWithPassword} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div>
                {label("email", "Email")}
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  defaultValue={email}
                  className="input-dark"
                />
              </div>
              <div>
                {label("password", "Password")}
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  className="input-dark"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="submit" className="btn-ter">
                  Sign in
                </button>
                <button type="submit" formAction={signUpWithPassword} className="btn-outline-gold">
                  Create account
                </button>
              </div>
            </form>
            <p className="text-iv/60 text-center text-xs">
              <a
                href={`/login?next=${encodeURIComponent(next)}`}
                className="hover:text-gold underline"
              >
                Use a magic link instead
              </a>
            </p>
          </div>
        )}

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
