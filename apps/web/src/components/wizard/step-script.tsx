"use client";

import { DEFAULT_VOICE, VOICES, estimateSpokenSeconds } from "@/config/voices";
import { creditCost } from "@/lib/wizard-schema";

export interface ScriptState {
  text: string;
  voice: string;
}

export const SCRIPT_MAX_CHARS = 6000;

/** Script-only reels: the words, the voice, and what they will cost. */
export function StepScript({
  value,
  maxSeconds,
  planName,
  onChange,
}: {
  value: ScriptState;
  maxSeconds: number;
  planName: string;
  onChange: (v: ScriptState) => void;
}) {
  const set = (patch: Partial<ScriptState>) => onChange({ ...value, ...patch });
  const words = value.text.trim().split(/\s+/).filter(Boolean).length;
  const est = estimateSpokenSeconds(value.text);
  const tooLong = est > maxSeconds;
  const voice = VOICES.find((v) => v.id === value.voice) ?? VOICES[0]!;
  return (
    <div className="space-y-6">
      <p className="text-muted">
        Write it the way you would say it. One paragraph per idea — each paragraph becomes a beat.
      </p>
      <label className="block">
        <span className="label flex items-baseline justify-between">
          <span>Script</span>
          <span className="text-muted-foreground font-normal normal-case tracking-normal">
            {words} words · about {Math.round(est)} s spoken
          </span>
        </span>
        <textarea
          id="script-text"
          className="input min-h-64 text-sm leading-relaxed"
          maxLength={SCRIPT_MAX_CHARS}
          placeholder={
            "Most people buy jewellery for the wrong reason.\n\nThey buy the shine. The shine is gone in a month…"
          }
          value={value.text}
          onChange={(e) => set({ text: e.target.value })}
          aria-invalid={tooLong}
        />
        <span className="text-muted-foreground mt-1 block text-[13px]">
          Numbers are read as digits; write “twenty twenty-six” if you want it spoken as a year.
          English only for now — the narration voices do not speak Hindi yet.
        </span>
        {tooLong && (
          <span className="mt-2 block text-sm text-[#ff8a66]" role="alert">
            Spoken, this runs about {Math.round(est)} s; your {planName} plan allows {maxSeconds} s.
            Trim it or upgrade.
          </span>
        )}
      </label>

      <div>
        <p className="label">Voice</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Voice">
          {VOICES.map((v) => {
            const on = v.id === value.voice;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set({ voice: v.id })}
                  className={
                    "bg-surface w-full rounded-[8px] border px-3 py-2 text-left transition " +
                    (on ? "ring-2 ring-text" : "hover:ring-2 ring-text/60")
                  }
                >
                  <span className="block font-semibold">{v.name}</span>
                  <span className="text-muted-foreground block text-[13px]">
                    {v.accent} · {v.tone}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-2 text-[13px]">
          Narrated by {voice.name}. The voice is recorded once per edit; re-editing in another style
          reuses it.
        </p>
      </div>

      <p className="bg-surface rounded-[8px] p-4 text-sm">
        Cost: <strong>{creditCost(Math.max(1, est))} credit{creditCost(Math.max(1, est)) === 1 ? "" : "s"}</strong>{" "}
        at the estimated length — the same rate as an uploaded take of that length.
      </p>
    </div>
  );
}

export const defaultScriptState: ScriptState = { text: "", voice: DEFAULT_VOICE };
