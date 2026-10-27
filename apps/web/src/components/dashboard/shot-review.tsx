"use client";

import { useState } from "react";
import { finishShotReview } from "@/app/dashboard/actions";
import { ClipsPanel } from "@/components/dashboard/clips-panel";
import { StepStyle, type StyleState } from "@/components/wizard/step-style";
import type { ClipDecision, StyleOptions } from "@/db/schema";

/**
 * One messy video, cleaned up: the shots Rasika kept and left out (the clips panel), then the
 * style, then "Make my reel". The style starts from what the project has.
 */
export function ShotReview({
  projectId,
  arrangement,
  arrangedBy,
  urls,
  busy,
  maxSeconds,
  stockEnabled,
  preset,
  styleText,
  options,
}: {
  projectId: string;
  arrangement: ClipDecision[];
  arrangedBy?: string;
  urls: Record<string, string>;
  busy: boolean;
  maxSeconds: number;
  stockEnabled: boolean;
  preset: string;
  styleText: string;
  options: StyleOptions;
}) {
  const [style, setStyle] = useState<StyleState>({
    preset,
    text: styleText,
    captions: options.captions ?? true,
    sfxIntensity: options.sfxIntensity ?? 0.6,
    music: options.music ?? false,
    language: options.language ?? "auto",
    broll: Boolean(options.broll),
    cleanCut: true,
    hookFirst: Boolean(options.hookFirst),
    animated: Boolean(options.animated),
    animatedCount: options.animatedCount ?? 2,
    animatedLook: options.animatedLook ?? "",
  });
  return (
    <ClipsPanel
      projectId={projectId}
      arrangement={arrangement}
      arrangedBy={arrangedBy}
      urls={urls}
      busy={busy}
      review={{
        maxSeconds,
        extra: (
          <div>
            <h2 className="mb-4 text-xl font-semibold leading-tight tracking-[-0.02em]">
              Pick a style
            </h2>
            <StepStyle value={style} onChange={setStyle} stockEnabled={stockEnabled} recorded />
          </div>
        ),
        onFinish: (order) =>
          finishShotReview({
            projectId,
            order,
            stylePreset: style.preset,
            styleText: style.text,
            options: {
              captions: style.captions,
              sfxIntensity: style.sfxIntensity,
              music: style.music,
              language: style.language,
              broll: style.broll && stockEnabled,
              animated: Boolean(style.animated),
              animatedCount: style.animatedCount ?? 2,
              animatedLook: style.animatedLook ?? "",
              cleanCut: true,
              hookFirst: style.hookFirst,
            },
          }),
      }}
    />
  );
}
