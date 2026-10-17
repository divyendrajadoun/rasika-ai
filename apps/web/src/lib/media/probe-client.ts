"use client";

export interface ClientProbe {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  /** JPEG of the first frame (null when the browser can't decode the codec, e.g. HEVC on some desktops). */
  thumbnail: Blob | null;
}

/** Reads duration/size and grabs a first-frame JPEG in the browser, without uploading anything. */
export function probeVideo(file: File, thumbWidth = 360): Promise<ClientProbe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    const out: ClientProbe = { durationSec: null, width: null, height: null, thumbnail: null };
    const finish = () => {
      URL.revokeObjectURL(url);
      resolve(out);
    };
    const timer = setTimeout(finish, 8000);
    v.onerror = () => {
      clearTimeout(timer);
      finish();
    };
    v.onloadedmetadata = () => {
      out.durationSec = Number.isFinite(v.duration) ? v.duration : null;
      out.width = v.videoWidth || null;
      out.height = v.videoHeight || null;
      v.currentTime = Math.min(0.5, (v.duration || 1) / 10);
    };
    v.onseeked = () => {
      try {
        const scale = thumbWidth / (v.videoWidth || thumbWidth);
        const c = document.createElement("canvas");
        c.width = Math.round((v.videoWidth || thumbWidth) * scale);
        c.height = Math.round((v.videoHeight || thumbWidth * (16 / 9)) * scale);
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx?.drawImage(v, 0, 0, c.width, c.height);
        // Browsers that can't decode the codec (HEVC on many desktops) paint black: skip that frame.
        if (ctx && isBlank(ctx.getImageData(0, 0, c.width, c.height).data)) {
          clearTimeout(timer);
          finish();
          return;
        }
        c.toBlob(
          (b) => {
            clearTimeout(timer);
            out.thumbnail = b;
            finish();
          },
          "image/jpeg",
          0.82,
        );
      } catch {
        clearTimeout(timer);
        finish();
      }
    };
    v.src = url;
  });
}

/** True when a frame is (almost) uniformly black. */
function isBlank(data: Uint8ClampedArray, threshold = 10): boolean {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4 * 97) {
    sum += (data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0);
    n++;
  }
  return sum / (3 * n) < threshold;
}

export function readImageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
