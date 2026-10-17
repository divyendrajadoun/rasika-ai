import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Palace-arch mask with a thin gold border — the end card's `arch` video mode. */
export function ArchFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "arch ring-gold/90 relative overflow-hidden shadow-[0_0_0_10px_rgba(230,180,80,.12),0_60px_120px_rgba(0,0,0,.55)] ring-[3px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
