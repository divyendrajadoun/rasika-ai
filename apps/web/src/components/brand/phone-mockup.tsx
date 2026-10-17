import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A 9:16 phone frame. Children fill the screen. */
export function PhoneMockup({
  children,
  className,
  screenClassName,
}: {
  children: ReactNode;
  className?: string;
  screenClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[9/19] w-full rounded-[2.6rem] border-[6px] border-[#1c1c20] bg-[#0d0d0f] p-1.5 shadow-[0_40px_90px_rgba(0,0,0,.45)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-2.5 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-[#1c1c20]"
      />
      <div
        className={cn(
          "bg-stage relative h-full w-full overflow-hidden rounded-[2.1rem]",
          screenClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
