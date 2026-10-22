"use client";

import { useState, useTransition } from "react";
import { safeAction } from "@/lib/safe-action";
import { useRouter } from "next/navigation";
import { exportReel } from "@/app/dashboard/actions";

const SHAPES = [
  { format: "1:1", label: "Square 1:1", for: "LinkedIn, X, the Instagram grid" },
  { format: "4:5", label: "Portrait 4:5", for: "Instagram and Facebook feed, LinkedIn" },
  { format: "16:9", label: "Wide 16:9", for: "YouTube, X, presentations" },
] as const;

/**
 * The finished reel in other shapes. The 9:16 reel is fitted whole (no poster type cropped off) on
 * a blurred copy of itself; Reels, Shorts and TikTok take the 9:16 download as it is.
 */
export function ExportShapes({
  projectId,
  ready,
  busy,
}: {
  projectId: string;
  /** format → download URL of an export already made */
  ready: Record<string, string>;
  busy: boolean;
}) {
  const [pending, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const make = (format: string) => {
    setError(null);
    setWhich(format);
    start(async () => {
      const r = await safeAction(() => exportReel({ projectId, format }));
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  };

  return (
    <div className="mt-6">
      <p className="label">Other shapes</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-3">
        {SHAPES.map((s) => (
          <li key={s.format} className="bg-surface rounded-[8px] p-3">
            <p className="font-medium">{s.label}</p>
            <p className="text-muted text-[13px]">{s.for}</p>
            {ready[s.format] ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={ready[s.format]} className="button h-9 px-3 text-[13px]" download>
                  Download
                </a>
                <button
                  type="button"
                  className="button button-ghost h-9 px-3 text-[13px]"
                  disabled={busy || pending}
                  onClick={() => make(s.format)}
                >
                  Make again
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button button-ghost mt-2 h-9 px-3 text-[13px]"
                disabled={busy || pending}
                onClick={() => make(s.format)}
              >
                {pending && which === s.format ? "Starting…" : "Make this shape"}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-muted mt-2 text-[13px]">
        {busy
          ? "Exporting… this takes about a minute; the page updates when it is ready."
          : "Reels, Shorts and TikTok take the 9:16 download above as it is."}
        {error && <span className="ml-2 text-[#ff8a66]">{error}</span>}
      </p>
    </div>
  );
}
