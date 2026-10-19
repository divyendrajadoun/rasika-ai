/**
 * Engine stylesheet — ported from reference/mikku/assets/template.html, scoped under `.rk`
 * and parametrised by the plan's palette, fonts and caption style.
 *
 * Fonts: every preset picks families from the bundled OFL set below (packages/engine/fonts).
 * The family name in `style.fonts` is the real font name; `FONTS` maps it to its file.
 */
import { motionOf, type Motion, type Palette, type StyleTokens } from "@rasika/schema";

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
  Kalam: { file: "Kalam-Bold.ttf", weight: "700" },
  "Permanent Marker": { file: "PermanentMarker-Regular.ttf" },
  "JetBrains Mono": { file: "JetBrainsMono.ttf", weight: "100 800" },
  "Space Grotesk": { file: "SpaceGrotesk.ttf", weight: "300 700" },
  Oswald: { file: "Oswald.ttf", weight: "200 700" },
  // upright Playfair (the italic face above keeps the historic key)
  "Playfair Display Roman": { file: "PlayfairDisplay.ttf", weight: "400 900" },
  Jost: { file: "Jost.ttf", weight: "100 900" },
  "Press Start 2P": { file: "PressStart2P-Regular.ttf" },
  Fraunces: { file: "Fraunces.ttf", weight: "100 900" },
  "IBM Plex Sans": { file: "IBMPlexSans.ttf", weight: "100 700" },
  "IBM Plex Mono": { file: "IBMPlexMono-Medium.ttf", weight: "500" },
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
  motion?: Motion;
}

/** Display weight per poster family (static faces fall back to 400). */
const POSTER_WEIGHT: Record<string, string> = {
  Montserrat: "800",
  Poppins: "800",
  Inter: "800",
  Kalam: "700",
  "JetBrains Mono": "700",
  Caveat: "700",
  "Space Grotesk": "700",
  Oswald: "700",
  "Playfair Display Roman": "900",
  Jost: "700",
  Fraunces: "900",
  "IBM Plex Sans": "700",
  "IBM Plex Mono": "500",
};

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
  const posterWeight = POSTER_WEIGHT[poster] ?? "400";
  const m = o.motion ?? motionOf({});
  // mixed-case families: the hand, the board and the recap never shout in caps
  const upper =
    m.caseStyle === "sentence"
      ? "none"
      : m.caseStyle === "upper"
        ? "uppercase"
        : ["kinetic", "launch", "whiteboard", "chalk", "blocks"].includes(m.family)
          ? "none"
          : "uppercase";
  const posterTracking = poster === "Bebas Neue" ? ".03em" : poster === "Anton" ? ".01em" : "0";
  const capAccent = `var(--${o.captionAccent})`;
  const capWeight =
    capFont === "Inter" ||
    capFont === "Montserrat" ||
    capFont === "Poppins" ||
    capFont === "Space Grotesk" ||
    capFont === "Oswald" ||
    capFont === "Jost" ||
    capFont === "IBM Plex Sans"
      ? "800"
      : capFont === "Kalam" || capFont === "JetBrains Mono"
        ? "700"
        : "400";
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
.rk .an{font-family:"${poster}";font-weight:${posterWeight};text-transform:${upper};letter-spacing:${upper === "none" ? "-.015em" : posterTracking}}
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
${familyCss(m, { poster, accent, ui, posterWeight })}
`;
}

/** Per-family looks for the shared primitives (cards, locks, stamps) and the stage textures. */
export function familyCss(
  m: Motion,
  f: { poster: string; accent: string; ui: string; posterWeight: string },
): string {
  const tex = `
