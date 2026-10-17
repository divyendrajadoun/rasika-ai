import { cn } from "@/lib/utils";

interface RisingWordsProps {
  text: string;
  /** Word (case-insensitive, punctuation ignored) to colour gold. */
  goldWord?: string;
  className?: string;
  wordClassName?: string;
  /** Seconds before the first word starts. */
  delay?: number;
  /** Seconds between words. */
  stagger?: number;
}

/**
 * Words rise out of a mask one by one — the engine's `rise` kind, as pure CSS so it plays
 * at first paint (no hydration wait → good LCP) and degrades to static text without JS.
 * Reduced motion is handled globally in globals.css.
 */
export function RisingWords({
  text,
  goldWord,
  className,
  wordClassName,
  delay = 0.1,
  stagger = 0.055,
}: RisingWordsProps) {
  const words = text.split(" ");
  const norm = (w: string) => w.replace(/[.,?!]/g, "").toLowerCase();
  return (
    <span className={cn("inline", className)}>
      <span className="sr-only">{text}</span>
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="rise-mask">
          <span
            className={cn(
              "rise-word",
              goldWord && norm(w) === norm(goldWord) && "text-gold",
              wordClassName,
            )}
            style={{ animationDelay: `${(delay + i * stagger).toFixed(3)}s` }}
          >
            {w}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
