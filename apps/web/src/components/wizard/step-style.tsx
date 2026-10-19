"use client";

import { useRef } from "react";
import { FAMILY_LABEL, SFX_LABEL, presetCards, type PresetCard } from "@/config/presets";
import { FamilyChips, useStyleFilter } from "@/components/style-filter";
import { cn } from "@/lib/utils";

export interface StyleState {
  preset: string;
  text: string;
  captions: boolean;
  sfxIntensity: number;
  music: boolean;
  language: "auto" | "en" | "hi" | "hinglish";
}

export function StepStyle({
  value,
  onChange,
}: {
  value: StyleState;
  onChange: (v: StyleState) => void;
}) {
  const set = (patch: Partial<StyleState>) => onChange({ ...value, ...patch });
  const filter = useStyleFilter(presetCards);
  return (
    <div className="space-y-8">
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="kicker text-goldd dark:text-gold">Style</p>
          <p className="text-muted-foreground text-xs">
            Each style has its own motion and sound — hover a card to watch it on a real take.
          </p>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <FamilyChips
            counts={filter.counts}
            total={presetCards.length}
            value={filter.family}
            onChange={filter.setFamily}
          />
          <input
            type="search"
            className="input ml-auto h-9 w-full max-w-xs text-sm"
            placeholder="Search styles…"
            aria-label="Search styles"
            value={filter.query}
            onChange={(e) => filter.setQuery(e.target.value)}
          />
        </div>
        {filter.filtered.length === 0 && (
          <p className="text-muted-foreground mb-3 text-sm">No style matches that — try another word.</p>
        )}
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          role="radiogroup"
          aria-label="Style preset"
        >
          {filter.filtered.map((c) => (
            <li key={c.tokens.id}>
              <PresetButton
                card={c}
                on={value.preset === c.tokens.id}
                onPick={() => set({ preset: c.tokens.id })}
              />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="style-text" className="kicker text-goldd dark:text-gold mb-2 block">
          Describe your style (optional)
        </label>
        <textarea
          id="style-text"
          className="input min-h-24"
          maxLength={300}
          placeholder="e.g. clean clinic white with navy accents, fewer effects, bigger captions"
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <p className="text-muted-foreground mt-1 text-xs">
          We map this to safe design tokens (palette, fonts, pace). It never changes your words.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="bg-card flex items-center justify-between rounded-xl border p-4">
          <span>
            <span className="block font-semibold">Captions</span>
            <span className="text-muted-foreground text-xs">
              In the style&apos;s own format, on the exact word
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--ter)]"
            checked={value.captions}
            onChange={(e) => set({ captions: e.target.checked })}
          />
        </label>
        <label className="bg-card flex items-center justify-between rounded-xl border p-4">
          <span>
            <span className="block font-semibold">Music bed</span>
            <span className="text-muted-foreground text-xs">
              Licensed library, ducked under your voice (Phase 9)
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--ter)]"
            checked={value.music}
            onChange={(e) => set({ music: e.target.checked })}
          />
        </label>
        <label className="bg-card block rounded-xl border p-4">
          <span className="flex items-center justify-between">
            <span className="font-semibold">Sound effects</span>
            <span className="text-muted-foreground text-xs">
              {Math.round(value.sfxIntensity * 100)}%
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={value.sfxIntensity}
            onChange={(e) => set({ sfxIntensity: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--ter)]"
            aria-label="Sound effects intensity"
          />
          <span className="text-muted-foreground mt-1 block text-xs">
            The sound kit comes from the style; this sets how loud it lands.
          </span>
        </label>
        <label className="bg-card block rounded-xl border p-4">
          <span className="block font-semibold">Language</span>
          <select
            className="input mt-2"
            value={value.language}
            onChange={(e) => set({ language: e.target.value as StyleState["language"] })}
          >
            <option value="auto">Auto-detect (verified)</option>
            <option value="en">English</option>
            <option value="hi">Hindi (Devanagari captions)</option>
            <option value="hinglish">Hinglish</option>
          </select>
        </label>
      </div>
    </div>
  );
}

/** A style card: the real demo render (poster, video on hover/focus), name, motion + sound chips. */
function PresetButton({
  card,
  on,
  onPick,
}: {
  card: PresetCard;
  on: boolean;
  onPick: () => void;
}) {
  const vid = useRef<HTMLVideoElement>(null);
  const id = card.tokens.id;
  const play = () => {
    const v = vid.current;
    if (!v) return;
    if (!v.src) v.src = `/demo/styles/${id}.mp4`;
    void v.play().catch(() => undefined);
  };
  const stop = () => {
    const v = vid.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
  };
  const m = card.tokens.motion;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onPick}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      className={cn(
        "bg-card group w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
        on && "border-ter ring-ter/40 ring-2",
      )}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-lg bg-black" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
        <img
          src={`/demo/styles/${id}.jpg`}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <video
          ref={vid}
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
        {card.badge && (
          <span className="kicker bg-gold text-ink absolute left-2 top-2 rounded-full px-2 py-0.5 text-[0.5rem]">
            {card.badge}
          </span>
        )}
      </div>
      <p className="poster mt-2 text-xl">{card.tokens.name}</p>
      <p className="text-muted-foreground line-clamp-2 text-xs">{card.tokens.tagline}</p>
      <p className="mt-2 flex flex-wrap gap-1">
        <span className="bg-muted text-foreground/80 rounded-full px-2 py-0.5 text-[0.65rem]">
          {FAMILY_LABEL[m.family]}
        </span>
        <span className="bg-muted text-foreground/80 rounded-full px-2 py-0.5 text-[0.65rem]">
          {SFX_LABEL[m.sfxKit]}
        </span>
      </p>
    </button>
  );
}
