"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { brand } from "@/config/brand";
import { nav } from "@/content/landing";
import { cn } from "@/lib/utils";

/**
 * Three floating pieces: the mark, the links on glass, and the theme toggle with the one ivory
 * action. A soft shadow once the page has moved. Under 860px: mark, action and "Menu", which opens
 * a full-screen sheet (Esc, a link or a resize closes it; the page underneath stays put).
 */
export function Nav() {
  const [open, setOpen] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const on = () => setMoved(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    // a phone's toolbar showing or hiding is a resize too: only a width change closes the sheet
    const w = window.innerWidth;
    const onResize = () => window.innerWidth !== w && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = "";
    };
  }, [open]);

  // the sheet sits outside the header: the header's entrance animation would otherwise become the
  // box a fixed child is placed in, and the sheet would be clipped to the bar
  return (
    <>
      <header className={cn("v2-nav", moved && "is-moved")}>
        <Mark />
        <nav className="v2-nav-links v2-glass" aria-label="Primary">
          {nav.links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="v2-nav-end">
          <ThemeToggle className="v2-glass v2-theme" />
          <Link href={nav.cta.href} className="v2-btn v2-btn-ivory v2-nav-cta">
            {nav.cta.label}
          </Link>
          <button
            type="button"
            className="v2-glass v2-menu-btn"
            aria-expanded={open}
            aria-controls="v2-menu"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
        </div>
      </header>
      {open && (
        <div
          id="v2-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="v2-sheet-menu"
        >
          <div className="v2-sheet-menu-top">
            <Mark />
            <button type="button" className="v2-glass v2-menu-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <nav aria-label="Menu">
            {nav.links.map((l, i) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                style={{ "--i": i } as CSSProperties}
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="v2-sheet-menu-end">
            <Link href={nav.cta.href} className="v2-btn v2-btn-ivory">
              {nav.cta.label}
            </Link>
            <ThemeToggle className="v2-glass v2-theme" />
          </div>
        </div>
      )}
    </>
  );
}

function Mark() {
  return (
    <Link href="/" className="v2-mark v2-glass" aria-label={`${brand.name} home`}>
      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden>
        <path d="M1 17V7a6 6 0 0 1 12 0v10z" fill="#c8452f" stroke="#e6b450" strokeWidth="1.6" />
      </svg>
      {brand.name}
    </Link>
  );
}