.rk .rk-pattern.none.tex-paper{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.055) 0 1px,transparent 1px 52px),linear-gradient(135deg,rgba(255,255,255,.28),rgba(0,0,0,.07));background-size:auto,auto;background-position:0 0,0 0}
.rk .rk-pattern.none.tex-board{background-image:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.09),rgba(0,0,0,.42) 95%),radial-gradient(circle,rgba(255,255,255,.06) 1px,transparent 2px);background-size:auto,37px 37px;background-position:0 0,0 0}
.rk .rk-pattern.none.tex-grid{background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:80px 80px,80px 80px;background-position:0 0,0 0}
.rk .rk-pattern.none.tex-dots{background-image:radial-gradient(circle,rgba(255,255,255,.16) 3px,transparent 4px);background-size:48px 48px;background-position:0 0}
.rk .rk-pattern.none.tex-vignette{background-image:radial-gradient(ellipse at 50% 42%,rgba(255,255,255,.04) 0,transparent 45%,rgba(0,0,0,.6) 100%);background-size:auto;background-position:0 0}
.rk .rk-pattern.none.tex-gradient{background-image:linear-gradient(160deg,var(--mar) 0%,var(--stage) 55%,var(--ink) 100%);background-size:auto;background-position:0 0}
.rk .rk-pattern.none.tex-halftone{background-image:radial-gradient(circle,rgba(0,0,0,.22) 0 2.2px,transparent 3px),radial-gradient(circle,rgba(255,255,255,.07) 0 1px,transparent 2px);background-size:11px 11px,29px 29px;background-position:0 0,5px 7px;transform:rotate(0deg)}
.rk .rk-pattern.none.tex-scan{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 5px),radial-gradient(ellipse at 50% 45%,rgba(255,255,255,.07),rgba(0,0,0,.5) 100%);background-size:auto,auto;background-position:0 0,0 0}
.rk .rk-pattern.none.tex-lines{background-image:repeating-linear-gradient(0deg,transparent 0 58px,rgba(0,0,0,.14) 58px 60px),linear-gradient(90deg,transparent 0 120px,rgba(200,40,40,.25) 120px 123px,transparent 123px)}
.rk .rk-pattern.none.tex-grain{background-image:radial-gradient(circle,rgba(255,255,255,.12) 0 1px,transparent 1.6px),radial-gradient(circle,rgba(0,0,0,.18) 0 1px,transparent 1.6px),radial-gradient(ellipse at 50% 40%,transparent 40%,rgba(0,0,0,.55) 100%);background-size:7px 7px,5px 5px,auto;background-position:0 0,3px 2px,0 0}
.rk .ch.cur::after{content:"";display:inline-block;width:.55em;height:1em;margin-left:.06em;vertical-align:-.12em;background:currentColor;opacity:.9}
.rk.light .rk-pattern.none.tex-grid{background-image:linear-gradient(rgba(0,0,0,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.09) 1px,transparent 1px)}
.rk.light .rk-pattern.none.tex-dots{background-image:radial-gradient(circle,rgba(0,0,0,.14) 3px,transparent 4px)}
.rk.light .rk-pattern.none.tex-scan{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.07) 0 2px,transparent 2px 5px)}
.rk.light .rk-pattern.none.tex-vignette{background-image:radial-gradient(ellipse at 50% 42%,transparent 0,transparent 50%,rgba(0,0,0,.18) 100%)}
.rk.light .rk-pattern.none.tex-grain{background-image:radial-gradient(circle,rgba(0,0,0,.10) 0 1px,transparent 1.6px),radial-gradient(circle,rgba(255,255,255,.5) 0 1px,transparent 1.6px),radial-gradient(ellipse at 50% 40%,transparent 50%,rgba(0,0,0,.14) 100%)}
.rk.light.faceless .rk-capi,.rk.light.faceless .rk-capi.grp{color:var(--ink);-webkit-text-stroke:0;text-shadow:none}
.rk.light.faceless .rk-capi.grp .cw.on{color:var(--ter)}
.rk.faceless .rk-vw{box-shadow:none}
.rk.light .rk-pattern.none.tex-board{background-image:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.5),rgba(0,0,0,.08) 95%),radial-gradient(circle,rgba(0,0,0,.05) 1px,transparent 2px)}`;
  const fam: Record<Motion["family"], string> = {
    editorial: "",
    collage: `
.rk.fam-collage .card{border-radius:0;box-shadow:0 18px 40px rgba(0,0,0,.28);padding:16px 16px 76px}
.rk.fam-collage .card::before{content:"";position:absolute;left:50%;top:-16px;width:150px;height:38px;margin-left:-75px;background:var(--ter);opacity:.62;transform:rotate(-3deg)}
.rk.fam-collage .card .lb{font-family:"${f.accent}";font-style:normal;text-transform:none;font-size:44px}`,
    kinetic: `
.rk.fam-kinetic .se{font-style:normal;font-weight:500;letter-spacing:-.01em}
.rk.fam-kinetic .in{letter-spacing:.08em}
.rk.fam-kinetic .card{border-radius:26px;padding:0;background:transparent;box-shadow:0 40px 90px rgba(0,0,0,.5)}
.rk.fam-kinetic .card img,.rk.fam-kinetic .card svg{border-radius:26px}
.rk.fam-kinetic .card .lb{bottom:-60px;color:var(--iv);font-size:34px;text-transform:none;letter-spacing:0}
.rk.fam-kinetic .lock{border:1px solid rgba(255,255,255,.28);border-radius:28px;background:rgba(255,255,255,.07)}
.rk.fam-kinetic .lock .t,.rk.fam-kinetic .lock .s{color:var(--iv);opacity:.7}
.rk.fam-kinetic .stamp{border-width:4px;border-radius:999px;background:transparent;color:var(--iv);border-color:var(--iv);font-size:72px;padding:18px 48px}`,
    launch: `
.rk.fam-launch .card{border-radius:22px;padding:0;background:transparent;box-shadow:0 40px 90px rgba(0,0,0,.45)}
.rk.fam-launch .card img,.rk.fam-launch .card svg{border-radius:22px}
.rk.fam-launch .card .lb{bottom:-58px;color:var(--iv);font-size:32px;text-transform:none;letter-spacing:0;font-family:"${f.ui}";font-weight:600}
.rk.fam-launch .lock{border:1px solid var(--goldd);border-radius:24px;background:rgba(255,255,255,.06)}
.rk.fam-launch .lock .t,.rk.fam-launch .lock .s{color:var(--gold)}
.rk.fam-launch .lock .b{color:var(--iv)}
.rk.fam-launch .stamp{border-radius:999px;border-width:4px;background:var(--ter);color:var(--iv);border-color:var(--ter);font-size:64px;padding:18px 44px}`,
    whiteboard: `
