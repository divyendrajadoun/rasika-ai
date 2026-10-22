"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, Coins, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Projects", icon: LayoutGrid, match: (p: string) => p === "/dashboard" || p.startsWith("/dashboard/p/") },
  { href: "/dashboard/new", label: "New reel", icon: Plus, match: (p: string) => p.startsWith("/dashboard/new") },
  { href: "/dashboard/credits", label: "Credits", icon: Coins, match: (p: string) => p.startsWith("/dashboard/credits") },
  { href: "/help", label: "Help", icon: CircleHelp, match: (p: string) => p.startsWith("/help") },
];

/** Phones: the app's four places as a tab bar at the thumb (the top bar keeps only the account). */
export function MobileTabs() {
  const path = usePathname() ?? "";
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-3 bottom-3 z-[70] sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul
        data-glass="bar"
        className="grid grid-cols-4 rounded-[20px] px-1 py-1.5 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.6)]"
      >
        {TABS.map((t) => {
          const on = t.match(path);
          const Icon = t.icon;
          const isNew = t.href === "/dashboard/new";
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-[14px] text-[11px] transition-colors",
                  on ? "text-text font-semibold" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full",
                    isNew && "bg-[var(--gold)] text-[var(--ink)]",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
