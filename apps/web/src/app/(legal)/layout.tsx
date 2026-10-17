import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-gold/15 bg-stage text-iv border-b">
        <div className="container-x flex h-16 items-center justify-between">
          <Wordmark />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/" className="hover:text-gold text-sm">
              ← Home
            </Link>
          </div>
        </div>
      </header>
      <main
        id="main"
        className="container-x prose-sm [&_h1]:poster [&_h2]:poster [&_p]:text-muted-foreground max-w-3xl py-16 [&_h1]:text-5xl [&_h2]:mt-10 [&_h2]:text-2xl [&_p]:mt-4 [&_p]:leading-relaxed"
      >
        {children}
      </main>
    </>
  );
}
