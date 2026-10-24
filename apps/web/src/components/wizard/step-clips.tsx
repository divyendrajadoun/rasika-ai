"use client";

import { ArrowDown, ArrowUp, FileVideo, Layers, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { probeVideo } from "@/lib/media/probe-client";
import {
  abortUpload,
  completeUpload,
  openSession,
  uploadParts,
  uploadSmall,
  type UploadSession,
} from "@/lib/upload/multipart-client";
import { ACCEPTED_VIDEO, fileFingerprint, formatBytes } from "@/lib/upload/plan";
import { cn } from "@/lib/utils";

/** one clip of a many-clips reel, as the wizard keeps it */
export interface ClipItem {
  /** the file's fingerprint (name, size, date): the same file is never added twice */
  key: string;
  assetId: string | null;
  filename: string;
  sizeBytes: number;
  durationSec: number | null;
  /** when the file was recorded (or last changed): the starting order */
  lastModified: number;
  thumbnailUrl: string | null;
  status: "queued" | "uploading" | "done" | "error";
  pct: number;
  error?: string;
}

export const MAX_CLIPS = 30;
/** the clips together, before the dead air and the earlier takes come out */
export const MAX_CLIPS_SECONDS = 15 * 60;

export const clipsSeconds = (clips: ClipItem[]) =>
  clips.reduce((s, c) => s + (c.durationSec ?? 0), 0);
export const clipsReady = (clips: ClipItem[]) =>
  clips.length > 0 &&
  clips.every((c) => c.status === "done" && c.assetId) &&
  clipsSeconds(clips) <= MAX_CLIPS_SECONDS;

const isVideo = (f: File) =>
  ACCEPTED_VIDEO.includes(f.type) || /\.(mp4|mov|m4v|hevc|mkv)$/i.test(f.name);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/**
 * Many clips → one reel: drop every clip you recorded (in any order). They upload one after
 * another into one project; the worker hears each, orders them by what is said (or by the script
 * when one is given), keeps the best take of each line and joins them into one take.
 */
export function StepClips({
  value,
  projectId,
  script,
  cleanCut,
  onChange,
  onProject,
  onScript,
  onCleanCut,
}: {
  value: ClipItem[];
  projectId: string | null;
  script: string;
  cleanCut: boolean;
  onChange: (fn: (clips: ClipItem[]) => ClipItem[]) => void;
  onProject: (projectId: string) => void;
  onScript: (s: string) => void;
  onCleanCut: (on: boolean) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const files = useRef(new Map<string, File>());
  const sessions = useRef(new Map<string, UploadSession>());
  const aborts = useRef(new Map<string, AbortController>());
  const project = useRef<string | null>(projectId);
  const running = useRef(false);
  project.current = projectId ?? project.current;

  const patch = useCallback(
    (key: string, p: Partial<ClipItem>) =>
      onChange((list) => list.map((c) => (c.key === key ? { ...c, ...p } : c))),
    [onChange],
  );

  const uploadOne = useCallback(
    async (key: string) => {
      const file = files.current.get(key);
      if (!file) {
        patch(key, { status: "error", error: "Add this file again to upload it" });
        return;
      }
      patch(key, { status: "uploading", pct: 0, error: undefined });
      try {
        const probe = await probeVideo(file);
        const thumb = probe.thumbnail ? URL.createObjectURL(probe.thumbnail) : null;
        patch(key, { durationSec: probe.durationSec, thumbnailUrl: thumb });
        const { session, remaining, complete } = await openSession(
          file,
          project.current ?? undefined,
          "source_clip",
        );
        sessions.current.set(key, session);
        if (!project.current) {
          project.current = session.projectId;
          onProject(session.projectId);
        }
        patch(key, { assetId: session.assetId });
        if (!complete) {
          const ac = new AbortController();
          aborts.current.set(key, ac);
          await uploadParts(
            file,
            session,
            remaining,
            (p) => patch(key, { pct: Math.round((p.uploadedBytes / p.totalBytes) * 100) }),
            ac.signal,
          );
        }
        await completeUpload(session, {
          durationSec: probe.durationSec ?? undefined,
          width: probe.width ?? undefined,
          height: probe.height ?? undefined,
        });
        patch(key, { status: "done", pct: 100 });
        // the project card shows the first clip
        if (probe.thumbnail && !sessions.current.has("__thumb")) {
          sessions.current.set("__thumb", session);
          await uploadSmall(session.projectId, "thumbnail", probe.thumbnail, "thumb.jpg").catch(
            () => {},
          );
        }
      } catch (err) {
        if ((err as DOMException).name === "AbortError") return;
        patch(key, { status: "error", error: (err as Error).message });
      } finally {
        aborts.current.delete(key);
      }
    },
    [onProject, patch],
  );

  // one upload at a time, in list order: the first one creates the project the rest join
  const latest = useRef(value);
  latest.current = value;
  const started = useRef(new Set<string>());
  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = latest.current.find(
          (c) => c.status === "queued" && files.current.has(c.key) && !started.current.has(c.key),
        );
        if (!next) break;
        started.current.add(next.key);
        await uploadOne(next.key);
      }
    } finally {
      running.current = false;
    }
  }, [uploadOne]);

  useEffect(() => {
    if (value.some((c) => c.status === "queued" && files.current.has(c.key))) void pump();
  }, [value, pump]);

  useEffect(() => {
    const live = aborts.current;
    return () => live.forEach((a) => a.abort());
  }, []);

  const add = (list: FileList | null) => {
    if (!list) return;
    setNotice(null);
    const picked = [...list].filter(isVideo);
    if (picked.length < list.length) setNotice("Only videos can be added (MP4, MOV, HEVC).");
    const have = new Set(value.map((c) => c.key));
    const fresh = picked
      .map((f) => ({ f, key: fileFingerprint(f) }))
      .filter(({ key }) => !have.has(key))
      .sort((a, b) => a.f.lastModified - b.f.lastModified || a.f.name.localeCompare(b.f.name));
    const room = MAX_CLIPS - value.length;
    if (fresh.length > room) setNotice(`Up to ${MAX_CLIPS} clips in one reel.`);
    const take = fresh.slice(0, Math.max(0, room));
    for (const { f, key } of take) files.current.set(key, f);
    onChange((cur) => {
      const next = [
        ...cur,
        ...take.map(({ f, key }): ClipItem => ({
          key,
          assetId: null,
          filename: f.name,
          sizeBytes: f.size,
          durationSec: null,
          lastModified: f.lastModified,
          thumbnailUrl: null,
          status: "queued",
          pct: 0,
        })),
      ];
      // a clip added later can still belong in the middle: keep the recording order
      return next.sort(
        (a, b) => a.lastModified - b.lastModified || a.filename.localeCompare(b.filename),
      );
    });
  };

  const move = (i: number, by: number) =>
    onChange((list) => {
      const j = i + by;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  const remove = (c: ClipItem) => {
    aborts.current.get(c.key)?.abort();
    const s = sessions.current.get(c.key);
    if (s && c.status !== "done") void abortUpload(s);
    files.current.delete(c.key);
    onChange((list) => list.filter((x) => x.key !== c.key));
  };

  const retry = (c: ClipItem) => {
    if (!files.current.has(c.key)) return;
    started.current.delete(c.key);
    patch(c.key, { status: "queued", pct: 0, error: undefined });
  };

  const total = clipsSeconds(value);
  const stuck = value.filter((c) => c.status !== "done" && !files.current.has(c.key));

  return (
    <div className="space-y-6">
      <label
        htmlFor="clips"
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "bg-surface hover:bg-raised border-border flex cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed p-8 text-center transition-colors",
          value.length ? "min-h-36" : "min-h-64",
          dragOver && "bg-raised border-text",
        )}
      >
        <Layers className="text-accent size-10" aria-hidden />
        <p className="mt-4 text-xl font-semibold leading-tight tracking-[-0.02em]">
          {value.length ? "Add more clips" : "Drop all your clips here"}
        </p>
        <p className="text-muted mt-1 text-[14px]">
          or tap to choose several · any order · up to {MAX_CLIPS} clips, {MAX_CLIPS_SECONDS / 60}{" "}
          min in all
        </p>
        <p className="text-muted-foreground mt-3 max-w-[52ch] text-[13px]">
          We listen to every clip, put them in the order of what you say, keep the best take of each
          line and join them into one video. You can change the order afterwards.
        </p>
        <input
          id="clips"
          type="file"
          multiple
          accept="video/*,.mp4,.mov,.m4v,.hevc"
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {notice && (
        <p className="bg-surface rounded-[6px] px-3 py-2 text-sm text-[#ff8a66]" role="alert">
          {notice}
        </p>
      )}

      {value.length > 0 && (
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="label mb-0">
              {value.length} clip{value.length === 1 ? "" : "s"} · {fmt(total)} in all
            </p>
            <p className="text-muted-foreground text-[13px]">
              Recording order for now. Rasika reorders them by what you say.
            </p>
          </div>
          {total > MAX_CLIPS_SECONDS && (
            <p className="mb-2 text-sm text-[#ff8a66]">
              That is more than {MAX_CLIPS_SECONDS / 60} minutes of clips. Leave a few out.
            </p>
          )}
          {stuck.length > 0 && (
            <p className="mb-2 text-sm text-[#ff8a66]">
              {stuck.length} clip{stuck.length === 1 ? " was" : "s were"} still uploading when the
              page closed. Remove {stuck.length === 1 ? "it" : "them"} and add the file again.
            </p>
          )}
          <ol className="space-y-2">
            {value.map((c, i) => (
              <li key={c.key} className="bg-surface flex items-center gap-3 rounded-[8px] p-2 pr-3">
                <span className="text-muted w-6 shrink-0 text-center text-[13px] tabular-nums">
                  {i + 1}
                </span>
                <div className="h-16 w-9 shrink-0 overflow-hidden rounded-[4px] bg-[#111]">
                  {c.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL
                    <img src={c.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <FileVideo className="text-accent size-4" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{c.filename}</p>
                  <p className="text-muted-foreground text-[12px]">
                    {formatBytes(c.sizeBytes)}
                    {c.durationSec ? ` · ${fmt(c.durationSec)}` : ""}
                    {" · "}
                    {c.status === "done" ? (
                      <span className="text-accent font-semibold">Uploaded</span>
                    ) : c.status === "uploading" ? (
                      `Uploading ${c.pct}%`
                    ) : c.status === "error" ? (
                      <span className="text-[#ff8a66]">{c.error ?? "Failed"}</span>
                    ) : (
                      "Waiting"
                    )}
                  </p>
                  {c.status === "uploading" && (
                    <div className="bg-raised mt-1 h-1 overflow-hidden rounded-full">
                      <div
                        className="bg-accent h-full transition-[width]"
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {c.status === "error" && files.current.has(c.key) && (
                    <button
                      type="button"
                      className="button button-ghost h-8 px-2"
                      onClick={() => retry(c)}
                      aria-label={`Retry ${c.filename}`}
                    >
                      <RotateCcw className="size-4" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className="button button-ghost h-8 px-2"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move ${c.filename} up`}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="button button-ghost h-8 px-2"
                    disabled={i === value.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move ${c.filename} down`}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="button button-ghost h-8 px-2 hover:text-[#ff8a66]"
                    onClick={() => remove(c)}
                    aria-label={`Remove ${c.filename}`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div>
        <label htmlFor="clip-script" className="label">
          Your script <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          id="clip-script"
          className="input min-h-28"
          maxLength={6000}
          value={script}
          onChange={(e) => onScript(e.target.value)}
          placeholder="Paste what you meant to say, one line per thought. We follow its order, keep the take closest to each line, and leave out clips that are not in it."
        />
        <p className="text-muted-foreground mt-1 text-[13px]">
          No script? We work out the order from what you say in each clip.
        </p>
      </div>

      <label className="bg-surface flex items-center justify-between gap-4 rounded-[8px] p-4">
        <span>
          <span className="block font-semibold">Clean cut inside the clips</span>
          <span className="text-muted-foreground text-[13px]">
            Also take out ums and uhs, words said twice and long pauses. Earlier takes and the dead
            air at the start and end of each clip always come out.
          </span>
        </span>
        <input
          type="checkbox"
          className="size-5 shrink-0"
          checked={cleanCut}
          onChange={(e) => onCleanCut(e.target.checked)}
        />
      </label>
    </div>
  );
}
