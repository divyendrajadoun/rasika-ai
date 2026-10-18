/**
 * Engine stylesheet — ported from reference/mikku/assets/template.html, scoped under `.rk`
 * and parametrised by the plan's palette, fonts and caption style.
 *
 * Fonts: every preset picks families from the bundled OFL set below (packages/engine/fonts).
 * The family name in `style.fonts` is the real font name; `FONTS` maps it to its file.
 */
import type { Palette, StyleTokens } from "@rasika/schema";

export interface FontFile {
  file: string;
  weight?: string;
  style?: "italic" | "normal";
}

/** The bundled font set. Keys are the family names presets use. */
export const FONTS: Record<string, FontFile> = {
  Anton: { file: "Anton.ttf" },
  Inter: { file: "Inter.ttf", weight: "100 900" },
  "Instrument Serif": { file: "InstrumentSerif-Italic.ttf", style: "italic" },
  "Tiro Devanagari Hindi": { file: "TiroDevanagariHindi.ttf" },
  Mukta: { file: "Mukta-ExtraBold.ttf" },
  Montserrat: { file: "Montserrat.ttf", weight: "100 900" },
  "Bebas Neue": { file: "BebasNeue-Regular.ttf" },
  "Playfair Display": { file: "PlayfairDisplay-Italic.ttf", weight: "400 900", style: "italic" },
  "Archivo Black": { file: "ArchivoBlack-Regular.ttf" },
  Caveat: { file: "Caveat.ttf", weight: "400 700" },
  Bangers: { file: "Bangers-Regular.ttf" },
  Poppins: { file: "Poppins-Bold.ttf", weight: "700" },
  "DM Serif Display": { file: "DMSerifDisplay-Regular.ttf" },
  "DM Serif Display Italic": { file: "DMSerifDisplay-Italic.ttf", style: "italic" },
};

/** Legacy aliases used by older plans / the reference composition. */
const ALIAS: Record<string, string> = {
  Serif: "Instrument Serif",
  Tiro: "Tiro Devanagari Hindi",
  "Tiro Devanagari": "Tiro Devanagari Hindi",
};

export function fontFamily(name: string): string {
  return ALIAS[name] ?? name;
}

/** Families an engine instance must wait for (SPEC §6.2: every font goes into `__ready`). */
export function fontsForStyle(fonts: StyleTokens["fonts"]): string[] {
  const set = new Set<string>([
    "Anton",
    "Inter",
    "Instrument Serif",
    "Tiro Devanagari Hindi",
    "Mukta",
  ]);
  for (const f of [fonts.poster, fonts.accent, fonts.ui, fonts.devanagari, fonts.caption]) {
    set.add(fontFamily(f));
  }
  return [...set].filter((f) => f in FONTS);
}

/** `document.fonts.load` descriptors for a family. */
export function fontLoadDescriptor(family: string): string {
  const f = FONTS[family];
  const weight = f?.weight ? (f.weight.includes(" ") ? "800" : f.weight) : "400";
  const style = f?.style === "italic" ? "italic " : "";
  return `${style}${weight} 100px "${family}"`;
}

/** Kept for callers that only know the classic five. */
export const FONT_LOADS = [
  "400 100px Anton",
  "800 50px Inter",
  'italic 100px "Instrument Serif"',
  '100px "Tiro Devanagari Hindi"',
  "80px Mukta",
] as const;

export function fontFaceCss(
  base: string,
  families: readonly string[] = Object.keys(FONTS),
): string {
  const b = base.replace(/\/$/, "");
  return families
    .map((fam) => {
      const f = FONTS[fam];
      if (!f) return "";
      return `@font-face{font-family:"${fam}";src:url("${b}/${f.file}")${f.weight ? `;font-weight:${f.weight}` : ""}${f.style ? `;font-style:${f.style}` : ""}}`;
    })
    .join("\n");
}

export const FONT_FILES = Object.fromEntries(
  Object.entries(FONTS).map(([k, v]) => [k, v.file]),
) as Record<string, string>;

