import Link from "next/link";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function Wordmark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "font-accent text-gold select-none text-3xl italic leading-none tracking-tight",
        className,
      )}
      aria-label={`${brand.name} home`}
    >
      {brand.name}
    </Link>
  );
}
