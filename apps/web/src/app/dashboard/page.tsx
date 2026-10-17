import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { mockSignOut } from "@/app/login/actions";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

/** Phase 1 shell: the empty state. The project grid, wizard and uploads arrive in Phase 2. */
export default async function DashboardPage() {
  const jar = await cookies();
  const email = jar.get("rasika_session")?.value ?? "";
  return (
    <>
      <header className="border-gold/15 bg-stage/85 text-iv sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="container-x flex h-16 items-center justify-between">
          <Wordmark href="/dashboard" />
          <div className="flex items-center gap-3">
            <span className="text-iv/70 hidden text-sm sm:inline">{email}</span>
            <ThemeToggle />
            <form action={mockSignOut}>
              <button
                type="submit"
                className="border-gold/30 hover:bg-gold/10 h-10 rounded-full border px-4 text-sm font-medium"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="container-x py-16">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div
            className="arch ring-gold/80 flex h-56 w-40 items-end justify-center bg-[linear-gradient(180deg,var(--mar),var(--stage))] pb-4 ring-[3px]"
            aria-hidden
          >
            <span className="font-devanagari text-gold text-5xl">रस</span>
          </div>
          <h1 className="poster mt-8 text-5xl">No edits yet</h1>
          <p className="font-accent text-muted-foreground mt-3 text-2xl italic">
            Upload a talking reel and we&apos;ll do the rest.
          </p>
          <Link
            href="/dashboard/new"
            className="h-13 bg-ter mt-8 inline-flex items-center justify-center rounded-full px-8 text-base font-semibold text-white shadow-[0_14px_40px_rgba(200,69,47,.4)] transition hover:bg-[#d8553d]"
          >
            Create your first edit
          </Link>
        </div>
      </main>
    </>
  );
}
