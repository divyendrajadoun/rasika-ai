import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="border-gold/15 bg-stage/85 text-iv sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="container-x flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Wordmark href="/dashboard" />
            <nav className="hidden items-center gap-5 text-sm sm:flex" aria-label="Dashboard">
              <Link href="/dashboard" className="text-iv/85 hover:text-gold">
                Projects
              </Link>
              <Link href="/dashboard/new" className="text-iv/85 hover:text-gold">
                New edit
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="kicker text-gold hidden text-[0.6rem] md:inline" title="Credits left">
              {user.credits} credit{user.credits === 1 ? "" : "s"} · {user.plan}
            </span>
            <span className="text-iv/70 hidden max-w-[180px] truncate text-sm lg:inline">
              {user.email}
            </span>
            <ThemeToggle />
            <form action={signOut}>
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
      <main id="main" className="container-x py-8 sm:py-12">
        {children}
      </main>
    </>
  );
}
