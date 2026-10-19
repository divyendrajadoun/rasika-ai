"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { detectBands, rowStats } from "@/lib/image/auto-trim";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ASPECTS = [
  { label: "4:5 polaroid", value: 4 / 5 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
];

/** Crop tool with "auto-trim screenshot UI" (detects status/nav bars) and manual pan/zoom. */
export function CropDialog({
  src,
  initial,
  onClose,
  onApply,
}: {
  src: string;
  initial?: CropRect;
  onClose: () => void;
  onApply: (c: CropRect) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(ASPECTS[0]!.value);
  const [area, setArea] = useState<Area | null>(null);
  const [initialArea, setInitialArea] = useState<Area | undefined>(
    initial ? { x: initial.x, y: initial.y, width: initial.w, height: initial.h } : undefined,
  );
  const [trimNote, setTrimNote] = useState<string | null>(null);
  const dims = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const autoTrim = useCallback(async () => {
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => {});
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (!W || !H) return;
    dims.current = { w: W, h: H };
    const sw = 240;
    const sh = Math.round((H / W) * sw);
    const c = document.createElement("canvas");
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, sw, sh);
    const bands = detectBands(rowStats(ctx.getImageData(0, 0, sw, sh).data, sw, sh, 2));
    const top = Math.round((bands.top / sh) * H);
    const bottom = Math.round((bands.bottom / sh) * H);
    const availH = H - top - bottom;
    // largest rect of the chosen aspect inside the trimmed region, centred
    let w = W;
    let h = Math.round(w / aspect);
    if (h > availH) {
      h = availH;
      w = Math.round(h * aspect);
    }
    const x = Math.round((W - w) / 2);
    const y = top + Math.round((availH - h) / 2);
    setInitialArea({ x, y, width: w, height: h });
    setTrimNote(
      bands.reason.length
        ? `Trimmed ${bands.reason.join(" and ")}`
        : "No screenshot chrome detected",
    );
  }, [src, aspect]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
    >
      <div className="bg-surface w-full max-w-lg rounded-t-[12px] p-4 sm:rounded-[12px]">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em]">Crop</h2>
          <button type="button" className="button button-ghost h-8 text-[13px]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="bg-[#111] relative mt-3 h-[52vh] overflow-hidden rounded-[8px] sm:h-[420px]">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            initialCroppedAreaPixels={initialArea}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_a, px) => setArea(px)}
            onMediaLoaded={(m) => (dims.current = { w: m.naturalWidth, h: m.naturalHeight })}
            restrictPosition
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => setAspect(a.value)}
              className={
                "rounded-full border px-3 py-1 text-[13px] " +
                (aspect === a.value ? "ring-2 ring-text text-accent" : "")
              }
              aria-pressed={aspect === a.value}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            className="button button-ghost ml-auto h-8 text-[13px]"
            onClick={() => void autoTrim()}
          >
            Auto-trim screenshot UI
          </button>
        </div>
        <label className="mt-3 block text-[13px]">
          Zoom
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--ter)]"
          />
        </label>
        {trimNote && <p className="text-muted-foreground mt-2 text-[13px]">{trimNote}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="button"
            disabled={!area}
            onClick={() =>
              area &&
              onApply({
                x: Math.round(area.x),
                y: Math.round(area.y),
                w: Math.round(area.width),
                h: Math.round(area.height),
              })
            }
          >
            Apply crop
          </button>
        </div>
      </div>
    </div>
  );
}
