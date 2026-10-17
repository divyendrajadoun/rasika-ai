import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand } from "@/config/brand";

export const runtime = "nodejs";
export const alt = `${brand.name} — your reel, edited like a studio did it`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** OG image in the brand style: maroon jaali, Anton poster line, gold serif accent. */
export default async function OgImage() {
  const fontsDir = join(process.cwd(), "src", "fonts");
  const [anton, serif] = await Promise.all([
    readFile(join(fontsDir, "Anton.ttf")),
    readFile(join(fontsDir, "InstrumentSerif-Italic.ttf")),
  ]);
  const c = brand.colors;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: c.stage,
        backgroundImage: `radial-gradient(circle at 0 0, rgba(230,180,80,.18) 3px, transparent 4px)`,
        backgroundSize: "60px 60px",
        color: c.ivory,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "Serif", fontStyle: "italic", fontSize: 56, color: c.gold }}>
          {brand.name}
        </span>
        <span style={{ fontSize: 22, letterSpacing: 6, color: c.gold, opacity: 0.85 }}>
          HINDI + ENGLISH · 1080P · SOUND
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "Anton",
            fontSize: 120,
            lineHeight: 0.96,
          }}
        >
          YOUR REEL.
        </span>
        <div
          style={{
            display: "flex",
            gap: 28,
            fontFamily: "Anton",
            fontSize: 120,
            lineHeight: 0.96,
          }}
        >
          <span>EDITED LIKE A</span>
          <span style={{ color: c.gold }}>STUDIO</span>
          <span>DID IT.</span>
        </div>
        <span
          style={{
            fontFamily: "Serif",
            fontStyle: "italic",
            fontSize: 40,
            marginTop: 28,
            color: c.ivory,
            opacity: 0.9,
          }}
        >
          Poster type · one-word captions · your photos on the exact word
        </span>
      </div>
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg, transparent, ${c.gold}, transparent)`,
        }}
      />
    </div>,
    {
      ...size,
      fonts: [
        { name: "Anton", data: anton, weight: 400, style: "normal" },
        { name: "Serif", data: serif, weight: 400, style: "italic" },
      ],
    },
  );
}
