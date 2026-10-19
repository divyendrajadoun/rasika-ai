import type { CSSProperties } from "react";
import type { StyleTokens } from "@rasika/schema";
import { cn } from "@/lib/utils";

/** The engine's palette for one preset, as CSS values the fragments can use. */
export function reelColours(t: StyleTokens) {
  const p = t.palette;
  const accentKey = t.captionAccent ?? "gold";
  return {
    stage: p.stage,
    panel: p.mar,
    ink: p.iv,
    poster: p.gold,
    accent: p[accentKey] ?? p.gold,
    dark: p.ink,
    terracotta: p.ter,
  };
}

interface ReelLineProps {
  tokens: StyleTokens;
  /** The spoken line. */
  line: string;
  /** Which word is being spoken right now (lights the caption). */
  lit?: number;
  /** poster = the key line as poster type; caption = the caption row; both = a cropped stage with both. */
  mode?: "poster" | "caption" | "both";
  className?: string;
}

const splitWords = (s: string) => s.trim().split(/\s+/).filter(Boolean);

/**
 * The poster: the whole line in the engine's poster face, upper case, at the reel's own scale
 * (about 90px on a 1080px frame, so a third of that on a 360px fragment). The engine keeps the
 * last one or two words as the payoff line in the poster colour.
 */
function Poster({ tokens, line }: { tokens: StyleTokens; line: string }) {
  const c = reelColours(tokens);
  const words = splitWords(line);
  const tail = words.length > 3 ? words.slice(-2) : words.slice(-1);
  const head = words.slice(0, words.length - tail.length);
  return (
    <div className="reel-poster text-[1.3125rem] sm:text-[1.5rem]" style={{ color: c.ink, textWrap: "balance" }}>
      {head.length > 0 && <span className="block">{head.join(" ")}</span>}
      <span className="block" style={{ color: c.poster }}>
        {tail.join(" ")}
      </span>
    </div>
  );
}

/** The caption row, in the preset's caption style, with the spoken word lit. */
function Caption({ tokens, line, lit = 0 }: { tokens: StyleTokens; line: string; lit?: number }) {
  const c = reelColours(tokens);
  const words = splitWords(line);
  const i = Math.max(0, Math.min(lit, words.length - 1));
  const style = tokens.captionStyle;
  if (style === "off") return null;
  if (style === "one-word") {
    return (
      <p className="reel-caption text-[1.5rem]" style={{ color: c.accent }}>
        {words[i]}
      </p>
    );
  }
  if (style === "box") {
    return (
      <p className="reel-caption flex flex-wrap justify-center gap-x-2 text-[1.125rem]">
        {words.map((w, k) => (
          <span
            key={k}
            className={k === i ? "px-2 py-0.5" : ""}
            style={k === i ? { background: c.accent, color: c.dark, WebkitTextStroke: 0 } : undefined}
          >
            {w}
          </span>
        ))}
      </p>
    );
  }
  const start = style === "karaoke" ? Math.max(0, i - 1) : 0;
  const shown = style === "karaoke" ? words.slice(start, start + 3) : words;
  return (
    <p className="reel-caption flex flex-wrap justify-center gap-x-2 text-[1.125rem]">
      {shown.map((w, k) => (
        <span key={k} style={{ color: start + k === i && style !== "clean" ? c.accent : undefined }}>
          {w}
        </span>
      ))}
    </p>
  );
}

/**
 * A cropped piece of the reel's stage, built with the chosen preset's real tokens (palette, caption
 * style, caption accent). Root carries data-ui: inside it the product's conventions apply.
 */
export function ReelFragment({ tokens, line, lit = 0, mode = "both", className }: ReelLineProps) {
  const c = reelColours(tokens);
  const stageStyle = { background: c.stage, color: c.ink } as CSSProperties;
  if (mode === "poster")
    return (
      <div data-ui className={cn("px-6 py-6", className)} style={stageStyle}>
        <Poster tokens={tokens} line={line} />
      </div>
    );
  if (mode === "caption")
    return (
      <div
        data-ui
        className={cn("flex items-center justify-center px-6 py-6 text-center", className)}
        style={stageStyle}
      >
        <Caption tokens={tokens} line={line} lit={lit} />
      </div>
    );
  return (
    <div data-ui className={cn("relative aspect-[9/11] overflow-clip", className)} style={stageStyle}>
      {/* where the speaker stands: shoulders in the panel tone at the foot of the frame, under the caption */}
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 h-[38%] w-[74%] -translate-x-1/2 rounded-t-[50%]"
        style={{ background: c.panel }}
      />
      <div className="absolute inset-x-5 top-5 z-[1] text-center">
        <Poster tokens={tokens} line={line} />
      </div>
      <div className="absolute inset-x-4 bottom-[9%] z-[1] text-center">
        <Caption tokens={tokens} line={line} lit={lit} />
      </div>
    </div>
  );
}
