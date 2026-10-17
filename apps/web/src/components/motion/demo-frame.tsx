"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Marks a CSS demo as playing only while it is on screen (saves CPU and battery). */
export function DemoFrame({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) el.setAttribute("data-play", "");
          else el.removeAttribute("data-play");
        }
      },
      { rootMargin: "-5% 0px -5% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("demo", className)} aria-hidden>
      {children}
    </div>
  );
}
