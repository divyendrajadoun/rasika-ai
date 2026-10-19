"use client";

import { FileVideo, Pause, Play, RotateCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { probeVideo } from "@/lib/media/probe-client";
import {
  abortUpload,
  completeUpload,
  openSession,
  uploadParts,
  uploadSmall,
  type UploadProgress,
  type UploadSession,
} from "@/lib/upload/multipart-client";
import { ACCEPTED_VIDEO, formatBytes } from "@/lib/upload/plan";

export interface UploadResult {
  projectId: string;
  assetId: string;
  filename: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
  complete: boolean;
}

type Phase = "idle" | "probing" | "uploading" | "paused" | "finishing" | "done" | "error";

export function StepUpload({
  value,
  maxSeconds,
  planName,
  onChange,
  kind = "source_video",
  projectId,
}: {
  value: UploadResult | null;
  maxSeconds: number;
  planName: string;
  onChange: (v: UploadResult | null) => void;
  /** the reel itself, or the reference reel the edit should match */
  kind?: "source_video" | "reference_video";
  /** reference uploads attach to the project the source created */
  projectId?: string;
}) {
  const isRef = kind === "reference_video";
  const [phase, setPhase] = useState<Phase>(value?.complete ? "done" : "idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<File | null>(null);
  const sessionRef = useRef<UploadSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const probeRef = useRef<{
    durationSec: number | null;
    width: number | null;
    height: number | null;
    thumbnail: Blob | null;
  } | null>(null);

  const run = useCallback(
    async (file: File) => {
      setError(null);
      fileRef.current = file;
      try {
        setPhase("probing");
        const probe = await probeVideo(file);
        probeRef.current = probe;
        const thumbUrl = probe.thumbnail ? URL.createObjectURL(probe.thumbnail) : null;
        if (probe.durationSec && probe.durationSec > maxSeconds) {
          setError(
            `This clip is ${Math.round(probe.durationSec)} s. Your ${planName} plan allows up to ${maxSeconds} s.`,
          );
        }
        const { session, remaining, complete } = await openSession(
          file,
          value?.projectId ?? projectId,
          kind,
        );
        sessionRef.current = session;
        onChange({
          projectId: session.projectId,
          assetId: session.assetId,
          filename: file.name,
          sizeBytes: file.size,
          durationSec: probe.durationSec,
          width: probe.width,
          height: probe.height,
          thumbnailUrl: thumbUrl,
          complete: false,
        });
        if (!complete) {
          setPhase("uploading");
          const ac = new AbortController();
          abortRef.current = ac;
          await uploadParts(file, session, remaining, setProgress, ac.signal);
        }
        setPhase("finishing");
        await completeUpload(session, {
          durationSec: probe.durationSec ?? undefined,
          width: probe.width ?? undefined,
          height: probe.height ?? undefined,
        });
        if (probe.thumbnail && !isRef) {
          await uploadSmall(session.projectId, "thumbnail", probe.thumbnail, "thumb.jpg").catch(
            () => {},
          );
        }
        onChange({
          projectId: session.projectId,
          assetId: session.assetId,
          filename: file.name,
          sizeBytes: file.size,
          durationSec: probe.durationSec,
          width: probe.width,
          height: probe.height,
          thumbnailUrl: thumbUrl,
          complete: true,
        });
        setPhase("done");
      } catch (err) {
        if ((err as DOMException).name === "AbortError") {
          setPhase("paused");
          return;
        }
        setError((err as Error).message);
        setPhase("error");
      }
    },
    [maxSeconds, onChange, planName, value?.projectId, projectId, kind, isRef],
  );

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_VIDEO.includes(file.type) && !/\.(mp4|mov|m4v|hevc|mkv)$/i.test(file.name)) {
      setError("Please choose an MP4, MOV or HEVC video.");
      return;
    }
    void run(file);
  };

  const pause = () => abortRef.current?.abort();
  const resume = () => fileRef.current && void run(fileRef.current);
  const reset = async () => {
    abortRef.current?.abort();
    if (sessionRef.current) await abortUpload(sessionRef.current);
    sessionRef.current = null;
    fileRef.current = null;
    setProgress(null);
    setPhase("idle");
    onChange(null);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const pct = progress ? Math.round((progress.uploadedBytes / progress.totalBytes) * 100) : 0;

  if (phase === "idle" || (phase === "error" && !sessionRef.current)) {
    return (
      <div>
        <label
          htmlFor={isRef ? "reference-reel" : "reel"}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            pick(e.dataTransfer.files[0]);
          }}
          className={
            "bg-surface hover:bg-raised flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-border p-8 text-center transition-colors " +
            (dragOver ? "bg-raised border-text" : "")
          }
        >
          <Upload className="text-accent size-10" aria-hidden />
          <p className="mt-4 text-xl font-semibold leading-tight tracking-[-0.02em]">
            {isRef ? "Drop the reel you want to match" : "Drop your reel here"}
          </p>
          <p className="text-muted mt-1 text-[14px]">
            {isRef
              ? "or tap to choose · MP4, MOV · up to 3 min · we measure it, we never reuse it"
              : `or tap to choose · MP4, MOV, HEVC · up to ${maxSeconds} s on ${planName}`}
          </p>
          <p className="text-muted-foreground mt-3 text-[13px]">
            Uploads resume automatically if your connection drops.
          </p>
          <input
            id={isRef ? "reference-reel" : "reel"}
            type="file"
            accept="video/*,.mp4,.mov,.m4v,.hevc"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        {error && (
          <p
            className="mt-4 rounded-[6px] bg-surface px-3 py-2 text-sm text-[#ff8a66]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-[8px] p-5 sm:p-6">
      <div className="flex gap-5">
        <div className="bg-[#111] w-24 shrink-0 overflow-hidden rounded-[8px] sm:w-32">
          {value?.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL
            <img src={value.thumbnailUrl} crossOrigin="anonymous" alt="" className="aspect-[9/16] w-full object-cover" />
          ) : (
            <div className="flex aspect-[9/16] items-center justify-center">
              <FileVideo className="text-accent size-8" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold leading-tight tracking-[-0.02em]">{value?.filename ?? fileRef.current?.name}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatBytes(value?.sizeBytes ?? fileRef.current?.size ?? 0)}
            {value?.durationSec ? ` · ${Math.round(value.durationSec)} s` : ""}
            {value?.width ? ` · ${value.width}×${value.height}` : ""}
          </p>
          <div className="mt-4" aria-live="polite">
            {phase === "probing" && <p className="text-sm">Reading the file…</p>}
            {(phase === "uploading" || phase === "paused" || phase === "finishing") && (
              <>
                <div className="bg-raised h-2 overflow-hidden rounded-full">
                  <div className="bg-accent h-full transition-[width]" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-muted-foreground mt-2 text-[13px]">
                  {phase === "paused"
                    ? "Paused"
                    : phase === "finishing"
                      ? "Finishing…"
                      : `Uploading ${pct}%`}
                  {progress &&
                    ` · ${formatBytes(progress.uploadedBytes)} of ${formatBytes(progress.totalBytes)}`}
                  {progress &&
                    phase === "uploading" &&
                    progress.bytesPerSec > 0 &&
                    ` · ${formatBytes(progress.bytesPerSec)}/s`}
                  {progress &&
                    ` · part ${Math.min(progress.partsDone + 1, progress.partsTotal)} of ${progress.partsTotal}`}
                </p>
              </>
            )}
            {phase === "done" && (
              <p className="text-accent text-sm font-semibold">Uploaded</p>
            )}
            {phase === "error" && <p className="text-sm text-[#ff8a66]">{error}</p>}
          </div>
          {error && phase !== "error" && <p className="mt-2 text-sm text-[#ff8a66]">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {phase === "uploading" && (
              <button type="button" className="btn-outline-gold h-9 text-sm" onClick={pause}>
                <Pause className="size-4" aria-hidden /> Pause
              </button>
            )}
            {(phase === "paused" || phase === "error") && (
              <button type="button" className="btn-ter h-9 text-sm" onClick={resume}>
                <Play className="size-4" aria-hidden /> Resume
              </button>
            )}
            <button type="button" className="btn-outline-gold h-9 text-sm" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Choose another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
