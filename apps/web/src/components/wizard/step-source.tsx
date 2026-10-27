"use client";

import {
  Clapperboard,
  FileText,
  Layers,
  ScanSearch,
  Scissors,
  Sparkles,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Where the reel comes from.
 *  take       the owner's talking-head clip (the original flow)
 *  clips      many clips of one talk, ordered by what is said and joined into one take
 *  messy      one video already joined in a phone app: cut back into its shots, cleaned up,
 *             checked by the user, then styled
 *  script     no footage: a script narrated by a voice, the film drawn by the engine
 *  reference  a talking-head clip cut in the rhythm and look of a reference reel
 *  presenter  script + photo → avatar video — needs an avatar provider, not enabled yet
 */
export type SourceMode =
  | "take"
  | "messy"
  | "clips"
  | "script"
  | "reference"
  | "presenter"
  | "brief";

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
    id: "messy",
    title: "One messy video",
    blurb:
      "Already joined your clips in VN or CapCut? Upload that one video. We take out the ums, bad takes, false starts and shots you can't use, and put the rest in order.",
    detail: "You check the shots, then pick a style.",
    icon: Scissors,
  },
  {
    id: "clips",
    title: "Many clips",
    blurb: "Drop every clip you shot. We put them in the order of what you say, keep the best take of each line and join them.",
    detail: "Paste your script to follow its order. The ums, retakes and dead air come out.",
    icon: Layers,
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
    id: "brief",
    title: "From a brief",
    blurb: "No footage at all. Give a website, a recipe, two contenders or a line, and we write, score and design the film.",
    detail:
      "15 films: product, launch, hype, referral and Apple-style films and a 3D fly-over from your website; diagram, animated and editorial explainers and recipes from a topic; fights, tier lists, music machines and storybooks.",
    icon: Sparkles,
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
      ? { ...o, disabled: undefined, detail: "Rendered from your script and a face, then edited like any take." }
      : o,
  );
  return (
    <div className="space-y-4">
      <p className="text-muted">
        Six ways in. Footage, clips, a script, a presenter and a reference all end in the same editor and the same styles; a brief makes a whole film.
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
                  "bg-surface flex h-full w-full flex-col gap-2 rounded-[8px] p-5 text-left transition-colors",
                  on && "ring-2 ring-text",
                  o.disabled ? "cursor-not-allowed opacity-60" : "",
                )}
              >
                <span className="flex items-center justify-between">
                  <Icon className="text-accent size-6" aria-hidden />
                  {o.disabled && (
                    <span className="text-[12px] font-medium bg-raised text-foreground/70 rounded-full px-2 py-0.5 text-[11px]">
                      {o.disabled}
                    </span>
                  )}
                </span>
                <span className="text-lg font-semibold leading-tight tracking-[-0.02em]">{o.title}</span>
                <span className="text-sm">{o.blurb}</span>
                <span className="text-muted-foreground text-[13px]">{o.detail}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const SHORT: Record<SourceMode, string> = {
  take: "My video",
  messy: "One messy video",
  clips: "Many clips",
  script: "A script",
  brief: "From a brief",
  reference: "Match a reel",
  presenter: "AI presenter",
};

/**
 * The first step's compact switch (the wizard opens straight on "My video"): one row of chips for
 * where the reel comes from, the chosen one's line of help under it.
 */
export function SourceSwitch({
  value,
  onChange,
  presenterEnabled = false,
}: {
  value: SourceMode;
  onChange: (m: SourceMode) => void;
  presenterEnabled?: boolean;
}) {
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0]!;
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Where the reel comes from">
        {OPTIONS.map((o) => {
          const off = o.id === "presenter" && !presenterEnabled;
          const on = value === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={off}
              title={off ? o.disabled : o.blurb}
              onClick={() => onChange(o.id)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-[14px] transition-colors",
                on ? "bg-text text-bg font-medium" : "bg-surface hover:bg-raised",
                off && "cursor-not-allowed opacity-50",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {SHORT[o.id]}
            </button>
          );
        })}
      </div>
      <p className="text-muted mt-3 text-[14px]">{current.blurb}</p>
    </div>
  );
}
