"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { brand } from "@/config/brand";
import { nav } from "@/content/landing";

/**
 * A floating glass bar that stays at the top of the page: the arch and the name, four links, the
 * theme toggle and one gold action. It takes no room in the flow (the negative margin lets the hero
 * start under it). Under 760px: the name, the action and "Menu", which opens a full-screen sheet.
 */
export function Nav() {
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
    <header className="lp-nav-wrap">
      <nav className="lp-nav" aria-label="Primary">
        <Logo />
        <div className="lp-nav-links">
          {nav.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <ThemeToggle className="lp-theme" />
        <div className="lp-nav-spacer" />
        <Link href={nav.cta.href} className="lp-btn lp-nav-cta">
          {nav.cta.label}
        </Link>
        <button
          type="button"
          className="lp-menu-btn"
          aria-expanded={open}
          aria-controls="menu-sheet"
          onClick={() => setOpen(true)}
        >
          Menu
        </button>
      </nav>
      {open && (
        <div id="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu" className="lp-sheet">
          <div className="flex h-[52px] items-center justify-between">
            <Logo />
            <button type="button" className="h-11 px-3.5" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <nav className="flex flex-col gap-1.5" aria-label="Menu">
            {nav.links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
          </nav>
          <Link href={nav.cta.href} className="lp-btn lp-sheet-cta">
            {nav.cta.label}
          </Link>
          <ThemeToggle className="lp-sheet-theme" />
        </div>
      )}
    </header>
  );
}

function Logo() {
  return (
    <Link href="/" className="lp-logo" aria-label={`${brand.name} home`}>
      <span className="lp-logo-glyph" aria-hidden />
      {brand.name}
    </Link>
  );
}
