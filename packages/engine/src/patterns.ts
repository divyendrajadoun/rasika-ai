/**
 * SVG patterns — jaali (from the reference pattern card), arches (from the reference temple
 * plate), bandhani (tie-dye dot clusters) and leheriya (diagonal wave stripes).
 */
import type { ColorToken, PatternId } from "@rasika/schema";
import { nextId } from "./dom";

export type Colors = Record<ColorToken, string>;

/** A pattern-filled SVG of w×h. Used as a card face (420×500) or a full plate (1080×1920). */
export function patternSvg(id: PatternId, w: number, h: number, C: Colors): string {
  const pid = nextId(`rk-${id}`);
  switch (id) {
    case "jaali":
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;background:${C.ter}"><defs>
<pattern id="${pid}" width="70" height="70" patternUnits="userSpaceOnUse">
<path d="M35 4 L66 35 L35 66 L4 35Z" fill="none" stroke="${C.iv}" stroke-width="5"/><circle cx="35" cy="35" r="11" fill="none" stroke="${C.gold}" stroke-width="4"/>
<circle cx="0" cy="0" r="7" fill="${C.iv}"/><circle cx="70" cy="70" r="7" fill="${C.iv}"/><circle cx="70" cy="0" r="7" fill="${C.iv}"/><circle cx="0" cy="70" r="7" fill="${C.iv}"/></pattern></defs>
<rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
    case "arches":
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><defs><linearGradient id="${pid}-g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#c98d5c"/><stop offset="1" stop-color="#7d3f22"/></linearGradient>
<pattern id="${pid}" width="270" height="420" patternUnits="userSpaceOnUse"><path d="M25 410 L25 170 Q25 30 135 20 Q245 30 245 170 L245 410" fill="none" stroke="#f3d3a8" stroke-opacity=".45" stroke-width="10"/>
<path d="M55 410 L55 180 Q55 65 135 55 Q215 65 215 180 L215 410" fill="none" stroke="#5a2410" stroke-opacity=".35" stroke-width="6"/>
<circle cx="135" cy="120" r="16" fill="#f3d3a8" fill-opacity=".4"/></pattern></defs>
<rect width="${w}" height="${h}" fill="url(#${pid}-g)"/><rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
    case "bandhani": {
      const dots = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return `<circle cx="${(45 + Math.cos(a) * 24).toFixed(1)}" cy="${(45 + Math.sin(a) * 24).toFixed(1)}" r="5.5" fill="${C.iv}"/>`;
      }).join("");
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;background:${C.ter}"><defs>
<pattern id="${pid}" width="90" height="90" patternUnits="userSpaceOnUse">${dots}<circle cx="45" cy="45" r="7" fill="${C.gold}"/>
<circle cx="0" cy="0" r="4" fill="${C.iv}" fill-opacity=".7"/><circle cx="90" cy="0" r="4" fill="${C.iv}" fill-opacity=".7"/><circle cx="0" cy="90" r="4" fill="${C.iv}" fill-opacity=".7"/><circle cx="90" cy="90" r="4" fill="${C.iv}" fill-opacity=".7"/></pattern></defs>
<rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
    }
    case "solid":
      // a flat accent plate — the colour-block families use it as a full-bleed ground
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block"><rect width="${w}" height="${h}" fill="${C.ter}"/></svg>`;
    case "blocks": {
      // a mosaic of flat blocks in the palette (deterministic layout)
      const cols = [C.ter, C.gold, C.mar, C.goldd, C.iv];
      const cw = Math.ceil(w / 3);
      const ch = Math.ceil(h / 5);
      let rects = "";
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          rects += `<rect x="${c * cw}" y="${r * ch}" width="${cw}" height="${ch}" fill="${cols[(r * 3 + c * 2) % cols.length]}"/>`;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">${rects}</svg>`;
    }
    case "leheriya": {
      const wave = (y: number, col: string, sw: number) =>
        `<path d="M-20 ${y} Q 20 ${y - 14} 60 ${y} T 140 ${y} T 220 ${y}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;background:${C.mar}"><defs>
<pattern id="${pid}" width="160" height="160" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
${wave(20, C.gold, 14)}${wave(60, C.iv, 10)}${wave(100, C.ter, 16)}${wave(140, C.gold, 8)}</pattern></defs>
<rect width="${w}" height="${h}" fill="url(#${pid})"/></svg>`;
    }
  }
}
