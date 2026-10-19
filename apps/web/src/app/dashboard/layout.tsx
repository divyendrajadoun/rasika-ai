import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";

/**
 * The app shell: one ground everywhere, a 64px top bar divided from the canvas by a single rule
 * (the "no sidebar" archetype: the product has two destinations). The bar names the product, the
 * two destinations, the account's credits and plan, and the one way out.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div data-app className="min-h-dvh">
      <header className="app-bar">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Wordmark href="/dashboard" />
            <nav className="hidden items-center gap-6 text-[14px] sm:flex" aria-label="Dashboard">
              <Link href="/dashboard" className="link">
                Projects
              </Link>
              <Link href="/dashboard/new" className="link">
                New edit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-5 text-[14px]">
            <span className="text-muted hidden md:inline" title="Credits left">
              <span className="text-text font-medium tabular-nums">{user.credits}</span> credit
              {user.credits === 1 ? "" : "s"} · {user.plan}
            </span>
            <span className="text-muted hidden max-w-[200px] truncate lg:inline">{user.email}</span>
            <ThemeToggle className="text-[14px]" />
            <form action={signOut}>
              <button type="submit" className="link h-11 font-medium">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="wrap py-8 sm:py-10">
        {children}
      </main>
    </div>
  );
}