/** Which fonts are themselves italic faces (so `.se` keeps its italic feel without synthesis). */
const ITALIC_FACES = new Set(["Instrument Serif", "Playfair Display", "DM Serif Display Italic"]);

export interface EngineCssOptions {
  palette: Palette;
  captionSize: number;
  fonts: StyleTokens["fonts"];
  captionStyle: StyleTokens["captionStyle"];
  captionAccent: StyleTokens["captionAccent"];
}

export function engineCss(o: EngineCssOptions): string {
  const p = o.palette;
  const cs = o.captionSize;
  const k = cs / 74; // caption scale relative to the reference 74 px
  const poster = fontFamily(o.fonts.poster);
  const accent = fontFamily(o.fonts.accent);
  const ui = fontFamily(o.fonts.ui);
  const dev = fontFamily(o.fonts.devanagari);
  const capFont = fontFamily(o.fonts.caption);
  const accentStyle = ITALIC_FACES.has(accent) ? "italic" : "italic";
  const posterWeight = poster === "Montserrat" || poster === "Poppins" ? "800" : "400";
  const posterTracking = poster === "Bebas Neue" ? ".03em" : poster === "Anton" ? ".01em" : "0";
  const capAccent = `var(--${o.captionAccent})`;
  const capWeight =
    capFont === "Inter" || capFont === "Montserrat" || capFont === "Poppins" ? "800" : "400";
  const capUpper =
    o.captionStyle === "karaoke" || o.captionStyle === "box" ? "text-transform:uppercase;" : "";

  return `
.rk{--mar:${p.mar};--ter:${p.ter};--gold:${p.gold};--goldd:${p.goldd};--iv:${p.iv};--stage:${p.stage};--ink:${p.ink};
  position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;background:var(--stage);
  transform-origin:0 0;font-family:"${ui}",Inter,sans-serif;color:var(--iv);line-height:normal}
.rk *{box-sizing:content-box}
.rk .L{position:absolute;inset:0}
.rk .rk-pattern{background-image:radial-gradient(circle,rgba(230,180,80,.16) 2.5px,transparent 3.5px),
  radial-gradient(circle,rgba(230,180,80,.08) 1.5px,transparent 2.5px);
  background-size:60px 60px,60px 60px;background-position:0 0,30px 30px}
.rk .rk-pattern.none{background-image:none}
.rk .rk-vw{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:50% 50%;overflow:hidden;background:#000}
.rk .rk-vid{width:1080px;height:1920px;display:block;object-fit:cover}
.rk .it{position:absolute;left:0;width:1080px;text-align:center}
.rk .ln{display:block;line-height:1.04}
.rk .w{display:inline-block;overflow:hidden;padding:.14em .04em .1em;margin:-.14em 0 -.1em;vertical-align:bottom}
.rk .wi{display:inline-block}
.rk .an{font-family:"${poster}";font-weight:${posterWeight};text-transform:uppercase;letter-spacing:${posterTracking}}
.rk .se{font-family:"${accent}";font-style:${accentStyle}}
.rk .in{font-family:"${ui}";font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.rk .dv{font-family:"${dev}";font-weight:400}
.rk .card{position:absolute;background:var(--iv);padding:14px 14px 74px;box-shadow:0 30px 70px rgba(30,0,5,.45);border-radius:6px}
.rk .card img,.rk .card svg{display:block;width:100%;height:100%;object-fit:cover}
.rk .card .lb{position:absolute;left:0;right:0;bottom:14px;font:${posterWeight} 42px/1 "${poster}";color:var(--mar);text-align:center;text-transform:uppercase;letter-spacing:.02em}
.rk .bleed{position:absolute;inset:0;overflow:hidden}
.rk .bleed .k{position:absolute;inset:0}
.rk .bleed .k>img{width:100%;height:100%;object-fit:cover;display:block}
.rk .shade{position:absolute;left:0;right:0;top:0;height:760px;background:linear-gradient(rgba(25,3,7,.82),rgba(25,3,7,0))}
.rk .lbl{text-shadow:0 6px 30px rgba(0,0,0,.55)}
.rk .rk-cap{position:absolute;z-index:3;left:0;width:1080px;text-align:center;white-space:nowrap}
.rk .rk-capi{display:inline-block;font:${capWeight} ${cs}px/1.1 "${capFont}";color:#fff6e2;-webkit-text-stroke:${14 * k}px #2a060c;paint-order:stroke fill;
  letter-spacing:-.01em;transform-origin:50% 60%;${capUpper}}
.rk .rk-capi.g{font:${accentStyle} ${Math.round(108 * k)}px/1 "${accent}";color:var(--gold);-webkit-text-stroke:${12 * k}px #2a060c;letter-spacing:0}
.rk .rk-capi.r{font:${posterWeight} ${Math.round(96 * k)}px/1 "${poster}";color:#ff8a66;-webkit-text-stroke:${12 * k}px #2a060c;text-transform:uppercase;letter-spacing:.01em}
.rk .rk-capi.hi{font-family:Mukta}
.rk .rk-capi.g.hi,.rk .rk-capi.r.hi{font-family:Mukta;font-style:normal}
/* karaoke / box: the whole group is set, the spoken word is lit or boxed */
.rk .rk-capi.grp{-webkit-text-stroke:${10 * k}px #15090b;letter-spacing:0;white-space:nowrap}
.rk .rk-capi.grp .cw{display:inline-block;margin:0 .14em;opacity:.92}
.rk .rk-capi.grp .cw.on{color:${capAccent};opacity:1;transform:scale(1.08)}
.rk .rk-capi.grp.box .cw.on{color:#fff6e2;background:${capAccent};border-radius:.22em;padding:.04em .22em;-webkit-text-stroke:0;transform:none}
.rk .rk-capi.clean{font:600 ${Math.round(cs * 0.82)}px/1.25 "${capFont}";text-transform:none;white-space:normal;max-width:900px;
  -webkit-text-stroke:0;text-shadow:0 2px 4px rgba(0,0,0,.4),0 0 24px rgba(0,0,0,.25);letter-spacing:0}
.rk .lock{position:absolute;left:140px;width:800px;top:250px;height:300px;border:4px dashed var(--goldd);border-radius:28px;
  background:rgba(246,236,216,.9);text-align:center;box-shadow:0 20px 60px rgba(60,0,10,.25)}
.rk .lock .t{font:800 30px "${ui}";letter-spacing:.3em;color:var(--mar);margin-top:30px}
.rk .lock .b{font:${posterWeight} 150px/1.1 "${poster}";color:var(--ter);filter:blur(22px);letter-spacing:.06em}
.rk .lock.open .b{filter:none}
.rk .lock .s{font:800 24px "${ui}";letter-spacing:.3em;color:var(--goldd)}
.rk .lock.dark{border-color:var(--gold)}
.rk .lock.dark .t,.rk .lock.dark .s{color:var(--gold)}
.rk .lock.dark .b{color:var(--iv)}
.rk .phone{position:absolute;left:640px;top:170px;width:390px;height:700px;border-radius:46px;background:#0d0d0f;
  border:10px solid #1c1c20;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.4)}
.rk .post{width:370px;margin:0 auto 18px}
.rk .post .h{height:44px;display:flex;align-items:center;gap:10px;color:#eee;font:700 20px "${ui}";padding-left:10px}
.rk .post .h i{width:28px;height:28px;border-radius:50%;background:linear-gradient(45deg,var(--ter),var(--gold));display:inline-block}
.rk .post img{width:370px;height:370px;object-fit:cover;display:block}
.rk .post .f{color:#ddd;font:600 20px "${ui}";padding:8px 10px}
.rk .stamp{position:absolute;left:70px;top:560px;padding:10px 34px;border:8px solid var(--ter);color:var(--ter);
  font:${posterWeight} 110px/1 "${poster}";text-transform:uppercase;border-radius:16px;background:rgba(246,236,216,.85)}
.rk canvas.fx{position:absolute;z-index:4;inset:0;pointer-events:none}
`;
}
