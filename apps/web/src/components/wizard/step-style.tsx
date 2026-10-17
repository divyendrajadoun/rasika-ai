"use client";

import { presetCards } from "@/config/presets";
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
  return (
    <div className="space-y-8">
      <div>
        <p className="kicker text-goldd dark:text-gold mb-3">Preset</p>
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          role="radiogroup"
          aria-label="Style preset"
        >
          {presetCards.map((c) => {
            const p = c.tokens.palette;
            const on = value.preset === c.tokens.id;
            return (
              <li key={c.tokens.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ preset: c.tokens.id })}
                  className={cn(
                    "bg-card w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                    on && "border-ter ring-ter/40 ring-2",
                  )}
                >
                  <div
                    className="relative aspect-[9/12] overflow-hidden rounded-lg"
                    style={{ background: p.stage }}
                    aria-hidden
                  >
                    {c.tokens.pattern === "jaali" && (
                      <div className="jaali absolute inset-0 opacity-80" />
                    )}
                    <div className="absolute inset-x-2 top-2 text-center">
                      <p className="kicker text-[5px]" style={{ color: p.gold }}>
                        {c.preview.kicker}
                      </p>
                      <p
                        className={
                          c.tokens.fonts.poster === "Inter"
                            ? "font-sans text-[12px] font-black uppercase"
                            : "poster text-[15px]"
                        }
                        style={{ color: p.iv }}
                      >
                        {c.preview.big}
                      </p>
                      <p className="font-accent text-[10px] italic" style={{ color: p.gold }}>
                        {c.preview.italic}
                      </p>
                    </div>
                    <div
                      className={
                        "absolute inset-x-[16%] bottom-[8%] top-[40%] bg-[linear-gradient(180deg,#efe0c6,#d8c3a3)] " +
                        (c.tokens.endCardShape === "arch" ? "arch" : "rounded-md")
                      }
                      style={{ boxShadow: `0 0 0 2px ${p.gold}` }}
                    >
                      <div className="d-head" />
                    </div>
                  </div>
                  <p className="poster mt-2 text-xl">{c.tokens.name}</p>
                  <p className="text-muted-foreground text-xs">{c.tokens.tagline}</p>
                </button>
              </li>
            );
          })}
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
          placeholder="e.g. make it feel like a vintage Bollywood poster, more yellow, fewer images"
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
              One word at a time, on the exact word
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
