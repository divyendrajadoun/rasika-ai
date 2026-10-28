"use client";

import {
  BRIEF_GROUPS,
  BRIEF_KINDS,
  EXPLAINER_THEMES,
  ROUNDUP_LOOKS,
  TOON_HOSTS,
  TOON_LOOKS,
  briefKind,
  type BriefKindId,
  type RoundupLookId,
  type ToonHostId,
  type ToonLookId,
} from "@/config/briefs";
import { VOICES } from "@/config/voices";
import type { HeyGenLook, HeyGenVoice } from "@/lib/heygen";
import { allPresetCards } from "@/config/presets";
import { BriefIdeas } from "@/components/wizard/brief-ideas";
import { cn } from "@/lib/utils";

export interface BriefState {
  kind: BriefKindId;
  url: string;
  recipe: string;
  subject: string;
  topic: string;
  a: string;
  b: string;
  winner: "" | "a" | "b";
  line: string;
  end: string;
  focus: string;
  seconds: string;
  closeLine: string;
  closeTail: string;
  narrate: boolean;
  /** roundup: the pasted post and who speaks it */
  post: string;
  speaker: "voice" | "presenter";
  lookId: string;
  presenterVoice: string;
  /** the script is sent to the avatar provider (presenter only) */
  presenterOk: boolean;
  /** the designed look, or "reference" to match an uploaded reel */
  roundupLook: RoundupLookId | "reference";
  /** researched explainer: the theme, or "reference" to match an uploaded reel */
  explainerTheme: "studio" | "night" | "pop" | "reference";
  /** toon explainer: the cartoon host, its voice, the stage and the word viewers comment */
  host: ToonHostId;
  voice: string;
  toonLook: ToonLookId;
  cta: string;
}

export const defaultBriefState: BriefState = {
  kind: "launch",
  url: "",
  recipe: "",
  subject: "",
  topic: "",
  a: "",
  b: "",
  winner: "",
  line: "",
  end: "",
  focus: "",
  seconds: "",
  closeLine: "",
  closeTail: "",
  narrate: false,
  post: "",
  speaker: "voice",
  lookId: "",
  presenterVoice: "",
  presenterOk: false,
  roundupLook: "signal",
  explainerTheme: "studio",
  host: "arjun",
  voice: "aura-2-apollo-en",
  toonLook: "paper",
  cta: "",
};

const BRIEF_EXAMPLE_TOPICS = Object.fromEntries(
  BRIEF_KINDS.filter((k) => k.example.topic).map((k) => [k.id, k.example.topic!]),
);

/** The same rules the server applies (lib/wizard-schema.ts BriefSubmission). */
export function briefReady(b: BriefState): boolean {
  switch (b.kind) {
    case "launch":
    case "showreel":
    case "app":
    case "product":
    case "referral":
    case "hype":
      return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(b.url.trim());
    case "flyover":
      return /^https?:\/\/[^\s/]+\.[^\s]+/i.test(b.url.trim()) && Boolean(b.closeLine.trim());
    case "diagram":
    case "animate":
      return b.topic.trim().length >= 6;
    case "recipe":
      return b.recipe.trim().length >= 15;
    case "journey":
      return b.subject.trim().length >= 10;
    case "explainer":
    case "editorial":
    case "tierlist":
    case "researched":
    case "toon":
      return b.topic.trim().length >= 6;
    case "versus":
      return Boolean(b.a.trim() && b.b.trim());
    case "machine":
      return Boolean(b.line.trim());
    case "roundup":
      return (
        /https?:\/\/\S+/i.test(b.post) &&
        (b.speaker === "voice" || Boolean(b.lookId && b.presenterVoice && b.presenterOk))
      );
  }
}

/**
 * Films made from a brief: pick the kind, then give exactly what that kind needs. Each card says
 * what you give and what you get, so the choice is the explanation.
 */
