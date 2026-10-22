"use client";

import type { BrandState } from "@/components/wizard/wizard";

export function StepBrand({
  value,
  title,
  onTitle,
  onChange,
}: {
  value: BrandState;
  title: string;
  onTitle: (t: string) => void;
  onChange: (v: BrandState) => void;
}) {
  const set = (patch: Partial<BrandState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <p className="text-muted">
        Name your reel and create it. Brand details are optional; they land on the end card.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="label">Project title</span>
          <input
            className="input"
            maxLength={120}
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="What is your taste?"
          />
        </label>
        <label className="block">
          <span className="label">Brand name</span>
          <input
            className="input"
            maxLength={60}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Khanna Homes"
          />
        </label>
        <label className="block">
          <span className="label">Handle or website</span>
          <input
            className="input"
            maxLength={60}
            value={value.handle}
            onChange={(e) => set({ handle: e.target.value })}
            placeholder="@khannahomes"
          />
        </label>
        <label className="block">
          <span className="label">End-card line</span>
          <input
            className="input"
            maxLength={120}
            value={value.endLine}
            onChange={(e) => set({ endLine: e.target.value })}
            placeholder="Default: your last sentence"
          />
        </label>
        <label className="block">
          <span className="label">Call to action</span>
          <input
            className="input"
            maxLength={60}
            value={value.cta}
            onChange={(e) => set({ cta: e.target.value })}
            placeholder="Comment KATANA · DM to order"
          />
        </label>
      </div>
      <p className="text-muted text-[13px] md:hidden">
        By creating, you confirm this footage is yours or you have permission to use it. Rasika only
        edits your own footage: no face swaps, voice clones or generated likenesses.
      </p>
    </div>
  );
}
