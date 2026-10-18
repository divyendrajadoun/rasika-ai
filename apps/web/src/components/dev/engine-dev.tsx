"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plan,
  Transcript,
  validatePlan,
  type Plan as PlanT,
  type PlanIssue,
  type TranscriptWord,
} from "@rasika/schema";
import { createEngine, fitStage, type Engine } from "@rasika/engine";
import baisaPlan from "../../../../../plans/baisa_bling.json";
import baisaWords from "../../../../../plans/baisa_bling.words.json";

export interface DevProject {
  id: string;
  title: string;
  videoUrl: string | null;
  durationSec: number | null;
  images: Array<{ id: string; label: string; url: string }>;
}

const BAISA_IMAGES: Record<string, string> = Object.fromEntries(
  ["i1", "i2", "i3", "i4", "i5", "i6", "i7", "i8", "i9", "choker"].map((id) => [
    id,
    `/dev/baisa/${id}.jpg`,
  ]),
);
const DEMO_VIDEO = "/demo/before.mp4";
const FPS = 30;

const MODE_COLOR: Record<string, string> = {
  full: "#6b7280",
  zoom: "#c8452f",
  card: "#e6b450",
  pip: "#2a5cc4",
  arch: "#9a6a14",
};

export function EngineDev({ project }: { project: DevProject | null }) {
  const [plan, setPlan] = useState<PlanT>(() => Plan.parse(baisaPlan));
  const [planName, setPlanName] = useState("baisa_bling.json (bundled)");
  const [words, setWords] = useState<TranscriptWord[]>(() => Transcript.parse(baisaWords).words);
  const [images, setImages] = useState<Record<string, string>>(BAISA_IMAGES);
  const [videoSrc, setVideoSrc] = useState<string>(project?.videoUrl ?? DEMO_VIDEO);
  const [videoName, setVideoName] = useState(
    project?.videoUrl ? `${project.title} (your upload)` : "demo/before.mp4 (raw take, 32 s)",
  );
  const [issues, setIssues] = useState<PlanIssue[]>([]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const tRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(true);
  loopRef.current = loop;

  // ── mount / remount the engine when inputs change ──
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setReady(false);
    setError(null);
    const engine = createEngine(root, {
      plan,
      transcript: words,
      assets: { images, video: videoSrc },
      assetMode: "video",
      fontBaseUrl: "/engine/fonts",
    });
    engineRef.current = engine;
    const fit = () => {
      const box = boxRef.current;
      if (box) fitStage(root, box.clientWidth, box.clientHeight);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (boxRef.current) ro.observe(boxRef.current);
    let cancelled = false;
    engine.ready
      .then(async () => {
        if (cancelled) return;
        setReady(true);
        await engine.renderFrame(tRef.current);
      })
      .catch((e: unknown) => setError(String(e)));
    return () => {
      cancelled = true;
      ro.disconnect();
      engine.dispose();
      engineRef.current = null;
    };
  }, [plan, words, images, videoSrc]);

  // ── rAF loop: the <video> is the clock while playing ──
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = async () => {
      const engine = engineRef.current;
      if (engine && playingRef.current && engine.video) {
        const v = engine.video;
        let now = v.currentTime;
        if (now >= plan.meta.durationSec || v.ended) {
          if (loopRef.current) {
            v.currentTime = 0;
            now = 0;
          } else {
            v.pause();
            playingRef.current = false;
            setPlaying(false);
          }
        }
        tRef.current = now;
        setT(now);
        await engine.renderFrame(now, { seek: false });
        frames++;
        const n = performance.now();
        if (n - last >= 1000) {
          setFps(Math.round((frames * 1000) / (n - last)));
          frames = 0;
          last = n;
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };
    raf = requestAnimationFrame(() => void tick());
    return () => cancelAnimationFrame(raf);
  }, [plan.meta.durationSec]);

  const seek = useCallback((next: number) => {
    const engine = engineRef.current;
    tRef.current = next;
    setT(next);
    if (engine) void engine.renderFrame(next);
  }, []);

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine?.video) return;
    if (playingRef.current) {
      engine.video.pause();
      playingRef.current = false;
      setPlaying(false);
    } else {
      try {
        engine.video.currentTime = tRef.current;
        await engine.video.play();
        playingRef.current = true;
        setPlaying(true);
      } catch (e) {
        setError(`Could not play video: ${String(e)}`);
      }
    }
  }, []);

  // keyboard: space play/pause, arrows step a frame
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      } else if (e.code === "ArrowRight")
        seek(Math.min(plan.meta.durationSec, tRef.current + 1 / FPS));
      else if (e.code === "ArrowLeft") seek(Math.max(0, tRef.current - 1 / FPS));
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [plan.meta.durationSec, seek, togglePlay]);

  // ── loaders ──
  const loadPlan = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      const r = validatePlan(raw, words, { imageIds: Object.keys(images) });
      setIssues(r.issues);
      if (!r.ok && !Plan.safeParse(raw).success) {
        setError(`${file.name}: plan does not parse — see issues`);
        return;
      }
      setPlan(r.plan);
      setPlanName(file.name);
      setError(null);
      seek(0);
    } catch (e) {
      setError(`${file.name}: ${String(e)}`);
    }
  };
  const loadWords = async (file: File) => {
    try {
      const raw: unknown = JSON.parse(await file.text());
      const list = Array.isArray(raw) ? raw : (raw as { words?: unknown }).words;
      setWords(Transcript.shape.words.parse(list));
      setError(null);
    } catch (e) {
      setError(`${file.name}: ${String(e)}`);
    }
  };
  const loadImages = (files: FileList) => {
    const next: Record<string, string> = {};
    for (const f of Array.from(files))
      next[f.name.replace(/\.[^.]+$/, "")] = URL.createObjectURL(f);
    setImages(next);
  };
  const loadVideo = (file: File) => {
    setVideoSrc(URL.createObjectURL(file));
    setVideoName(file.name);
    seek(0);
  };
  const useProjectImages = () => {
    if (!project) return;
    setImages(Object.fromEntries(project.images.map((i) => [i.id, i.url])));
  };
  const revalidate = () => {
    const r = validatePlan(plan, words, { imageIds: Object.keys(images) });
    setIssues(r.issues);
  };

  const D = plan.meta.durationSec;
  const mode = engineRef.current?.modeAt(t) ?? "full";
  const errors = issues.filter((i) => i.level === "error").length;

  const lanes = useMemo(() => laneLayout(plan), [plan]);

  return (
    <main className="bg-ink text-iv grid min-h-dvh grid-rows-[auto_1fr_auto] gap-3 p-3 font-sans">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="kicker text-gold text-xs">Rasika · engine dev</span>
        <span className="text-iv/70">
          plan <b className="text-iv">{planName}</b> · video <b className="text-iv">{videoName}</b>{" "}
          · {Object.keys(images).length} images
        </span>
        <span className="ml-auto flex items-center gap-3 font-mono text-xs">
          <span style={{ color: MODE_COLOR[mode] }}>● {mode}</span>
          <span>
            {fmt(t)} / {fmt(D)}
          </span>
          <span>f{Math.round(t * FPS) + 1}</span>
          <span className={fps && fps < 28 ? "text-[#ff8a66]" : "text-gold"}>
            {playing ? `${fps} fps` : "paused"}
          </span>
          <span className={ready ? "text-gold" : "text-iv/50"}>
            {ready ? "fonts+media ready" : "loading…"}
          </span>
        </span>
      </header>

      <div className="grid min-h-0 gap-3 lg:grid-cols-[1fr_340px]">
        <div ref={boxRef} className="relative min-h-[60vh] overflow-hidden rounded-2xl bg-black">
          <div
            ref={rootRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          />
        </div>

        <aside className="flex min-h-0 flex-col gap-3 overflow-auto text-sm">
          <Section title="Inputs">
            <FileRow
              label="Plan JSON"
              accept=".json,application/json"
              onFile={(f) => void loadPlan(f)}
            />
            <FileRow
              label="Words JSON"
              accept=".json,application/json"
              onFile={(f) => void loadWords(f)}
            />
            <FileRow
              label="Images (stem = imageId)"
              accept="image/*"
              multiple
              onFiles={loadImages}
            />
            <FileRow label="Video" accept="video/*" onFile={loadVideo} />
            {project && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-outline-gold h-9 px-4 text-xs"
                  onClick={useProjectImages}
                >
                  Use this project&apos;s {project.images.length} photos
                </button>
                <button
                  type="button"
                  className="btn-outline-gold h-9 px-4 text-xs"
                  onClick={() => {
                    setVideoSrc(project.videoUrl ?? DEMO_VIDEO);
                    setVideoName(`${project.title} (your upload)`);
                  }}
                >
                  Use this project&apos;s video
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-outline-gold h-9 px-4 text-xs"
                onClick={() => {
                  setPlan(Plan.parse(baisaPlan));
                  setPlanName("baisa_bling.json (bundled)");
                  setWords(Transcript.parse(baisaWords).words);
                  setImages(BAISA_IMAGES);
                  setIssues([]);
                }}
              >
                Reset to Baisa Bling
              </button>
              <button
                type="button"
                className="btn-outline-gold h-9 px-4 text-xs"
                onClick={revalidate}
              >
                Validate plan
              </button>
            </div>
            {error && (
              <p className="rounded-lg bg-[#ff8a66]/15 px-3 py-2 text-xs text-[#ff8a66]">{error}</p>
            )}
          </Section>

          <Section
            title={`Validation${issues.length ? ` · ${errors} errors, ${issues.length - errors} notes` : ""}`}
          >
            {issues.length === 0 ? (
              <p className="text-iv/50 text-xs">Load a plan or press Validate.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto font-mono text-[11px]">
                {issues
                  .filter((i) => i.code !== "anchor.inferred")
                  .map((i, k) => (
                    <li
                      key={k}
                      className={
                        i.level === "error"
                          ? "text-[#ff8a66]"
                          : i.level === "warn"
                            ? "text-gold"
                            : "text-iv/70"
                      }
                    >
                      [{i.level}] {i.code} {i.elementId ? `#${i.elementId}` : ""} — {i.message}
                    </li>
                  ))}
                <li className="text-iv/40">
                  {issues.filter((i) => i.code === "anchor.inferred").length} anchors inferred
                </li>
              </ul>
            )}
          </Section>

          <Section title={`Elements · ${plan.elements.length}`}>
            <ul className="max-h-72 space-y-0.5 overflow-auto font-mono text-[11px]">
              {plan.elements.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`hover:text-gold w-full text-left ${t >= e.t0 && t <= e.t1 ? "text-gold" : "text-iv/70"}`}
                    onClick={() => seek(e.t0)}
                  >
                    {fmt(e.t0)}–{fmt(e.t1)} {e.type} <span className="text-iv/40">#{e.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>

      <footer className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn-ter h-9 px-5 text-xs"
            onClick={() => void togglePlay()}
            disabled={!ready}
          >
            {playing ? "Pause" : "Play"} <span className="opacity-60">(space)</span>
          </button>
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />{" "}
            loop
          </label>
          <input
            type="range"
            min={0}
            max={D}
            step={1 / FPS}
            value={t}
            onChange={(e) => {
              if (playingRef.current) void togglePlay();
              seek(Number(e.target.value));
            }}
            className="accent-gold flex-1"
            aria-label="Scrub"
          />
          <span className="text-iv/60 text-xs">← → step a frame</span>
        </div>
        <div
          className="relative h-16 overflow-hidden rounded-lg bg-white/5"
          title="elements by time; video modes above"
        >
          <div className="absolute inset-x-0 top-0 h-2">
            {plan.videoModes.map((m, i) => {
              const end = plan.videoModes[i + 1]?.t ?? D;
              return (
                <div
                  key={i}
                  className="absolute top-0 h-2"
                  style={{
                    left: `${(m.t / D) * 100}%`,
                    width: `${((end - m.t) / D) * 100}%`,
                    background: MODE_COLOR[m.mode],
                  }}
                  title={`${m.mode} @ ${fmt(m.t)}`}
                />
              );
            })}
          </div>
          {lanes.map((l) => (
            <button
              type="button"
              key={l.id}
              className="bg-iv/60 hover:bg-gold absolute h-2 rounded-sm"
              style={{
                left: `${(l.t0 / D) * 100}%`,
                width: `${Math.max(0.3, ((l.t1 - l.t0) / D) * 100)}%`,
                top: 12 + l.lane * 10,
              }}
              title={`${l.type} #${l.id} ${fmt(l.t0)}–${fmt(l.t1)}`}
              onClick={() => seek(l.t0)}
            />
          ))}
          <div
            className="bg-gold absolute bottom-0 top-0 w-px"
            style={{ left: `${(t / D) * 100}%` }}
          />
        </div>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 p-3">
      <h2 className="kicker text-gold mb-2 text-[0.6rem]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function FileRow({
  label,
  accept,
  multiple,
  onFile,
  onFiles,
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFile?: (f: File) => void;
  onFiles?: (f: FileList) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-iv/80">{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        className="text-iv/60 max-w-[190px] text-[11px]"
        onChange={(e) => {
          const files = e.target.files;
          if (!files?.length) return;
          if (onFiles) onFiles(files);
          else if (onFile && files[0]) onFile(files[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
}

/** Greedy lane packing so overlapping elements get separate rows in the strip. */
function laneLayout(plan: PlanT) {
  const sorted = [...plan.elements].sort((a, b) => a.t0 - b.t0);
  const laneEnd: number[] = [];
  return sorted.map((e) => {
    let lane = laneEnd.findIndex((end) => end <= e.t0);
    if (lane === -1) {
      lane = laneEnd.length;
      laneEnd.push(0);
    }
    laneEnd[lane] = e.t1;
    return { id: e.id, type: e.type, t0: e.t0, t1: e.t1, lane: Math.min(lane, 4) };
  });
}