export function StepBrief({
  value,
  onChange,
  looks = [],
  voices = [],
  presenterEnabled = false,
}: {
  value: BriefState;
  onChange: (v: BriefState) => void;
  /** the AI presenter's stock looks and voices (roundups spoken by a presenter) */
  looks?: HeyGenLook[];
  voices?: HeyGenVoice[];
  presenterEnabled?: boolean;
}) {
  const set = (patch: Partial<BriefState>) => onChange({ ...value, ...patch });
  const kind = briefKind(value.kind)!;
  const group = BRIEF_GROUPS.find((g) => g.id === kind.group)!;
  const look = allPresetCards.find((c) => c.tokens.id === kind.preset)?.tokens;
  const pick = (id: BriefKindId) => {
    // a new kind starts from its example, unless the user already typed something for it
    const k = briefKind(id)!;
    const ex = k.example;
    onChange({
      ...value,
      kind: id,
      url: value.url || ex.url || "",
      recipe: value.recipe || ex.recipe || "",
      subject: value.subject || ex.subject || "",
      // each topic kind starts from its own example unless the user typed one for another topic kind
      topic:
        value.topic && !Object.values(BRIEF_EXAMPLE_TOPICS).includes(value.topic)
          ? value.topic
          : ex.topic || "",
      a: value.a || ex.a || "",
      b: value.b || ex.b || "",
      line: value.line || ex.line || "",
      end: value.end || ex.end || "",
      focus: value.focus,
      seconds: ex.seconds || "",
      closeLine: value.closeLine || ex.closeLine || "",
      closeTail: value.closeTail || ex.closeTail || "",
      post: value.post || ex.post || "",
    });
  };
  return (
    <div className="space-y-8">
      <section aria-labelledby="brief-what">
        <h3 id="brief-what" className="text-lg font-semibold tracking-[-0.02em]">
          1. What do you want to make?
        </h3>
        <p className="text-muted mb-3 text-[14px]">
          No filming needed: we write, voice and design it.
        </p>
        <ul
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          role="radiogroup"
          aria-label="What to make"
        >
          {BRIEF_GROUPS.map((g) => {
            const on = g.id === kind.group;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && pick(BRIEF_KINDS.find((k) => k.group === g.id)!.id)}
                  className={cn(
                    "bg-surface hover:bg-raised flex h-full w-full flex-col gap-1 rounded-[8px] px-4 py-3 text-left transition-colors",
                    on && "ring-text ring-2",
                  )}
                >
                  <span className="font-semibold leading-tight">{g.title}</span>
                  <span className="text-muted text-[13px]">You give: {g.give.toLowerCase()}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="brief-kind">
        <h3 id="brief-kind" className="text-lg font-semibold tracking-[-0.02em]">
          2. Pick the film
        </h3>
        <p className="text-muted mb-3 text-[14px]">{group.blurb}</p>
        <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={group.title}>
          {BRIEF_KINDS.filter((k) => k.group === group.id).map((k) => {
            const on = k.id === value.kind;
            return (
              <li key={k.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(k.id)}
                  className={cn(
                    "bg-surface hover:bg-raised flex h-full w-full gap-3 rounded-[8px] p-3 text-left transition-colors",
                    on && "ring-text ring-2",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- static demo poster */}
                  <img
                    src={`/demo/briefs/${k.id}.jpg`}
                    alt=""
                    loading="lazy"
                    className="aspect-[9/14] w-16 shrink-0 rounded-[6px] object-cover object-top"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold leading-tight tracking-[-0.01em]">
                      {k.title}
                    </span>
                    <span className="text-[13px]">{k.blurb}</span>
                    <span className="text-muted text-[12px]">
                      {k.narrate ? "With a voice" : "Music only"} · up to{" "}
                      {Math.round(k.maxSeconds / 5) * 5} s
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="bg-surface space-y-5 rounded-[8px] p-5">
        <div>
          <p className="font-medium">3. Tell us about it: {kind.title}</p>
          <p className="text-muted mt-1 text-[14px]">
            <span className="text-text font-medium">You get:</span> {kind.youGet}
          </p>
          {/* kinds with their own look choice (stage, theme, design) say it in the form below */}
          {look && !kind.fields.some((f) => ["toonLook", "theme", "look"].includes(f.id)) && (
            <p className="text-muted mt-1 text-[14px]">
              <span className="text-text font-medium">The look:</span> {look.name}. {look.tagline}
            </p>
          )}
        </div>

        <BriefIdeas
          key={kind.id}
          kind={kind.id}
          needsLink={kind.fields.some((f) => f.id === "url")}
          onPick={(fields) => set(fields as Partial<BriefState>)}
        />

        {kind.fields.map((f) => {
          if (f.id === "url")
            return (
              <div key="url">
                <label htmlFor="brief-url" className="label">
                  {f.label}
                </label>
                <input
                  id="brief-url"
                  type="url"
                  inputMode="url"
                  className="input"
                  placeholder={f.placeholder}
                  value={value.url}
                  onChange={(e) => set({ url: e.target.value })}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "recipe" || f.id === "subject" || f.id === "topic")
            return (
              <div key={f.id}>
                <label htmlFor={`brief-${f.id}`} className="label">
                  {f.label}
                </label>
                <textarea
                  id={`brief-${f.id}`}
                  className="input min-h-28"
                  maxLength={f.id === "recipe" ? 1500 : 600}
                  placeholder={f.placeholder}
                  value={value[f.id]}
                  onChange={(e) => set({ [f.id]: e.target.value } as Partial<BriefState>)}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "contenders")
            return (
              <div key="contenders" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="brief-a" className="label">
                    Red corner
                  </label>
                  <input
                    id="brief-a"
                    className="input"
                    maxLength={40}
                    value={value.a}
                    onChange={(e) => set({ a: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="brief-b" className="label">
                    Blue corner
                  </label>
                  <input
                    id="brief-b"
                    className="input"
                    maxLength={40}
                    value={value.b}
                    onChange={(e) => set({ b: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="brief-winner" className="label">
                    Who wins?
                  </label>
                  <select
                    id="brief-winner"
                    className="input"
                    value={value.winner}
                    onChange={(e) => set({ winner: e.target.value as BriefState["winner"] })}
                  >
                    <option value="">Let the story decide</option>
                    <option value="a">{value.a || "Red corner"}</option>
                    <option value="b">{value.b || "Blue corner"}</option>
                  </select>
                  <p className="text-muted mt-1 text-[13px]">
                    People, brands or ideas all work. It roasts what they do, never their looks or
                    identity.
                  </p>
                </div>
              </div>
            );
          if (f.id === "post")
            return (
              <div key="post">
                <label htmlFor="brief-post" className="label">
                  {f.label}
                </label>
                <textarea
                  id="brief-post"
                  className="input min-h-56 font-mono text-[13px]"
                  maxLength={12000}
                  placeholder={f.placeholder}
                  value={value.post}
                  onChange={(e) => set({ post: e.target.value })}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "host")
            return (
              <div key="host" className="space-y-3">
                <p className="label">Your host</p>
                <ul
                  className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Your host"
                >
                  {TOON_HOSTS.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value.host === h.id}
                        // the host comes with a voice that suits them; it can be changed below
                        onClick={() => set({ host: h.id, voice: h.voice })}
                        className={cn(
                          "bg-raised w-full overflow-hidden rounded-[8px] text-left",
                          value.host === h.id && "ring-text ring-2",
                        )}
                      >
                        <span className="relative block aspect-square bg-[#eeebe5]">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a still of the drawn host */}
                          <img
                            src={`/demo/hosts/${h.id}.png`}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-contain object-bottom"
                          />
                        </span>
                        <span className="block px-3 pt-2 font-semibold">{h.name}</span>
                        <span className="text-muted block px-3 pb-3 text-[12px] leading-snug">
                          {h.blurb}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-muted text-[13px]">
                  Drawn, not filmed: the host talks with the voice, blinks, points at the cards and
                  celebrates the fun part.
                </p>
              </div>
            );
          if (f.id === "voice")
            return (
              <div key="voice">
                <label htmlFor="brief-voice" className="label">
                  Voice
                </label>
                <select
                  id="brief-voice"
                  className="input"
                  value={value.voice}
                  onChange={(e) => set({ voice: e.target.value })}
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {v.accent} · {v.tone}
                    </option>
                  ))}
                </select>
              </div>
            );
          if (f.id === "toonLook")
            return (
              <div key="toonLook" className="space-y-3">
                <p className="label">The stage</p>
                <ul className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="The stage">
                  {TOON_LOOKS.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value.toonLook === t.id}
                        onClick={() => set({ toonLook: t.id })}
                        className={cn(
                          "bg-raised flex h-full w-full flex-col gap-2 rounded-[8px] p-3 text-left",
                          value.toonLook === t.id && "ring-text ring-2",
                        )}
                      >
                        <span
                          className="flex h-16 flex-wrap content-end items-end gap-x-1 overflow-hidden rounded-[6px] p-2"
                          style={{ background: t.swatch[0] }}
                          aria-hidden
                        >
                          <b
                            className="text-[16px] leading-none sm:text-[20px]"
                            style={{ color: t.swatch[1] }}
                          >
                            GET
                          </b>
                          <b
                            className="text-[16px] leading-none sm:text-[20px]"
                            style={{ color: t.swatch[2] }}
                          >
                            STARTED
                          </b>
                        </span>
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-muted text-[12px] leading-snug">{t.blurb}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          if (f.id === "cta")
            return (
              <div key="cta">
                <label htmlFor="brief-cta" className="label">
                  Comment word (optional)
                </label>
                <input
                  id="brief-cta"
                  className="input"
                  maxLength={14}
                  placeholder="GUIDE"
                  value={value.cta}
                  onChange={(e) => set({ cta: e.target.value.replace(/[^A-Za-z0-9]/g, "") })}
                />
                <p className="text-muted mt-1 text-[13px]">
                  The reel ends with &ldquo;comment WORD and I&rsquo;ll send it to you&rdquo;. Leave
                  empty and we pick one that fits.
                </p>
              </div>
            );
          if (f.id === "theme")
            return (
              <div key="theme" className="space-y-3">
                <p className="label">The look</p>
                <ul
                  className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="The look"
                >
                  {EXPLAINER_THEMES.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value.explainerTheme === t.id}
                        onClick={() => set({ explainerTheme: t.id })}
                        className={cn(
                          "bg-raised flex h-full w-full flex-col gap-2 rounded-[8px] p-3 text-left",
                          value.explainerTheme === t.id && "ring-text ring-2",
                        )}
                      >
                        <span
                          className="flex h-20 items-end gap-1 rounded-[6px] p-2"
                          style={{ background: t.swatch[0] }}
                          aria-hidden
                        >
                          <b
                            className="text-[22px] leading-none"
                            style={{ color: t.swatch[1], fontWeight: 900 }}
                          >
                            HOW IT
                          </b>
                          <b
                            className="text-[22px] leading-none"
                            style={{ color: t.swatch[2], fontWeight: 900 }}
                          >
                            WORKS
                          </b>
                        </span>
                        <span className="font-semibold">{t.name}</span>
                        <span className="text-muted text-[12px] leading-snug">{t.blurb}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={value.explainerTheme === "reference"}
                      onClick={() => set({ explainerTheme: "reference" })}
                      className={cn(
                        "bg-raised flex h-full w-full flex-col justify-center rounded-[8px] p-4 text-left",
                        value.explainerTheme === "reference" && "ring-text ring-2",
                      )}
                    >
                      <span className="block font-semibold">Match a reel</span>
                      <span className="text-muted mt-1 block text-[12px] leading-snug">
                        Upload a reel whose style you love: we take its colours and type.
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            );
          if (f.id === "look")
            return (
              <div key="look" className="space-y-3">
                <p className="label">The look</p>
                <ul
                  className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                  role="radiogroup"
                  aria-label="The look"
                >
                  {ROUNDUP_LOOKS.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={value.roundupLook === l.id}
                        onClick={() => set({ roundupLook: l.id })}
                        className={cn(
                          "bg-raised w-full overflow-hidden rounded-[8px] text-left",
                          value.roundupLook === l.id && "ring-text ring-2",
                        )}
                      >
                        <span className="relative block aspect-[9/16] bg-black/20">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a still of a real render in this look */}
                          <img
                            src={`/demo/looks/${l.id}.jpg`}
                            alt=""
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </span>
                        <span className="block px-3 pt-2 font-semibold">{l.name}</span>
                        <span className="text-muted block px-3 pb-3 text-[12px] leading-snug">
                          {l.blurb}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={value.roundupLook === "reference"}
                      onClick={() => set({ roundupLook: "reference" })}
                      className={cn(
                        "bg-raised flex h-full w-full flex-col justify-center rounded-[8px] p-4 text-left",
                        value.roundupLook === "reference" && "ring-text ring-2",
                      )}
                    >
                      <span className="block font-semibold">Match a reel</span>
                      <span className="text-muted mt-1 block text-[12px] leading-snug">
                        Upload a reel whose style you love: we take its colours, type and pace and
                        make your roundup in it.
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            );
          if (f.id === "speaker")
            return (
              <div key="speaker" className="space-y-3">
                <p className="label">Who speaks it?</p>
                <div
                  className="grid gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Who speaks it"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={value.speaker === "voice"}
                    onClick={() => set({ speaker: "voice" })}
                    className={cn(
                      "bg-raised rounded-[8px] p-4 text-left",
                      value.speaker === "voice" && "ring-text ring-2",
                    )}
                  >
                    <span className="block font-semibold">A voice</span>
                    <span className="text-muted text-[13px]">
                      A narrator over the pages and clips, with captions.
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={value.speaker === "presenter"}
                    aria-disabled={!presenterEnabled}
                    disabled={!presenterEnabled}
                    onClick={() => set({ speaker: "presenter" })}
                    className={cn(
                      "bg-raised rounded-[8px] p-4 text-left disabled:opacity-50",
                      value.speaker === "presenter" && "ring-text ring-2",
                    )}
                  >
                    <span className="block font-semibold">An AI presenter</span>
                    <span className="text-muted text-[13px]">
                      {presenterEnabled
                        ? "A presenter opens and closes on camera; the pages and clips fill the frame while they talk."
                        : "Not available on this workspace yet."}
                    </span>
                  </button>
                </div>
                {value.speaker === "presenter" && presenterEnabled && (
                  <div className="space-y-3">
                    <ul
                      className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
                      role="radiogroup"
                      aria-label="Presenter"
                    >
                      {looks.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={value.lookId === l.id}
                            onClick={() => set({ lookId: l.id })}
                            className={cn(
                              "bg-surface w-full overflow-hidden rounded-[8px] border text-left transition",
                              value.lookId === l.id && "ring-text ring-2",
                            )}
                          >
                            <span className="relative block aspect-[3/4] bg-black/10">
                              {l.preview && (
                                // eslint-disable-next-line @next/next/no-img-element -- the avatar provider's preview
                                <img
                                  src={l.preview}
                                  alt=""
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              )}
                            </span>
                            <span className="block truncate px-2 py-1 text-[12px]">{l.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div>
                      <label htmlFor="brief-pvoice" className="label">
                        Presenter voice
                      </label>
                      <select
                        id="brief-pvoice"
                        className="input"
                        value={value.presenterVoice}
                        onChange={(e) => set({ presenterVoice: e.target.value })}
                      >
                        <option value="">Choose a voice…</option>
                        {voices.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} · {v.language} · {v.gender}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--ter)]"
                        checked={value.presenterOk}
                        onChange={(e) => set({ presenterOk: e.target.checked })}
                      />
                      <span>
                        The script is sent to our avatar provider to render the presenter.
                      </span>
                    </label>
                  </div>
                )}
              </div>
            );
          if (f.id === "presets")
            return (
              <div key="presets">
                <p className="label">Start from an example</p>
                <div className="flex flex-wrap gap-2">
                  {f.items.map((it) => (
                    <button
                      key={it.label}
                      type="button"
                      className="bg-raised hover:bg-surface border-border rounded-full border px-4 py-2 text-[14px] transition-colors"
                      onClick={() =>
                        set({
                          topic: it.text,
                          ...(it.seconds ? { seconds: String(it.seconds) } : {}),
                        })
                      }
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          if (f.id === "narrate")
            return (
              <label
                key="narrate"
                className="bg-raised flex items-center justify-between rounded-[8px] p-4"
              >
                <span>
                  <span className="block font-semibold">Narration</span>
                  <span className="text-muted text-[13px]">
                    A voice tells it over the music, with captions. Off: music only.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--ter)]"
                  checked={value.narrate}
                  onChange={(e) => set({ narrate: e.target.checked })}
                />
              </label>
            );
          if (f.id === "focus")
            return (
              <div key="focus">
                <label htmlFor="brief-focus" className="label">
                  {f.label}
                </label>
                <textarea
                  id="brief-focus"
                  className="input min-h-20"
                  maxLength={400}
                  placeholder={f.placeholder}
                  value={value.focus}
                  onChange={(e) => set({ focus: e.target.value })}
                />
                <p className="text-muted mt-1 text-[13px]">{f.help}</p>
              </div>
            );
          if (f.id === "seconds")
            return (
              <div key="seconds">
                <label htmlFor="brief-seconds" className="label">
                  Length
                </label>
                <select
                  id="brief-seconds"
                  className="input"
                  value={value.seconds}
                  onChange={(e) => set({ seconds: e.target.value })}
                >
                  <option value="">
                    The usual (
                    {kind.maxSeconds <= 16 ? 15 : Math.round((kind.maxSeconds - 2) / 10) * 10} s)
                  </option>
                  {f.options.map((o) => (
                    <option key={o} value={String(o)}>
                      {o} seconds
                    </option>
                  ))}
                </select>
              </div>
            );
          if (f.id === "closing")
            return (
              <div key="closing" className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="brief-close" className="label">
                    Closing statement
                  </label>
                  <input
                    id="brief-close"
                    className="input"
                    maxLength={60}
                    value={value.closeLine}
                    onChange={(e) => set({ closeLine: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="brief-tail" className="label">
                    Italic tail (short)
                  </label>
                  <input
                    id="brief-tail"
                    className="input"
                    maxLength={40}
                    value={value.closeTail}
                    onChange={(e) => set({ closeTail: e.target.value })}
                  />
                </div>
                <p className="text-muted text-[13px] sm:col-span-2">
                  The two lines appear word by word on the end card, the tail in an italic serif.
                  Your logo is taken from the page; your brand name comes from the Brand step.
                </p>
              </div>
            );
          return (
            <div key="line" className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="brief-line" className="label">
                  The line that types out
                </label>
                <input
                  id="brief-line"
                  className="input"
                  maxLength={60}
                  value={value.line}
                  onChange={(e) => set({ line: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="brief-end" className="label">
                  Closing words
                </label>
                <input
                  id="brief-end"
                  className="input"
                  maxLength={30}
                  value={value.end}
                  onChange={(e) => set({ end: e.target.value })}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
