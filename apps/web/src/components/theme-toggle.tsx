"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** An icon button: a moon on the light site (switch to dark), a sun on the dark one. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(readTheme()), []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rasika-theme", next);
    } catch {
      /* private mode */
    }
    setTheme(next);
    // the glass re-dyes its panels and re-takes its pictures of the re-coloured page
    window.dispatchEvent(new Event("rasika:theme"));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
      aria-pressed={theme === "dark"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full text-current opacity-80 transition-opacity hover:opacity-100",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
