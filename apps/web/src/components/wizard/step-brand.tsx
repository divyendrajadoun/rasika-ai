"use client";

import type { BrandState } from "@/components/wizard/wizard";

export function StepBrand({
  value,
  title,
  onTitle,
  onChange,
  consent,
  onConsent,
}: {
  value: BrandState;
  title: string;
  onTitle: (t: string) => void;
  onChange: (v: BrandState) => void;
  consent: boolean;
  onConsent: (v: boolean) => void;
}) {
  const set = (patch: Partial<BrandState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-6">
      <p className="font-accent text-muted-foreground text-xl italic">
        Optional. Everything here lands on the end card.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="kicker text-goldd dark:text-gold mb-2 block">Project title</span>
          <input
            className="input"
            maxLength={120}
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="What is your taste?"
          />
        </label>
        <label className="block">
          <span className="kicker text-goldd dark:text-gold mb-2 block">Brand name</span>
          <input
            className="input"
            maxLength={60}
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Khanna Homes"
          />
        </label>
        <label className="block">
          <span className="kicker text-goldd dark:text-gold mb-2 block">Handle or website</span>
          <input
            className="input"
            maxLength={60}
            value={value.handle}
            onChange={(e) => set({ handle: e.target.value })}
            placeholder="@khannahomes"
          />
        </label>
        <label className="block">
          <span className="kicker text-goldd dark:text-gold mb-2 block">End-card line</span>
          <input
            className="input"
            maxLength={120}
            value={value.endLine}
            onChange={(e) => set({ endLine: e.target.value })}
            placeholder="Default: your last sentence"
          />
        </label>
        <label className="block">
          <span className="kicker text-goldd dark:text-gold mb-2 block">Call to action</span>
          <input
            className="input"
            maxLength={60}
            value={value.cta}
            onChange={(e) => set({ cta: e.target.value })}
            placeholder="Comment KATANA · DM to order"
          />
        </label>
      </div>
      <label className="bg-card flex items-start gap-3 rounded-xl border p-4">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-[var(--ter)]"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          required
        />
        <span className="text-sm">
          I own this video or have permission, and I have rights to the images I upload. No face
          swaps, voice clones or generated likenesses are made — Rasika only edits your own footage.
        </span>
      </label>
    </div>
  );
}
