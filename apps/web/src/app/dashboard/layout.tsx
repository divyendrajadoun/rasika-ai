import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/login/actions";
import { LiquidGlass } from "@/components/motion/liquid-glass";
import { requireUser } from "@/lib/auth";

/**
 * The app shell: one ground everywhere and a floating bar of liquid glass at the top (the "no
 * sidebar" archetype: the product has two destinations). The reels scroll under the glass. The bar
 * names the product, the two destinations, the account's credits and plan, and the one way out.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div data-app className="min-h-dvh">
      <header className="wrap sticky top-3 z-[60] pt-3">
        <div data-glass="bar" className="flex h-[52px] items-center justify-between gap-4 px-5">
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
            <span className="hidden opacity-80 md:inline" title="Credits left">
              <span className="font-medium tabular-nums opacity-100">{user.credits}</span> credit
              {user.credits === 1 ? "" : "s"} · {user.plan}
            </span>
            <span className="hidden max-w-[200px] truncate opacity-80 lg:inline">{user.email}</span>
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
      <LiquidGlass />
    </div>
  );
}
