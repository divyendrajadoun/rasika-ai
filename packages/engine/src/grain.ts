/** Film grain — seeded per frame so renders are deterministic (same t → same noise). */
import { rng } from "./toolkit";

export interface GrainLayer {
  canvas: HTMLCanvasElement;
  draw: (t: number, amt: number) => void;
}

export function createGrain(width: number, height: number, fps: number): GrainLayer {
  const canvas = document.createElement("canvas");
  canvas.className = "fx";
  canvas.width = Math.round(width / 3);
  canvas.height = Math.round(height / 3);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  const img = ctx?.createImageData(canvas.width, canvas.height);
  const draw = (t: number, amt: number) => {
    if (!ctx || !img) return;
    if (amt <= 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const r = rng(Math.floor(t * fps) + 1);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = r() * 255;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = amt;
    }
    ctx.putImageData(img, 0, 0);
  };
  return { canvas, draw };
}
