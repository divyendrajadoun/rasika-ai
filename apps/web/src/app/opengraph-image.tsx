import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { brand } from "@/config/brand";
import { hero } from "@/content/landing";

export const runtime = "nodejs";
export const alt = `${brand.name}: talk to your phone, post like a studio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The share card is the hero: the two-line sentence in Switzer on the oxblood field, one flat colour. */
export default async function OgImage() {
  const fontsDir = join(process.cwd(), "src", "fonts");
  const [semibold, regular] = await Promise.all([
    readFile(join(fontsDir, "Switzer-600.ttf")),
    readFile(join(fontsDir, "Switzer-400.ttf")),
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
        padding: 56,
        background: c.stage,
        color: c.ivory,
        fontFamily: "Switzer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 28 }}>
        <span style={{ fontWeight: 600 }}>{brand.name}</span>
        <span style={{ fontWeight: 400, opacity: 0.85 }}>{hero.trust.join(" · ")}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* satori mis-measures a line split into spans, so each line is one text run */}
        <span style={{ fontWeight: 600, fontSize: 112, lineHeight: 1, letterSpacing: -4 }}>
          {hero.lines[0]}
        </span>
        <span style={{ fontWeight: 600, fontSize: 112, lineHeight: 1, letterSpacing: -4, color: c.gold }}>
          {hero.lines[1]}
        </span>
        <span style={{ fontWeight: 400, fontSize: 34, marginTop: 28, opacity: 0.9 }}>
          Poster type · captions on the exact word · your photos when you say them · 94 styles
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Switzer", data: semibold, weight: 600, style: "normal" },
        { name: "Switzer", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
