#!/usr/bin/env python3
"""
Prepare the generated industry portraits for the landing page.

SOUL renders selfie-style frames as 9:16 with blurred letterbox bars (it mimics a phone
recording). This crops the sharp central band to 4:5, resizes to 720×900 and writes an
optimised JPEG + a 24 px blurred placeholder colour into apps/web/src/content/portraits.json.

  python tools/portraits/prepare_portraits.py <dir with <industry>.jpg files>
"""

from __future__ import annotations

import json
import pathlib
import sys

from PIL import Image, ImageFilter, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "apps" / "web" / "public" / "industries"
META = ROOT / "apps" / "web" / "src" / "content" / "portraits.json"


def sharp_band(img: Image.Image) -> tuple[int, int]:
    """Rows where the image is not a blurred bar: compare each row's detail to the median."""
    g = img.convert("L").filter(ImageFilter.FIND_EDGES)
    w, h = g.size
    rows = [ImageStat.Stat(g.crop((0, y, w, y + 8))).mean[0] for y in range(0, h - 8, 8)]
    thresh = max(2.0, sorted(rows)[len(rows) // 2] * 0.35)
    ys = [y * 8 for y, v in enumerate(rows) if v > thresh]
    if not ys:
        return 0, h
    return max(0, ys[0] - 8), min(h, ys[-1] + 16)


def main() -> None:
    src = pathlib.Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    meta: dict[str, dict[str, object]] = {}
    for p in sorted(src.glob("*.jpg")):
        img = Image.open(p).convert("RGB")
        w, h = img.size
        top, bottom = sharp_band(img)
        band_h = bottom - top
        # 4:5 crop inside the sharp band, full width if the band allows, centred otherwise
        target_h = min(band_h, int(w * 1.25))
        target_w = int(target_h / 1.25)
        left = (w - target_w) // 2
        cy = top + band_h // 2
        t = max(top, min(bottom - target_h, cy - target_h // 2))
        crop = img.crop((left, t, left + target_w, t + target_h)).resize((720, 900), Image.LANCZOS)
        out = OUT / f"{p.stem}.jpg"
        crop.save(out, "JPEG", quality=82, optimize=True, progressive=True)
        tiny = crop.resize((24, 30)).filter(ImageFilter.GaussianBlur(1))
        r, g, b = (int(v) for v in ImageStat.Stat(tiny).mean)
        meta[p.stem] = {"src": f"/industries/{p.stem}.jpg", "width": 720, "height": 900, "color": f"#{r:02x}{g:02x}{b:02x}"}
        print(f"{p.stem:14s} {w}x{h} band {top}-{bottom} -> {out.stat().st_size // 1024} KB")
    META.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {META.relative_to(ROOT)} ({len(meta)} portraits)")


if __name__ == "__main__":
    main()
