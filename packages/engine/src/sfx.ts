/**
 * SFX auto-derivation (SPEC §6.3, style-guide §6): cues from elements and mode switches,
 * scaled by `plan.sfx.intensity`, plus the planner's `extra` cues. Output matches the
 * reference cues.json consumed by the worker's sfx mixer.
 */
import { motionOf, type Plan, type SfxCue, type SfxKit } from "@rasika/schema";
import { MACHINE_SCALE } from "./brief";

export interface CueSheet {
  duration: number;
  bpm: 0;
  bed_gain: 0;
  /** which synthesised palette the worker renders the cues with (style.motion.sfxKit) */
  kit: SfxKit;
  cues: SfxCue[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function deriveSfx(plan: Plan): CueSheet {
  const cues: SfxCue[] = [];
  const kit = motionOf(plan.style).sfxKit;
  // the wizard slider is the gain, linearly: 5 % means barely there, 100 % the kit's full level
  const k = plan.sfx.intensity <= 0 || kit === "none" ? 0 : Math.min(1, plan.sfx.intensity);
  const push = (c: Omit<SfxCue, "gain"> & { gain: number }) => {
    if (k <= 0) return;
    // dedupe: same type within 0.1 s
    if (cues.some((x) => x.type === c.type && Math.abs(x.t - c.t) < 0.1)) return;
    cues.push({ ...c, t: r2(c.t), gain: r2(Math.min(1.5, c.gain * k)) });
  };

  if (plan.sfx.auto) {
    // whoosh ~0.05 s before every mode switch
    for (const m of plan.videoModes)
      if (m.t > 0) push({ t: m.t - 0.05, type: "whoosh", dur: 0.45, gain: 0.8 });

    for (const el of plan.elements) {
      switch (el.type) {
        case "bleedPlate":
        case "filmStrip":
          push({ t: el.t0 - 0.05, type: "whoosh", dur: 0.45, gain: 0.8 });
          break;
        case "imageCard":
        case "patternCard":
          push({ t: el.t0, type: "pop", gain: 0.9 });
          break;
        case "splitCards":
          push({ t: el.t0, type: "pop", gain: 0.9 });
          push({ t: el.t0 + el.stagger, type: "pop", gain: 0.9 });
          break;
        case "lockCard":
          if (el.blurred) push({ t: el.t0, type: "pop", gain: 0.9 });
          break;
        case "chips":
          for (const c of el.items) push({ t: el.t0 + c.at, type: "pop", gain: 0.9 });
          break;
        case "posterText":
          if (el.anim === "pop") push({ t: el.t0, type: "pop", gain: 0.9 });
          if (el.accent === "glitch") push({ t: el.t0, type: "glitch", dur: 0.3, gain: 0.5 });
          if (el.accent === "sub") push({ t: el.t0, type: "sub", gain: 0.7 });
          break;
        case "counter":
          push({ t: el.t0 + 0.05, type: "tick", repeat: 8, every: 0.12, gain: 0.6 });
          break;
        case "feedPhone":
          push({ t: el.t0 + 0.3, type: "tick", repeat: 12, every: 0.14, gain: 0.55 });
          break;
        case "stamp":
          push({ t: el.t0, type: "impact", gain: 0.9 });
          break;
        case "broll":
          push({ t: el.t0 - 0.05, type: "whoosh", dur: 0.45, gain: 0.8 });
          push({ t: el.t1 - 0.05, type: "whoosh", dur: 0.4, gain: 0.6 });
          break;
        case "reveal":
          push({ t: el.t0 - 1.35, type: "riser", dur: 1.35, gain: 0.6 });
          push({ t: el.t0, type: "impact", gain: 1.0 });
          push({ t: el.t0 + 0.02, type: "sub", gain: 0.9 });
          break;
        // brief films: every sound is a movement you can see
        case "browserCard":
          push({ t: el.t0 - 0.05, type: "whoosh", dur: 0.45, gain: 0.7 });
          break;
        case "pourGlass":
          for (const l of el.layers) push({ t: el.t0 + l.at, type: "pour", dur: l.dur, gain: 0.8 });
          if (el.garnish) push({ t: el.t0 + el.garnish.at + 0.5, type: "pop", gain: 0.8 });
          break;
        case "fightHud":
          push({ t: el.t0 + 0.05, type: "riser", dur: 0.6, gain: 0.4 });
          for (const h of el.hits) {
            push({ t: el.t0 + h.at, type: "impact", gain: 0.85 });
            push({ t: el.t0 + h.at, type: "pop", gain: 0.6 });
          }
          if (el.koAt != null) {
            push({ t: el.t0 + el.koAt, type: "impact", gain: 1.1 });
            push({ t: el.t0 + el.koAt + 0.02, type: "sub", gain: 1.0 });
          }
          break;
        case "noteMachine":
          for (const n of el.notes)
            push({ t: el.t0 + n.at, type: "note", pitch: MACHINE_SCALE[n.key] ?? 0, gain: 0.9 });
          for (const d of el.drums) push({ t: el.t0 + d, type: "sub", gain: 1.0 });
          {
            const last = Math.max(el.dropAt, ...el.notes.map((n) => n.at), ...el.drums);
            const ticks = Math.min(40, Math.floor((last - el.dropAt) / 0.25));
            if (ticks > 0) push({ t: el.t0 + el.dropAt, type: "tick", repeat: ticks, every: 0.25, gain: 0.3 });
          }
          break;
        default:
          break;
      }
    }

    if (plan.endCard) {
      const arch = [...plan.videoModes].reverse().find((m) => m.mode === "arch");
      const t0 = plan.endCard.t0 ?? arch?.t ?? Math.max(0, plan.meta.durationSec - 2.5);
      push({ t: t0, type: "riser", dur: 0.6, gain: 0.3 });
      push({ t: t0 + 0.05, type: "sub", gain: 0.8 });
    }
  }

  for (const c of plan.sfx.extra ?? []) cues.push({ ...c, t: r2(c.t), gain: r2(c.gain) });

  cues.sort((a, b) => a.t - b.t);
  return {
    duration: plan.meta.durationSec,
    bpm: 0,
    bed_gain: 0,
    kit,
    cues: cues.filter((c) => c.t >= 0),
  };
}
