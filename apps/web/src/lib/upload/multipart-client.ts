"use client";

import { fileFingerprint, remainingParts, type PartRange } from "./plan";

export interface UploadSession {
  projectId: string;
  assetId: string;
  key: string;
  uploadId: string;
  plan: PartRange[];
  fingerprint: string;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
  bytesPerSec: number;
  partsDone: number;
  partsTotal: number;
}

const LS_KEY = "rasika:uploads";

function loadSessions(): Record<string, UploadSession> {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as Record<string, UploadSession>;
  } catch {
    return {};
  }
}
function saveSession(s: UploadSession) {
  try {
    const all = loadSessions();
    all[s.fingerprint] = s;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    /* private mode */
  }
}
export function forgetSession(fingerprint: string) {
  try {
    const all = loadSessions();
    delete all[fingerprint];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** Finds a resumable session for this file, or starts a new multipart upload. */
export async function openSession(
  file: File,
  projectId?: string,
  kind: "source_video" | "reference_video" = "source_video",
): Promise<{ session: UploadSession; remaining: PartRange[]; complete: boolean }> {
  const fingerprint = `${kind === "reference_video" ? "ref:" : ""}${fileFingerprint(file)}`;
  const existing = loadSessions()[fingerprint];
  if (existing && (!projectId || existing.projectId === projectId)) {
    try {
      const st = await api<{
        complete: boolean;
        uploaded: Array<{ partNumber: number; size: number }>;
        remaining: PartRange[];
      }>(`/api/uploads/${existing.assetId}?uploadId=${encodeURIComponent(existing.uploadId)}`);
      if (st.complete) return { session: existing, remaining: [], complete: true };
      return {
        session: existing,
        remaining: remainingParts(existing.plan, st.uploaded),
        complete: false,
      };
    } catch {
      forgetSession(fingerprint); // expired → start over
    }
  }
  const created = await api<{
    projectId: string;
    assetId: string;
    key: string;
    uploadId: string;
    parts: PartRange[];
  }>("/api/uploads/create", {
    method: "POST",
    body: JSON.stringify({ projectId, filename: file.name, size: file.size, mime: file.type, kind }),
  });
  const session: UploadSession = { ...created, plan: created.parts, fingerprint };
  saveSession(session);
  return { session, remaining: session.plan, complete: false };
}

function putPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Part upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Uploads the remaining parts with limited concurrency and per-part retries.
 * Survives network drops (retries with backoff) and reloads (resume via openSession).
 */
export async function uploadParts(
  file: File,
  session: UploadSession,
  remaining: PartRange[],
  onProgress: (p: UploadProgress) => void,
  signal: AbortSignal,
  concurrency = 3,
): Promise<void> {
  const total = file.size;
  const doneBytes = total - remaining.reduce((s, p) => s + (p.end - p.start), 0);
  const inFlight = new Map<number, number>();
  let completedBytes = doneBytes;
  let partsDone = session.plan.length - remaining.length;
  const started = performance.now();
  const report = () => {
    const uploadedBytes = completedBytes + [...inFlight.values()].reduce((a, b) => a + b, 0);
    const secs = Math.max(0.5, (performance.now() - started) / 1000);
    onProgress({
      uploadedBytes,
      totalBytes: total,
      bytesPerSec: (uploadedBytes - doneBytes) / secs,
      partsDone,
      partsTotal: session.plan.length,
    });
  };
  report();

  const queue = [...remaining];
  const urlCache = new Map<number, string>();
  const signBatch = async () => {
    const need = queue
      .slice(0, 10)
      .map((p) => p.partNumber)
      .filter((n) => !urlCache.has(n));
    if (!need.length) return;
    const { urls } = await api<{ urls: Array<{ partNumber: number; url: string }> }>(
      `/api/uploads/${session.assetId}`,
      {
        method: "POST",
        body: JSON.stringify({ action: "sign", uploadId: session.uploadId, partNumbers: need }),
      },
    );
    for (const u of urls) urlCache.set(u.partNumber, u.url);
  };

  const worker = async () => {
    while (queue.length) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      await signBatch();
      const part = queue.shift();
      if (!part) break;
      const blob = file.slice(part.start, part.end);
      let attempt = 0;
      for (;;) {
        try {
          const url =
            urlCache.get(part.partNumber) ??
            (await (async () => {
              await signBatch();
              return urlCache.get(part.partNumber)!;
            })());
          await putPart(
            url,
            blob,
            (loaded) => {
              inFlight.set(part.partNumber, loaded);
              report();
            },
            signal,
          );
          inFlight.delete(part.partNumber);
          completedBytes += blob.size;
          partsDone++;
          report();
          break;
        } catch (err) {
          inFlight.delete(part.partNumber);
          if ((err as DOMException).name === "AbortError") throw err;
          attempt++;
          if (attempt > 6) throw err;
          urlCache.delete(part.partNumber); // presign again in case it expired
          await sleep(Math.min(15000, 500 * 2 ** attempt));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, remaining.length || 1) }, worker));
}

export async function completeUpload(
  session: UploadSession,
  meta?: { durationSec?: number; width?: number; height?: number },
) {
  await api(`/api/uploads/${session.assetId}`, {
    method: "POST",
    body: JSON.stringify({ action: "complete", uploadId: session.uploadId, meta }),
  });
  forgetSession(session.fingerprint);
}

export async function abortUpload(session: UploadSession) {
  await api(`/api/uploads/${session.assetId}`, {
    method: "POST",
    body: JSON.stringify({ action: "abort", uploadId: session.uploadId }),
  }).catch(() => {});
  forgetSession(session.fingerprint);
}

/** Single PUT for photos / thumbnails. */
export async function uploadSmall(
  projectId: string,
  kind: "image" | "thumbnail",
  file: Blob,
  filename: string,
  dims?: { width: number; height: number },
) {
  const { assetId, url } = await api<{ assetId: string; url: string }>("/api/uploads/image", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      kind,
      filename,
      size: file.size,
      mime: file.type || "application/octet-stream",
      ...dims,
    }),
  });
  const res = await fetch(url, {
    method: "PUT",
    body: file,
    headers: { "content-type": file.type || "application/octet-stream" },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return assetId;
}
