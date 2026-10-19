"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Position in its group; the CSS staggers siblings by --stagger-item. */
  index?: number;
  /** "rise" = 24px rise + fade (default). "shutter" = opens from the top like a clip wipe. */
  kind?: "rise" | "shutter";
  as?: "div" | "li" | "article" | "figure";
}

/* One shared observer for the page; each element is shown once, when its top passes 88% of the viewport. */
let observer: IntersectionObserver | null = null;
function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          observer?.unobserve(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  );
  return observer;
}

/**
 * Section entrance. The content is in the server HTML and painted on the first frame; only when
 * scripts run and motion is allowed (globals.css: `.js [data-reveal]`) does the start state apply,
 * and this flips it when the element scrolls in. Reduced motion → the finished page.
 */
export function Reveal({ children, className, index = 0, kind = "rise", as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("is-in");
      return;
    }
    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);
  const Tag = as as "div";
  return (
    <Tag
      ref={ref as never}
      data-reveal=""
      className={cn(kind === "shutter" && "shutter", className)}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </Tag>
  );
}
