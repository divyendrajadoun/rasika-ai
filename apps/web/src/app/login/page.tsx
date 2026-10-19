import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { brand } from "@/config/brand";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Q = { next?: string; error?: string; sent?: string; email?: string; mode?: string };

/** Sign in: one column on the page ground, the product named, one filled action. */
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
    <label htmlFor={id} className="label">
      {text}
    </label>
  );

  return (
    <main id="main" className="wrap flex min-h-dvh flex-col">
      <div className="flex h-16 items-center">
        <Wordmark />
      </div>
      <div className="grid12 flex-1 items-center py-12">
        <div className="col-span-12 w-full max-w-[400px] lg:col-span-5">
        <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Sign in</h1>
        <p className="text-muted mt-2">
          {passwordMode ? "With your email and password." : "We email you a link. No password."}
        </p>

        {sent === "link" && (
          <div className="bg-surface mt-6 rounded-[8px] p-4" role="status">
            <p className="font-medium">Check your inbox</p>
            <p className="text-muted mt-1 text-[14px]">
              We sent a magic link to <strong className="text-text">{email}</strong>. Open it on this device to continue.
            </p>
          </div>
        )}
        {sent === "confirm" && (
          <div className="bg-surface mt-6 rounded-[8px] p-4" role="status">
            <p className="font-medium">Confirm your email</p>
            <p className="text-muted mt-1 text-[14px]">
              We sent a confirmation link to <strong className="text-text">{email}</strong>. After confirming, sign in with your password.
            </p>
          </div>
        )}
        {errorText && (
          <p className="text-destructive bg-surface mt-4 rounded-[6px] px-3 py-2 text-[14px]" role="alert">
            {errorText}
          </p>
        )}

        {!passwordMode ? (
          <form action={sendMagicLink} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={next} />
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
                className="input"
              />
            </div>
            <button type="submit" className="button w-full">
              Send magic link
            </button>
            <p className="text-muted text-[14px]">
              <a href={`/login?next=${encodeURIComponent(next)}&mode=password`} className="link text-text">
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
                <input id="email" name="email" type="email" autoComplete="email" required defaultValue={email} className="input" />
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
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="submit" className="button">
                  Sign in
                </button>
                <button type="submit" formAction={signUpWithPassword} className="button button-ghost">
                  Create account
                </button>
              </div>
            </form>
            <p className="text-muted text-[14px]">
              <a href={`/login?next=${encodeURIComponent(next)}`} className="link text-text">
                Use a magic link instead
              </a>
            </p>
          </div>
        )}

        <p className="text-muted mt-8 text-[13px]">
          By continuing you agree to {brand.name}&apos;s{" "}
          <a href="/terms" className="link text-text">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="link text-text">
            Privacy
          </a>
          .
        </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- the demo reel's poster frame */}
        <img
          src="/demo/after-poster.webp"
          alt="A reel edited by Rasika: poster type above the speaker and a one-word caption."
          className="col-span-12 mt-12 hidden aspect-[9/16] w-full max-w-[380px] rounded-[8px] object-cover lg:col-start-8 lg:col-span-5 lg:mt-0 lg:block lg:justify-self-end"
        />
      </div>
    </main>
  );
}
