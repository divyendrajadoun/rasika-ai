import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

/** The legal pages: the page face, one reading column, the plain navigation. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="wrap">
        <div className="flex h-16 items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-6 text-[14px]">
            <ThemeToggle />
            <Link href="/" className="link">
              Home
            </Link>
          </div>
        </div>
      </header>
      <main
        id="main"
        className="wrap max-w-[72ch] py-16 [&_h1]:head [&_h2]:lead [&_h2]:mt-12 [&_h2]:font-semibold [&_p]:mt-4 [&_p]:max-w-[62ch] [&_a]:underline [&_a]:underline-offset-[0.2em]"
      >
        {children}
      </main>
    </>
  );
}
