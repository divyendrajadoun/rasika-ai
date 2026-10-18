"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { nav } from "@/content/landing";
import { cn } from "@/lib/utils";

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-gold/10 bg-stage/70 text-iv sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150">
      <nav
        className="container-x flex h-16 items-center justify-between gap-4"
        aria-label="Primary"
      >
        <Wordmark />
        <ul className="hidden items-center gap-7 md:flex">
          {nav.links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-iv/85 hover:text-gold text-sm font-medium transition"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={nav.cta.href}
            className="bg-ter hidden h-10 items-center rounded-full px-5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(200,69,47,.35)] transition hover:bg-[#d8553d] sm:inline-flex"
          >
            {nav.cta.label}
          </Link>
          <button
            type="button"
            className="border-gold/30 inline-flex size-10 items-center justify-center rounded-full border md:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </nav>
      <div
        id="mobile-nav"
        className={cn(
          "container-x grid overflow-hidden transition-[grid-template-rows] duration-300 md:hidden",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0">
          <ul className="flex flex-col gap-1 pb-4">
            {nav.links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="text-iv/90 hover:bg-gold/10 block rounded-lg px-3 py-3 text-base font-medium"
                >
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-2 sm:hidden">
              <Link
                href={nav.cta.href}
                className="bg-ter flex h-11 items-center justify-center rounded-full text-sm font-semibold text-white"
              >
                {nav.cta.label}
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </header>
  );
}
