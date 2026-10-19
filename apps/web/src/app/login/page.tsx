import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/wordmark";
import { LiquidGlass } from "@/components/motion/liquid-glass";
import { brand } from "@/config/brand";
import { hero } from "@/content/landing";
import { sendMagicLink, signInWithPassword, signUpWithPassword } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

type Q = { next?: string; error?: string; sent?: string; email?: string; mode?: string };

/**
 * Sign in: a finished reel plays across the right of the screen, and the form lies over its edge as
 * a pane of frosted liquid glass. The product named, one filled action.
 */
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
    <main id="main" className="relative flex min-h-dvh flex-col overflow-clip">
      {/* the reel behind the glass (decorative: the poster paints first, the clip loops muted) */}
      <div id="login-stage" className="absolute inset-y-0 right-0 hidden w-[62%] bg-[#111] lg:block" aria-hidden>
        <video
          src={hero.demo.after}
          poster={hero.demo.afterPoster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="wrap relative flex h-16 items-center">
        <Wordmark />
      </div>
      <div className="wrap relative flex flex-1 items-center py-12">
        <div
          data-glass="panel"
          data-glass-snapshot="#main"
          data-glass-shadow="false"
          className="w-full max-w-[440px] rounded-[22px] p-7 lg:ml-[20%]"
        >
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.02em]">Sign in</h1>
          <p className="text-muted mt-2">
            {passwordMode ? "With your email and password." : "We email you a link. No password."}
          </p>

          {sent === "link" && (
            <div className="bg-surface mt-6 rounded-[10px] p-4" role="status">
              <p className="font-medium">Check your inbox</p>
              <p className="text-muted mt-1 text-[14px]">
                We sent a magic link to <strong className="text-text">{email}</strong>. Open it on this device to continue.
              </p>
            </div>
          )}
          {sent === "confirm" && (
            <div className="bg-surface mt-6 rounded-[10px] p-4" role="status">
              <p className="font-medium">Confirm your email</p>
              <p className="text-muted mt-1 text-[14px]">
                We sent a confirmation link to <strong className="text-text">{email}</strong>. After confirming, sign in with your password.
              </p>
            </div>
          )}
          {errorText && (
            <p className="text-destructive bg-surface mt-4 rounded-[8px] px-3 py-2 text-[14px]" role="alert">
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
                  className="input rounded-[10px]"
                />
              </div>
              <button type="submit" className="button w-full rounded-[10px]">
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
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    defaultValue={email}
                    className="input rounded-[10px]"
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
                    className="input rounded-[10px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="submit" className="button rounded-[10px]">
                    Sign in
                  </button>
                  <button type="submit" formAction={signUpWithPassword} className="button button-ghost rounded-[10px]">
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
      </div>
      <LiquidGlass />
    </main>
  );
}
