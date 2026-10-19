"use client";

import { Clapperboard, FileText, ScanSearch, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the reel comes from.
 *  take       the owner's talking-head clip (the original flow)
 *  script     no footage: a script narrated by a voice, the film drawn by the engine
 *  reference  a talking-head clip cut in the rhythm and look of a reference reel
 *  presenter  script + photo → avatar video — needs an avatar provider, not enabled yet
 */
export type SourceMode = "take" | "script" | "reference" | "presenter";

interface Option {
  id: SourceMode;
  title: string;
  blurb: string;
  detail: string;
  icon: typeof Clapperboard;
  disabled?: string;
}

const OPTIONS: Option[] = [
  {
    id: "take",
    title: "My take",
    blurb: "Upload a talking-head clip. We time every word and design the edit around you.",
    detail: "Captions, poster type, counters, your photos on the word.",
    icon: Clapperboard,
  },
  {
    id: "script",
    title: "Script only",
    blurb: "No footage. Paste a script; a voice narrates it and the engine draws the whole film.",
    detail: "Pick a voice and a style. English voices for now.",
    icon: FileText,
  },
  {
    id: "reference",
    title: "Match a reference",
    blurb: "Upload your take and a reel you love. We measure its pacing, camera and look, then cut yours the same way.",
    detail: "Shot length, cut cadence, palette and type are matched; your words stay yours.",
    icon: ScanSearch,
  },
  {
    id: "presenter",
    title: "AI presenter",
    blurb: "A script and one photo become a presenter video.",
    detail: "Needs an avatar and lip-sync provider. Not enabled on this workspace yet.",
    icon: UserRound,
    disabled: "Needs an avatar provider",
  },
];

export function StepSource({
  value,
  onChange,
  presenterEnabled = false,
}: {
  value: SourceMode;
  onChange: (m: SourceMode) => void;
  /** the worker has a HeyGen key */
  presenterEnabled?: boolean;
}) {
  const options = OPTIONS.map((o) =>
    o.id === "presenter" && presenterEnabled
      ? { ...o, disabled: undefined, detail: "Rendered by HeyGen from your wallet, then edited like any take." }
      : o,
  );
  return (
    <div className="space-y-4">
      <p className="font-accent text-muted-foreground text-xl italic">
        Three ways in. Every one of them ends in the same editor and the same styles.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Source">
        {options.map((o) => {
          const on = value === o.id;
          const Icon = o.icon;
          return (
            <li key={o.id}>
              <button
                type="button"
                role="radio"
                aria-checked={on}
                disabled={Boolean(o.disabled)}
                onClick={() => onChange(o.id)}
                className={cn(
                  "bg-card flex h-full w-full flex-col gap-2 rounded-2xl border p-5 text-left transition",
                  on && "border-ter ring-ter/40 ring-2",
                  o.disabled ? "cursor-not-allowed opacity-60" : "hover:-translate-y-0.5",
                )}
              >
                <span className="flex items-center justify-between">
                  <Icon className="text-ter size-6" aria-hidden />
                  {o.disabled && (
                    <span className="kicker bg-muted text-foreground/70 rounded-full px-2 py-0.5 text-[0.55rem]">
                      {o.disabled}
                    </span>
                  )}
                </span>
                <span className="poster text-2xl leading-none">{o.title}</span>
                <span className="text-sm">{o.blurb}</span>
                <span className="text-muted-foreground text-xs">{o.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
