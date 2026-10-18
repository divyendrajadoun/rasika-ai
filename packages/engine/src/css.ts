/**
 * Engine stylesheet — ported from reference/mikku/assets/template.html, scoped under `.rk`
 * and parametrised by the plan's palette and caption size. Font family names are internal
 * (Anton / Inter / Serif / Tiro / Mukta); `fontBaseUrl` points at the TTFs.
 */
import type { Palette } from "@rasika/schema";

export const FONT_FILES = {
  Anton: "Anton.ttf",
  Inter: "Inter.ttf",
  Serif: "InstrumentSerif-Italic.ttf",
  Tiro: "TiroDevanagariHindi.ttf",
  Mukta: "Mukta-ExtraBold.ttf",
} as const;

/** The `document.fonts.load` descriptors every engine instance waits for (SPEC §6.2). */
export const FONT_LOADS = [
  "400 100px Anton",
  "800 50px Inter",
  "italic 100px Serif",
  "100px Tiro",
  "80px Mukta",
] as const;

export function fontFaceCss(base: string): string {
  const u = (f: string) => `url("${base.replace(/\/$/, "")}/${f}")`;
  return `
@font-face{font-family:"Anton";src:${u(FONT_FILES.Anton)}}
@font-face{font-family:"Inter";src:${u(FONT_FILES.Inter)};font-weight:100 900}
@font-face{font-family:"Serif";src:${u(FONT_FILES.Serif)};font-style:italic}
@font-face{font-family:"Tiro";src:${u(FONT_FILES.Tiro)}}
@font-face{font-family:"Mukta";src:${u(FONT_FILES.Mukta)}}`;
}

export function engineCss(p: Palette, captionSize: number): string {
  const cs = captionSize;
  const k = cs / 74; // caption scale relative to the reference 74 px
  return `
.rk{--mar:${p.mar};--ter:${p.ter};--gold:${p.gold};--goldd:${p.goldd};--iv:${p.iv};--stage:${p.stage};--ink:${p.ink};
  position:absolute;left:0;top:0;width:1080px;height:1920px;overflow:hidden;background:var(--stage);
  transform-origin:0 0;font-family:Inter,sans-serif;color:var(--iv);line-height:normal}
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
.rk .an{font-family:Anton;text-transform:uppercase;letter-spacing:.01em}
.rk .se{font-family:Serif;font-style:italic}
.rk .in{font-family:Inter;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.rk .dv{font-family:Tiro;font-weight:400}
.rk .card{position:absolute;background:var(--iv);padding:14px 14px 74px;box-shadow:0 30px 70px rgba(30,0,5,.45);border-radius:6px}
.rk .card img,.rk .card svg{display:block;width:100%;height:100%;object-fit:cover}
.rk .card .lb{position:absolute;left:0;right:0;bottom:14px;font:400 42px/1 Anton;color:var(--mar);text-align:center;text-transform:uppercase;letter-spacing:.02em}
.rk .bleed{position:absolute;inset:0;overflow:hidden}
.rk .bleed .k{position:absolute;inset:0}
.rk .bleed .k>img{width:100%;height:100%;object-fit:cover;display:block}
.rk .shade{position:absolute;left:0;right:0;top:0;height:760px;background:linear-gradient(rgba(25,3,7,.82),rgba(25,3,7,0))}
.rk .lbl{text-shadow:0 6px 30px rgba(0,0,0,.55)}
.rk .rk-cap{position:absolute;z-index:3;left:0;width:1080px;text-align:center;white-space:nowrap}
.rk .rk-capi{display:inline-block;font:800 ${cs}px/1.1 Inter;color:#fff6e2;-webkit-text-stroke:${14 * k}px #2a060c;paint-order:stroke fill;
  letter-spacing:-.01em;transform-origin:50% 60%}
.rk .rk-capi.g{font:italic ${Math.round(108 * k)}px/1 Serif;color:var(--gold);-webkit-text-stroke:${12 * k}px #2a060c;letter-spacing:0}
.rk .rk-capi.r{font:400 ${Math.round(96 * k)}px/1 Anton;color:#ff8a66;-webkit-text-stroke:${12 * k}px #2a060c;text-transform:uppercase;letter-spacing:.01em}
.rk .rk-capi.hi{font-family:Mukta}
.rk .rk-capi.g.hi,.rk .rk-capi.r.hi{font-family:Mukta;font-style:normal}
.rk .lock{position:absolute;left:140px;width:800px;top:250px;height:300px;border:4px dashed var(--goldd);border-radius:28px;
  background:rgba(246,236,216,.9);text-align:center;box-shadow:0 20px 60px rgba(60,0,10,.25)}
.rk .lock .t{font:800 30px Inter;letter-spacing:.3em;color:var(--mar);margin-top:30px}
.rk .lock .b{font:400 150px/1.1 Anton;color:var(--ter);filter:blur(22px);letter-spacing:.06em}
.rk .lock.open .b{filter:none}
.rk .lock .s{font:800 24px Inter;letter-spacing:.3em;color:var(--goldd)}
.rk .lock.dark{border-color:var(--gold)}
.rk .lock.dark .t,.rk .lock.dark .s{color:var(--gold)}
.rk .lock.dark .b{color:var(--iv)}
.rk .phone{position:absolute;left:640px;top:170px;width:390px;height:700px;border-radius:46px;background:#0d0d0f;
  border:10px solid #1c1c20;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.4)}
.rk .post{width:370px;margin:0 auto 18px}
.rk .post .h{height:44px;display:flex;align-items:center;gap:10px;color:#eee;font:700 20px Inter;padding-left:10px}
.rk .post .h i{width:28px;height:28px;border-radius:50%;background:linear-gradient(45deg,var(--ter),var(--gold));display:inline-block}
.rk .post img{width:370px;height:370px;object-fit:cover;display:block}
.rk .post .f{color:#ddd;font:600 20px Inter;padding:8px 10px}
.rk .stamp{position:absolute;left:70px;top:560px;padding:10px 34px;border:8px solid var(--ter);color:var(--ter);
  font:400 110px/1 Anton;text-transform:uppercase;border-radius:16px;background:rgba(246,236,216,.85)}
.rk canvas.fx{position:absolute;z-index:4;inset:0;pointer-events:none}
`;
}