.rk.fam-whiteboard .card{background:var(--iv);border:5px solid var(--ink);border-radius:3px;box-shadow:0 10px 24px rgba(0,0,0,.18);padding:12px 12px 68px}
.rk.fam-whiteboard .card::before{content:"";position:absolute;left:50%;top:-18px;width:150px;height:40px;margin-left:-75px;background:var(--ter);opacity:.55;transform:rotate(-3deg)}
.rk.fam-whiteboard .card .lb{font-family:"${f.accent}";font-style:normal;text-transform:none;font-size:42px;color:var(--ink)}
.rk.fam-whiteboard .lock{border:4px solid var(--ink);border-radius:10px;background:var(--iv)}
.rk.fam-whiteboard .lock .t,.rk.fam-whiteboard .lock .s{color:var(--ink)}
.rk.fam-whiteboard .stamp{border-radius:8px;border-width:7px;background:var(--iv);font-family:"${f.poster}";text-transform:none}
.rk.fam-whiteboard .chip{border-radius:6px!important}`,
    chalk: `
.rk.fam-chalk .an,.rk.fam-chalk .se,.rk.fam-chalk .in,.rk.fam-chalk .dv{text-shadow:0 0 10px rgba(255,255,255,.2)}
.rk.fam-chalk .card{background:transparent;border:4px solid var(--iv);box-shadow:none;border-radius:4px;padding:10px 10px 66px}
.rk.fam-chalk .card .lb{color:var(--iv);text-transform:none;font-family:"${f.accent}";font-style:normal;font-size:42px}
.rk.fam-chalk .lock{border:4px dashed var(--iv);border-radius:10px;background:rgba(255,255,255,.06)}
.rk.fam-chalk .lock .t,.rk.fam-chalk .lock .s{color:var(--iv)}
.rk.fam-chalk .lock .b{color:var(--gold)}
.rk.fam-chalk .stamp{background:transparent;border-color:var(--gold);color:var(--gold);border-radius:4px;text-transform:none;font-family:"${f.poster}"}`,
    blocks: `
.rk.fam-blocks .card{border-radius:0;padding:0;background:var(--iv);box-shadow:none;border:0}
.rk.fam-blocks .card img,.rk.fam-blocks .card svg{border-radius:0}
.rk.fam-blocks .card .lb{bottom:-66px;left:0;right:auto;background:var(--ter);color:var(--iv);padding:10px 22px;font-size:34px;text-transform:none;letter-spacing:0;font-family:"${f.ui}";font-weight:800}
.rk.fam-blocks .lock{border:0;border-radius:0;background:var(--ter)}
.rk.fam-blocks .lock .t,.rk.fam-blocks .lock .s{color:var(--iv)}
.rk.fam-blocks .lock .b{color:var(--iv)}
.rk.fam-blocks .stamp{border:0;border-radius:0;background:var(--gold);color:var(--ink);padding:14px 40px}
.rk.fam-blocks .chip{border-radius:0!important}
.rk.fam-blocks .se{font-style:normal;font-weight:700}`,
    beat: `
.rk.fam-beat .an{letter-spacing:-.02em}
.rk.fam-beat .card{border-radius:14px;padding:0;background:transparent;box-shadow:0 30px 70px rgba(0,0,0,.5)}
.rk.fam-beat .card img,.rk.fam-beat .card svg{border-radius:14px}
.rk.fam-beat .card .lb{bottom:-62px;color:var(--gold);font-size:40px}
.rk.fam-beat .stamp{border-radius:999px;border-width:6px;background:var(--gold);color:var(--ink);border-color:var(--gold)}
.rk.fam-beat .chip{border-radius:999px!important}
.rk.fam-beat .lock{border:3px solid var(--gold);border-radius:20px;background:rgba(0,0,0,.6)}
.rk.fam-beat .lock .t,.rk.fam-beat .lock .s{color:var(--gold)}
.rk.fam-beat .lock .b{color:var(--iv)}`,
    hype: `
.rk.fam-hype .card{border-radius:24px;border:8px solid var(--gold);padding:0;background:var(--gold);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.rk.fam-hype .card img,.rk.fam-hype .card svg{border-radius:16px}
.rk.fam-hype .card .lb{bottom:-74px;color:var(--gold);text-shadow:0 4px 20px rgba(0,0,0,.6);font-size:46px}
.rk.fam-hype .stamp{border-width:10px;border-radius:6px;background:var(--gold);color:var(--ink);border-color:var(--ink)}
.rk.fam-hype .lock{border:6px solid var(--gold);border-radius:18px;background:rgba(0,0,0,.72)}
.rk.fam-hype .lock .t,.rk.fam-hype .lock .s{color:var(--gold)}
.rk.fam-hype .lock .b{color:var(--iv)}
.rk.fam-hype .chip{border-radius:999px!important}`,
  };
  return tex + fam[m.family];
}

