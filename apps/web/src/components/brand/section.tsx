import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: string;
  sub?: string;
  children: ReactNode;
  className?: string;
  /** "maroon" = jaali stage with ivory text; "default" = page background. */
  tone?: "default" | "maroon";
  align?: "center" | "left";
}

export function Section({
  id,
  eyebrow,
  title,
  sub,
  children,
  className,
  tone = "default",
  align = "center",
}: SectionProps) {
  const maroon = tone === "maroon";
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 py-20 sm:py-24 lg:py-28",
        maroon && "jaali grain text-iv",
        className,
      )}
    >
      <div className="container-x relative z-[2]">
        {(eyebrow || title) && (
          <header
            className={cn("mb-12 max-w-3xl", align === "center" ? "mx-auto text-center" : "")}
          >
            {eyebrow && (
              <p className={cn("kicker mb-4", maroon ? "text-gold" : "text-goldd dark:text-gold")}>
                {eyebrow}
              </p>
            )}
            {title && <h2 className="poster text-balance text-[2.4rem] sm:text-6xl">{title}</h2>}
            {sub && (
              <p
                className={cn(
                  "font-accent mt-5 text-xl italic sm:text-2xl",
                  maroon ? "text-iv/85" : "text-muted-foreground",
                )}
              >
                {sub}
              </p>
            )}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}
