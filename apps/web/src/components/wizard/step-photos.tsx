"use client";

import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CropDialog, type CropRect } from "@/components/wizard/crop-dialog";
import { readImageSize } from "@/lib/media/probe-client";
import { uploadSmall } from "@/lib/upload/multipart-client";
import { ACCEPTED_IMAGE } from "@/lib/upload/plan";

export interface PhotoItem {
  assetId: string;
  previewUrl: string;
  filename: string;
  label: string;
  sayWhen: string;
  crop?: CropRect;
  width?: number;
  height?: number;
}

export function StepPhotos({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: PhotoItem[];
  onChange: (v: PhotoItem[]) => void;
}) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<PhotoItem | null>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    setError(null);
    const room = 15 - value.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) setError(`Up to 15 photos per reel (${files.length - room} skipped).`);
    const added: PhotoItem[] = [];
    for (const f of list) {
      if (!ACCEPTED_IMAGE.includes(f.type)) {
        setError(`${f.name}: use JPG, PNG, WebP or HEIC.`);
        continue;
      }
      setBusy((b) => b + 1);
      try {
        const dims = await readImageSize(f);
        const assetId = await uploadSmall(projectId, "image", f, f.name, dims ?? undefined);
        added.push({
          assetId,
          previewUrl: URL.createObjectURL(f),
          filename: f.name,
          label: "",
          sayWhen: "",
          width: dims?.width,
          height: dims?.height,
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
  };

  const update = (id: string, patch: Partial<PhotoItem>) =>
    onChange(value.map((p) => (p.assetId === id ? { ...p, ...patch } : p)));
  const remove = async (id: string) => {
    onChange(value.filter((p) => p.assetId !== id));
    await fetch("/api/uploads/image", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId: id }),
    }).catch(() => {});
  };

  return (
    <div>
      <p className="text-muted">
        Optional. Add up to 15 photos. Tell us which word each one belongs to — “show this when I
        say <em>balcony</em>”.
      </p>

      <label
        htmlFor="photos"
        className="bg-surface hover:bg-raised mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-[8px] border-2 border-dashed border-border p-5 text-center transition-colors transition"
      >
        <ImagePlus className="text-accent size-6" aria-hidden />
        <span className="font-semibold">{busy ? `Uploading ${busy}…` : "Add photos"}</span>
        <span className="text-muted-foreground text-sm">({value.length}/15)</span>
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={value.length >= 15}
          onChange={(e) => void add(e.target.files)}
        />
      </label>
      {error && (
        <p
          className="mt-3 rounded-[6px] bg-surface px-3 py-2 text-sm text-[#ff8a66]"
          role="alert"
        >
          {error}
        </p>
      )}

      {value.length > 0 && (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {value.map((p, i) => (
            <li key={p.assetId} className="bg-surface flex gap-3 rounded-[8px] p-3">
              <div className="polaroid w-24 shrink-0 !p-1 !pb-1">
                <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
                  <img
                    src={p.previewUrl}
                    crossOrigin={p.previewUrl.startsWith("http") ? "anonymous" : undefined}
                    alt=""
                    className="h-full w-full object-cover"
                    style={cropStyle(p)}
                  />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  className="input"
                  placeholder={`Label (e.g. “East-facing balcony”)`}
                  maxLength={60}
                  value={p.label}
                  onChange={(e) => update(p.assetId, { label: e.target.value })}
                  aria-label={`Label for photo ${i + 1}`}
                />
                <input
                  className="input"
                  placeholder="Show when I say… (optional)"
                  maxLength={120}
                  value={p.sayWhen}
                  onChange={(e) => update(p.assetId, { sayWhen: e.target.value })}
                  aria-label={`Show photo ${i + 1} when I say`}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="button button-ghost h-8 text-[13px]"
                    onClick={() => setCropping(p)}
                  >
                    <Crop className="size-3.5" aria-hidden /> {p.crop ? "Re-crop" : "Crop"}
                  </button>
                  <button
                    type="button"
                    className="icon-btn hover:text-[#ff8a66]"
                    aria-label="Remove photo"
                    onClick={() => void remove(p.assetId)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {cropping && (
        <CropDialog
          src={cropping.previewUrl}
          initial={cropping.crop}
          onClose={() => setCropping(null)}
          onApply={(crop) => {
            update(cropping.assetId, { crop });
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

/** Preview the crop with object-position/scale approximation (the worker applies the exact crop). */
function cropStyle(p: PhotoItem): React.CSSProperties | undefined {
  if (!p.crop || !p.width || !p.height) return undefined;
  const { x, y, w, h } = p.crop;
  const scale = Math.max(p.width / w, p.height / h);
  const cx = ((x + w / 2) / p.width) * 100;
  const cy = ((y + h / 2) / p.height) * 100;
  return {
    objectPosition: `${cx}% ${cy}%`,
    transform: `scale(${Math.min(scale, 4)})`,
    transformOrigin: `${cx}% ${cy}%`,
  };
}
