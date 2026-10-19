import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** The name, set in the page face at text size: the navigation is small furniture. */
export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn("select-none text-[1.0625rem] font-medium tracking-[-0.01em]", className)}
      aria-label={`${brand.name} home`}
    >
      {brand.name}
    </Link>
  );
}
