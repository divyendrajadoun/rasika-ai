"use client";

import { useRef } from "react";
import { FAMILY_LABEL, PRESET_HOW_TO, PRESET_SOURCE, SFX_LABEL, presetCards, type PresetCard } from "@/config/presets";
import { FamilyChips, useStyleFilter } from "@/components/style-filter";
import { cn } from "@/lib/utils";

export interface StyleState {
  preset: string;
  text: string;
  captions: boolean;
  sfxIntensity: number;
  music: boolean;
  language: "auto" | "en" | "hi" | "hinglish";
  /** cut stock footage (Pexels) into the reel */
  broll: boolean;
  /** cut the ums, repeats and long pauses out of the take before editing */
  cleanCut: boolean;
}

export function StepStyle({
  value,
  onChange,
  stockEnabled = false,
  fromReference = false,
  recorded = false,
}: {
  value: StyleState;
  onChange: (v: StyleState) => void;
  /** the worker has a Pexels key */
  stockEnabled?: boolean;
  /** "Match a reference": the look is copied from the uploaded reel, so no preset is offered */
  fromReference?: boolean;
  /** the source is a recorded take (not generated speech): offer the clean cut */
  recorded?: boolean;
}) {
  const set = (patch: Partial<StyleState>) => onChange({ ...value, ...patch });
  const filter = useStyleFilter(presetCards);
  return (
    <div className="space-y-8">
      {fromReference ? (
        <div className="bg-surface rounded-[8px] p-5">
          <p className="font-medium">The look comes from your reference reel</p>
          <p className="text-muted mt-1 text-[14px]">
            We measure its cuts, camera moves, colours, type, captions and texture, write a style from
            them, and edit your take that way. Your words and footage stay yours; the reference is
            only measured, never reused.
          </p>
        </div>
      ) : (
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="label mb-0">Style</p>
          <p className="text-muted-foreground text-[13px]">
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
        {PRESET_HOW_TO[value.preset] && (
          <div className="bg-surface mt-4 rounded-[8px] p-4" aria-live="polite">
            <p className="font-semibold">How to get this look</p>
            <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-[14px]">
              {PRESET_HOW_TO[value.preset]!.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {PRESET_HOW_TO[value.preset]!.cleanCut && recorded && !value.cleanCut && (
              <button
                type="button"
                className="mt-3 text-[14px] text-[var(--ter)] font-semibold underline underline-offset-4"
                onClick={() => set({ cleanCut: true })}
              >
                Turn on Clean cut for this look
              </button>
            )}
          </div>
        )}
      </div>
      )}

      <div>
        <label htmlFor="style-text" className="label">
          {fromReference ? "Anything to note about the reference? (optional)" : "Describe your style (optional)"}
        </label>
        <textarea
          id="style-text"
          className="input min-h-24"
          maxLength={300}
          placeholder={
            fromReference
              ? "e.g. copy the yellow captions and the fast cuts; ignore the logo in the corner"
              : "e.g. clean clinic white with navy accents, fewer effects, bigger captions"
          }
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <p className="text-muted-foreground mt-1 text-[13px]">
          {fromReference
            ? "The style director reads this alongside the reference. It never changes your words."
            : "We map this to safe design tokens (palette, fonts, pace). It never changes your words."}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="bg-surface flex items-center justify-between rounded-[8px] p-4">
          <span>
            <span className="block font-semibold">Captions</span>
            <span className="text-muted-foreground text-[13px]">
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
        <label className="bg-surface flex items-center justify-between rounded-[8px] p-4">
          <span>
            <span className="block font-semibold">Music bed</span>
            <span className="text-muted-foreground text-[13px]">
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
        <label className="bg-surface block rounded-[8px] p-4">
          <span className="flex items-center justify-between">
            <span className="font-semibold">Sound effects</span>
            <span className="text-muted-foreground text-[13px]">
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
          <span className="text-muted-foreground mt-1 block text-[13px]">
            The sound kit comes from the style; this sets how loud it lands.
          </span>
        </label>
        <label
          className={cn(
            "bg-surface flex items-center justify-between rounded-[8px] p-4",
            !stockEnabled && "opacity-60",
          )}
        >
          <span>
            <span className="block font-semibold">Stock B-roll</span>
            <span className="text-muted-foreground text-[13px]">
              {stockEnabled
                ? "Short Pexels clips cut in on the words that need a picture (free, credited)"
                : "Needs a Pexels API key on the worker (PEXELS_API_KEY) — not set"}
            </span>
          </span>
          <input
            type="checkbox"
            className="size-5 accent-[var(--ter)]"
            checked={value.broll && stockEnabled}
            disabled={!stockEnabled}
            onChange={(e) => set({ broll: e.target.checked })}
          />
        </label>
        {recorded && (
          <label className="bg-surface flex items-center justify-between rounded-[8px] p-4">
            <span>
              <span className="block font-semibold">Clean cut</span>
              <span className="text-muted-foreground text-[13px]">
                Take out the ums and uhs, words said twice and long pauses before we edit (the cut is
                yours to download)
              </span>
            </span>
            <input
              type="checkbox"
              className="size-5 accent-[var(--ter)]"
              checked={Boolean(value.cleanCut)}
              onChange={(e) => set({ cleanCut: e.target.checked })}
            />
          </label>
        )}
        <label className="bg-surface block rounded-[8px] p-4">
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
        "bg-surface group w-full rounded-[8px] border p-3 text-left transition ",
        on && "ring-2 ring-text",
      )}
    >
      <div className="relative aspect-[9/16] overflow-hidden rounded-[6px] bg-black" aria-hidden>
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
          <span className="text-[12px] font-medium bg-accent text-accent-ink absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px]">
            {card.badge}
          </span>
        )}
      </div>
      <p className="mt-2 text-base font-medium leading-snug">{card.tokens.name}</p>
      <p className="text-muted-foreground line-clamp-2 text-[13px]">{card.tokens.tagline}</p>
      {PRESET_SOURCE[id] && (
        <p className="text-muted mt-1 truncate text-[12px]" title={PRESET_SOURCE[id]}>
          measured from {PRESET_SOURCE[id]}
        </p>
      )}
      <p className="mt-2 flex flex-wrap gap-1">
        <span className="bg-raised text-text rounded-full px-2 py-0.5 text-[12px]">
          {FAMILY_LABEL[m.family]}
        </span>
        <span className="bg-raised text-text rounded-full px-2 py-0.5 text-[12px]">
          {SFX_LABEL[m.sfxKit]}
        </span>
      </p>
    </button>
  );
}
