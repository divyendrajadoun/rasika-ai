"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { nav } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * A floating bar of liquid glass that stays at the top of the page and refracts whatever scrolls
 * under it: the hero's headline, the reels, the tiles. The name at one end, four text links, one
 * action. It takes no room in the flow (the negative margin lets the hero start under it). On a
 * phone: the name, the action and a "Menu" text button that opens a full-screen sheet.
 */
export function Nav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <header className={cn("wrap sticky top-3 z-[60] -mb-[76px] pt-3", className)}>
      <nav
        data-glass="bar"
        className="flex h-[52px] items-center justify-between gap-6 px-5"
        aria-label="Primary"
      >
        <Wordmark />
        <ul className="hidden items-center gap-7 md:flex">
          {nav.links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="link inline-flex h-11 items-center">
                {l.label}
              </a>
            </li>
          ))}
          <li>
            <ThemeToggle />
          </li>
        </ul>
        <div className="flex items-center gap-6">
          <Link href={nav.cta.href} className="link inline-flex h-11 items-center font-medium">
            {nav.cta.label}
          </Link>
          <button
            type="button"
            className="link inline-flex h-11 items-center md:hidden"
            aria-expanded={open}
            aria-controls="menu-sheet"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </div>
      </nav>
      {open && (
        <div
          id="menu-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="bg-bg text-text fixed inset-0 z-[70] flex flex-col px-4 py-4"
          data-liquid-ignore
        >
          <div className="flex h-16 items-center justify-between">
            <Wordmark />
            <button
              type="button"
              className="link inline-flex h-11 items-center"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          <ul className="mt-10 flex flex-col gap-2">
            {nav.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="head block py-2">
                  {l.label}
                </a>
              </li>
            ))}
            <li className="pt-6">
              <Link href={nav.cta.href} className="button w-full">
                {nav.cta.label}
              </Link>
            </li>
            <li className="pt-2">
              <ThemeToggle />
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
