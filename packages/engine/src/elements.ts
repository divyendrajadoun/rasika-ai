/**
 * Element builders — one per Plan element type (SPEC §6.3), each a faithful port of the
 * hand-written builder in reference/mikku/references/example_baisa_bling.html.
 *
 * A builder returns `Item`s: a DOM node plus its time range, animation kind and an optional
 * per-frame `fn(el, a, t, ex)` (a = seconds since t0, ex = 0→1 exit progress).
 */
import type {
  ColorToken,
  EndCard,
  PlanElement,
  TextFont,
  TextLine,
  VideoModeName,
} from "@rasika/schema";
import { DEFAULT_MOTION, type EasingKind, type ExitKind, type Motion } from "@rasika/schema";
import { div, esc, nextId, px, rgba } from "./dom";
import {
  browserCard,
  crowd,
  docCard,
  explainerWorld,
  fightHud,
  noteMachine,
  pourGlass,
  seasonWindow,
  tierBoard,
  type BriefCtx,
} from "./brief";
import { patternSvg, type Colors } from "./patterns";
import { E, lerp, prog, rng, transformStyle, type Easing, type Transform, steps } from "./toolkit";

/**
 * Split text into what a reader sees as letters (grapheme clusters). Spreading a string into code
 * points tears Devanagari apart (a consonant and its vowel sign or virama become separate boxes),
 * so per-letter entrances use the segmenter whenever the browser has one.
 */
export function graphemes(text: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg(undefined, { granularity: "grapheme" }).segment(text), (x) => x.segment);
  return [...text];
}

export type ItemKind =
  "rise" | "pop" | "fade" | "slide" | "stamp" | "card" | "cardx" | "bleed" | "none";

export interface Item {
  el: HTMLElement;
  t0: number;
  t1: number;
  kind: ItemKind;
  /** tilt for card / cardx */
  r?: number;
  fn?: (el: HTMLElement, a: number, t: number, ex: number) => void;
  /** plan element this item belongs to (for the editor's hit-testing) */
  elementId?: string;
}

export interface BuildCtx {
  C: Colors;
  stageHex: string;
  images: Record<string, string>;
  fx: HTMLElement;
  bl: HTMLElement;
  durationSec: number;
  modeAt: (t: number) => VideoModeName;
  /** false for light-stage styles: framed modes then take the light-wall colours */
  stageDark: boolean;
  /** a film with no footage: every element takes the stage's own lightness (as validatePlan does) */
  faceless?: boolean;
}

const FONT_CLASS: Record<TextFont, string> = {
  anton: "an",
  serif: "se",
  kicker: "in",
  devanagari: "dv",
};
const POP_LINE_HEIGHT: Record<TextFont, number> = {
  anton: 1,
  serif: 1,
  kicker: 1.2,
  devanagari: 1.2,
};
const DARK = new Set<VideoModeName>(["card", "pip", "arch"]);

export function applyTransform(el: HTMLElement, tr: Transform): void {
  const s = transformStyle(tr);
  el.style.transform = s.transform;
  el.style.opacity = s.opacity;
  el.style.filter = s.filter;
  el.style.visibility = s.visibility;
}
const set = applyTransform;

/** Text colour auto-flip by context (SPEC §6.3): light wall → mar/ter/goldd; dark → iv/gold. */
export function autoColor(font: TextFont, emphasis: boolean, dark: boolean, C: Colors): string {
  if (dark) return font === "anton" && !emphasis ? C.iv : C.gold;
  if (font === "serif") return C.goldd;
  return emphasis ? C.ter : C.mar;
}

function imgTag(src: string, pos = "50% 50%", extra = ""): string {
  return `<img src="${esc(src)}" style="object-position:${esc(pos)};${extra}" alt="">`;
}

export function buildElements(elements: readonly PlanElement[], ctx: BuildCtx): Item[] {
  const items: Item[] = [];
  for (const el of elements) {
    for (const it of buildElement(el, ctx)) {
      it.elementId = el.id;
      items.push(it);
    }
  }
  return items;
}

// ───────── primitive builders (T / X / card / bleed in the reference) ─────────

interface TOpt {
  left?: number;
  w?: number;
  align?: string;
  parent?: HTMLElement;
}

/** Rising poster lines. `lines` = [text, cls, size, colour, extraCss]. */
function T(
  ctx: BuildCtx,
  t0: number,
  t1: number,
  top: number,
  lines: Array<[string, string, number, string, string?]>,
  opt: TOpt = {},
): Item {
  const el = div("it", { top: px(top) });
  if (opt.left != null) {
    el.style.left = px(opt.left);
    el.style.width = px(opt.w ?? 600);
    el.style.textAlign = opt.align ?? "left";
  }
  el.innerHTML = lines
    .map(
      ([tx, c, sz, col, extra]) =>
        `<div class="ln ${c}" style="font-size:${sz}px;color:${col};${extra ?? ""}">` +
        tx
          .split(" ")
          .map((w) => `<span class="w"><span class="wi">${esc(w)}</span></span>`)
          .join(" ") +
        `</div>`,
    )
    .join("");
  (opt.parent ?? ctx.fx).appendChild(el);
  return { el, t0, t1, kind: "rise" };
}

/** Custom full-stage element with an animation kind. */
function X(
  ctx: BuildCtx,
  t0: number,
  t1: number,
  html: string,
  kind: ItemKind,
  opt: { fn?: Item["fn"]; r?: number; parent?: HTMLElement } = {},
): Item {
  const el = div("", {
    position: "absolute",
    left: "0",
    top: "0",
    width: px(1080),
    height: px(1920),
  });
  el.innerHTML = html;
  (opt.parent ?? ctx.fx).appendChild(el);
  return { el, t0, t1, kind, r: opt.r, fn: opt.fn };
}

function card(
  ctx: BuildCtx,
  t0: number,
  t1: number,
  src: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  pos = "50% 50%",
): Item {
  const el = div("card", { left: px(x), top: px(y), width: px(w), height: px(h) });
  el.innerHTML = imgTag(src, pos) + (label ? `<div class="lb">${esc(label)}</div>` : "");
  ctx.fx.appendChild(el);
  return { el, t0, t1, kind: "card", r };
}

function bleed(ctx: BuildCtx, t0: number, t1: number, inner: string, fn?: Item["fn"]): Item {
  const el = div("bleed");
  el.innerHTML = `<div class="k">${inner}</div>`;
  ctx.bl.appendChild(el);
  return { el, t0, t1, kind: "bleed", fn };
}

function lbl(C: Colors, top: number, a: string, b: string): string {
  return `<div class="lbl" style="position:absolute;left:0;width:1080px;top:${top}px;text-align:center">
  <div class="in" style="font-size:28px;color:${C.gold}">${esc(a)}</div>
  <div class="an" style="font-size:118px;line-height:1.05;color:${C.iv}">${esc(b)}</div></div>`;
}

function lineColor(line: TextLine, i: number, dark: boolean, C: Colors): string {
  if (line.color) return C[line.color];
  // 2nd anton line is the emphasis line in the house style
  return autoColor(line.font, i === 1 && line.font === "anton", dark, C);
}

function lineExtra(line: TextLine): string {
  let s = "";
  if (line.tracking != null) s += `letter-spacing:${line.tracking}em;`;
  if (line.lineHeight != null) s += `line-height:${line.lineHeight};`;
  return s;
}

// ───────── element → items ─────────

export function buildElement(el: PlanElement, ctx: BuildCtx): Item[] {
  if (el.type === "broll") return [];
  const { C } = ctx;
  const dark = ctx.faceless ? ctx.stageDark : DARK.has(ctx.modeAt(el.t0 + 0.05)) && ctx.stageDark;
  const tok = (c: ColorToken | undefined, fallback: string) => (c ? C[c] : fallback);

  switch (el.type) {
    case "posterText": {
      if (el.anim === "rise") {
        return [
          T(
            ctx,
            el.t0,
            el.t1,
            el.top,
            el.lines.map((l, i) => [
              l.text,
              FONT_CLASS[l.font],
              l.size,
              lineColor(l, i, dark, C),
              lineExtra(l),
            ]),
            { left: el.left, w: el.w, align: el.align },
          ),
        ];
      }
      const pos =
        el.left != null
          ? `left:${el.left}px;width:${el.w ?? 600}px;text-align:${el.align ?? "left"};`
          : "";
      const html =
        `<div class="it" style="top:${el.top}px;${pos}">` +
        el.lines
          .map(
            (l, i) =>
              `<div class="${FONT_CLASS[l.font]}" style="font-size:${l.size}px;color:${lineColor(l, i, dark, C)};line-height:${l.lineHeight ?? POP_LINE_HEIGHT[l.font]};${l.tracking != null ? `letter-spacing:${l.tracking}em;` : ""}">${esc(l.text)}</div>`,
          )
          .join("") +
        `</div>`;
      return [X(ctx, el.t0, el.t1, html, "pop")];
    }

    case "counter": {
      const col = tok(el.color, dark ? C.gold : C.ter);
      const lab = dark ? C.iv : C.mar;
      const { from, to, duration } = el;
      const fmt = (n: number) => String(Math.round(n));
      return [
        X(
          ctx,
          el.t0,
          el.t1,
          `<div class="it" style="top:${el.top}px"><div class="an cnt" style="font-size:${el.size}px;color:${col};line-height:1">${fmt(from)}</div>
  <div class="in" style="font-size:44px;color:${lab}">${esc(el.label)}</div></div>`,
          "pop",
          {
            fn: (node, a) => {
              const c = node.querySelector<HTMLElement>(".cnt");
              if (c) c.textContent = fmt(lerp(from, to, prog(a, 0, duration, E.outQuint)));
            },
          },
        ),
      ];
    }

    case "lockCard": {
      const cls = `lock${el.blurred ? "" : " open"}${el.dark ? " dark" : ""}`;
      const bg = el.dark ? `style="background:${rgba(ctx.stageHex, 0.6)}"` : "";
      return [
        X(
          ctx,
          el.t0,
          el.t1,
          `<div class="${cls}" ${bg}><div class="t">${esc(el.kicker)}</div><div class="b">${esc(el.word)}</div><div class="s">${esc(el.sub)}</div></div>`,
          "pop",
        ),
      ];
    }

    case "propPunchIn": {
      const { cx, cy, rx, ry } = el.ring;
      // Ramanujan perimeter, padded like the reference's hand-tuned dash length
      const per = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
      const dash = Math.ceil(per * 1.05);
      return [
        X(
          ctx,
          el.t0,
          el.t1,
          `<svg width="1080" height="1920" style="position:absolute;left:0;top:0"><ellipse class="ring" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"
  fill="none" stroke="${C.gold}" stroke-width="10" stroke-dasharray="${dash}" stroke-dashoffset="${dash}"/></svg>
  <div class="it" style="top:${el.labelTop}px"><div class="an" style="font-size:110px;color:${C.iv};text-shadow:0 6px 30px rgba(0,0,0,.6)">${esc(el.label)}</div></div>`,
          "fade",
          {
            fn: (node, a) => {
              const ring = node.querySelector<SVGElement>(".ring");
              if (ring)
                ring.style.strokeDashoffset = String(dash * (1 - prog(a, 0.35, 1.1, E.outCubic)));
            },
          },
        ),
      ];
    }

    case "feedPhone": {
      const src = ctx.images[el.imageId] ?? "";
      const days =
        el.postDays ??
        Array.from({ length: el.posts }, (_, i) =>
          i >= el.posts - 2
            ? el.dayTo
            : Math.round(el.dayFrom + ((el.dayTo - el.dayFrom) * i) / Math.max(1, el.posts - 3)),
        );
      const posts = days
        .map(
          (d) =>
            `<div class="post"><div class="h"><i></i>${esc(el.handle)}</div>${imgTag(src)}<div class="f">♥ ${esc(el.dayLabel)} ${d} · ${esc(el.postCaption)}</div></div>`,
        )
        .join("");
      const scroll = Math.max(0, days.length * 472 - 1020);
      const { dayFrom, dayTo, dayLabel } = el;
      return [
        X(ctx, el.t0, el.t1, `<div class="phone"><div class="col">${posts}</div></div>`, "slide", {
          fn: (node, a) => {
            const col = node.querySelector<HTMLElement>(".col");
            if (col)
              col.style.transform = `translateY(${-lerp(0, scroll, prog(a, 0.1, 2.2, E.inOutCubic))}px)`;
          },
        }),
        X(
          ctx,
          el.t0,
          el.t1,
          `<div class="it" style="top:230px;left:50px;width:600px;text-align:left">
  <div class="an" style="font-size:84px;color:${C.mar};line-height:1">${esc(el.title)}</div>
  <div class="an day" style="font-size:150px;color:${C.ter};line-height:1.1">${esc(dayLabel)} ${dayFrom}</div></div>`,
          "pop",
          {
            fn: (node, a) => {
              const d = node.querySelector<HTMLElement>(".day");
              if (d)
                d.textContent = `${dayLabel} ${dayFrom + Math.floor((dayTo - dayFrom) * prog(a, 0.25, 1.9))}`;
            },
          },
        ),
      ];
    }

    case "stamp":
      return [X(ctx, el.t0, el.t1, `<div class="stamp">${esc(el.text)}</div>`, "stamp")];

    case "chapterCard":
      return [
        T(ctx, el.t0, el.t1, 150, [
          [el.number, "an", 210, dark ? C.gold : C.ter],
          [el.line, "an", 84, dark ? C.iv : C.mar],
          [el.italicLine, "se", 90, dark ? C.gold : C.goldd],
        ]),
      ];

    case "imageCard":
      return [
        card(
          ctx,
          el.t0,
          el.t1,
          ctx.images[el.imageId] ?? "",
          el.label,
          el.x,
          el.y,
          el.w,
          el.h,
          el.tilt,
          el.objectPosition,
        ),
      ];

    case "splitCards":
      return el.cards.map((c, i) =>
        card(
          ctx,
          el.t0 + i * el.stagger,
          el.t1,
          ctx.images[c.imageId] ?? "",
          c.label,
          c.x,
          c.y,
          c.w,
          c.h,
          c.tilt,
          c.objectPosition,
        ),
      );

    case "bleedPlate": {
      const face = el.imageId
        ? imgTag(ctx.images[el.imageId] ?? "", el.objectPosition)
        : patternSvg(el.patternId!, 1080, 1920, C);
      return [
        bleed(
          ctx,
          el.t0,
          el.t1,
          face + `<div class="shade"></div>` + lbl(C, el.labelTop, el.kicker, el.title),
        ),
      ];
    }

    case "filmStrip": {
      const n = el.imageIds.length;
      const stripW = Math.max(1300, 40 + n * 600);
      const holes = Array.from(
        { length: Math.ceil(stripW / 90) },
        (_, i) =>
          `<rect x="${i * 90 + 20}" y="14" width="44" height="30" rx="6" fill="${C.iv}"/><rect x="${i * 90 + 20}" y="676" width="44" height="30" rx="6" fill="${C.iv}"/>`,
      ).join("");
      const imgs = el.imageIds
        .map(
          (id, i) =>
            `<img src="${esc(ctx.images[id] ?? "")}" alt="" style="position:absolute;left:${40 + i * 600}px;top:62px;width:560px;height:596px;object-fit:cover;object-position:${esc(el.objectPositions?.[i] ?? "50% 50%")};filter:sepia(.25)">`,
        )
        .join("");
      const ring = el.focusRing;
      const dash = ring ? Math.ceil(2 * Math.PI * ring.r + 8) : 0;
      const ringSvg = ring
        ? `<svg class="ring2" width="1080" height="1920" style="position:absolute;left:0;top:0"><circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" stroke="${C.gold}" stroke-width="10" stroke-dasharray="${dash}" stroke-dashoffset="${dash}"/></svg>`
        : "";
      const life = el.t1 - el.t0;
      const travel = el.travel;
      return [
        bleed(
          ctx,
          el.t0,
          el.t1,
          `<div style="position:absolute;inset:0;background:#141010"></div>
  <div class="strip" style="position:absolute;left:0;top:520px;width:${stripW}px;height:720px;background:#050404">
  <svg width="${stripW}" height="720" style="position:absolute;left:0;top:0">${holes}</svg>${imgs}</div>${ringSvg}` +
            lbl(C, 210, el.kicker, el.title),
          (node, a) => {
            const strip = node.querySelector<HTMLElement>(".strip");
            if (strip)
              strip.style.transform = `translateX(${-lerp(0, travel, prog(a, 0, life))}px)`;
            if (ring) {
              const c = node.querySelector<SVGElement>(".ring2 circle");
              if (c)
                c.style.strokeDashoffset = String(
                  dash * (1 - prog(a, ring.at, ring.at + ring.dur, E.outCubic)),
                );
            }
          },
        ),
      ];
    }

    case "patternCard":
      return [
        X(
          ctx,
          el.t0,
          el.t1,
          `<div class="card" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;padding:14px 14px 74px">${patternSvg(el.pattern, el.w, el.h, C)}<div class="lb">${esc(el.label)}</div></div>`,
          "cardx",
          { r: el.tilt },
        ),
      ];

    case "equation":
      return [
        T(ctx, el.t0, el.t1, el.top, [
          [el.left, "an", el.leftSize, tok(el.leftColor, dark ? C.iv : C.mar)],
          [`= ${el.right}`, "se", el.rightSize, tok(el.rightColor, dark ? C.gold : C.ter)],
        ]),
      ];

    case "reveal": {
      const b = el.burst;
      const html =
        `<div class="it" style="top:${el.top}px"><div class="an big" style="font-size:250px;color:${dark ? C.gold : C.ter};line-height:1">${esc(el.word)}</div>` +
        (el.devanagari
          ? `<div class="dv" style="font-size:120px;line-height:1.3;color:${dark ? C.iv : C.mar}">${esc(el.devanagari)}</div>`
          : "") +
        (el.definition
          ? `<div class="se" style="font-size:64px;line-height:1.2;color:${dark ? C.iv : C.mar}">${esc(el.definition)}</div>`
          : "") +
        `</div><canvas class="burst" width="1080" height="1920" style="position:absolute;left:0;top:0"></canvas>`;
      return [
        X(ctx, el.t0, el.t1, html, "pop", {
          fn: (node, a) => {
            const cv = node.querySelector<HTMLCanvasElement>(".burst");
            const g = cv?.getContext("2d");
            if (!cv || !g) return;
            g.clearRect(0, 0, 1080, 1920);
            const r = rng(b.seed);
            const p = prog(a, 0, 1.4, E.outCubic);
            for (let i = 0; i < b.count; i++) {
              const an = r() * Math.PI * 2;
              const sp = 250 + r() * 520;
              const sz = 3 + r() * 7;
              const x = b.cx + Math.cos(an) * sp * p;
              const y = b.cy + Math.sin(an) * sp * p * 0.75;
              g.globalAlpha = (1 - p) * 0.95;
              g.fillStyle = i % 3 ? C.gold : C.iv;
              g.beginPath();
              g.arc(x, y, sz, 0, 7);
              g.fill();
            }
          },
        }),
      ];
    }

    case "strikeLine": {
      const { strikeAt, strikeDur, strikeWidth } = el;
      return [
        X(
          ctx,
          el.t0,
          el.t1,
          `<div class="it" style="top:${el.top}px"><div class="an" style="font-size:${el.size}px;color:${tok(el.color, dark ? C.iv : C.mar)};display:inline-block;position:relative">
  ${esc(el.text)}<span class="strike" style="position:absolute;left:-10px;top:52%;height:10px;background:${C.ter};width:0"></span></div></div>`,
          "pop",
          {
            fn: (node, a) => {
              const s = node.querySelector<HTMLElement>(".strike");
              if (s)
                s.style.width = `${prog(a, strikeAt, strikeAt + strikeDur, E.outCubic) * strikeWidth}px`;
            },
          },
        ),
      ];
    }

    case "chips": {
      const html =
        `<div style="position:absolute;left:${el.x}px;top:${el.y}px">` +
        el.items
          .map(
            (c, i) =>
              `<div class="an chip" style="display:inline-block;${i ? "margin-top:18px;" : ""}font-size:${el.size}px;color:${C[c.color]};background:${C[c.bg]};padding:6px 26px;border-radius:14px">${esc(c.text)}</div>`,
          )
          .join("<br>") +
        `</div>`;
      const ats = el.items.map((c) => c.at);
      return [
        X(ctx, el.t0, el.t1, html, "fade", {
          fn: (node, a) => {
            node.querySelectorAll<HTMLElement>(".chip").forEach((chip, i) => {
              const at = ats[i] ?? 0;
              set(chip, {
                s: 0.4 + 0.6 * prog(a, at, at + 0.4, E.outBack),
                o: prog(a, at, at + 0.15),
              });
            });
          },
        }),
      ];
    }

    // brief-driven films (no speaker): see brief.ts
    case "browserCard":
      return browserCard(el, briefCtx(ctx, dark));
    case "pourGlass":
      return pourGlass(el, briefCtx(ctx, dark));
    case "fightHud":
      return fightHud(el, briefCtx(ctx, dark));
    case "seasonWindow":
      return seasonWindow(el, briefCtx(ctx, dark));
    case "noteMachine":
      return noteMachine(el, briefCtx(ctx, dark));
    case "tierBoard":
      return tierBoard(el, briefCtx(ctx, dark));
    case "explainerWorld":
      return explainerWorld(el, briefCtx(ctx, dark));
    case "crowd":
      return crowd(el, briefCtx(ctx, dark));
    case "docCard":
      return docCard(el, briefCtx(ctx, dark));
  }
}

/** The light/dark decision for a brief element: the stage's own lightness (these films are faceless). */
function briefCtx(ctx: BuildCtx, dark: boolean): BriefCtx {
  const n = parseInt(ctx.stageHex.slice(1), 16);
  const luma = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return { C: ctx.C, stageHex: ctx.stageHex, images: ctx.images, fx: ctx.fx, dark: dark || luma < 0.45 };
}

/** The end card: maroon plate with a faint blurred photo, brand in spaced caps, closing lines. */
export function buildEndCard(ec: EndCard, t0: number, ctx: BuildCtx): Item[] {
  const { C } = ctx;
  const t1 = ctx.durationSec + 0.2;
  const photo = ec.bgImageId
    ? imgTag(ctx.images[ec.bgImageId] ?? "", "50% 50%", "opacity:.28;filter:blur(3px) sepia(.4)")
    : "";
  const lines: Array<[string, string, number, string, string?]> = [
    [ec.brand, "in", 34, C.gold, "letter-spacing:.42em"],
    [ec.line1, "se", 86, C.iv],
  ];
  if (ec.line2) lines.push([ec.line2, "se", 86, C.gold]);
  if (ec.handle) lines.push([ec.handle, "in", 28, C.iv, "letter-spacing:.3em;margin-top:30px"]);
  return [
    bleed(ctx, t0, t1, `<div style="position:absolute;inset:0;background:${C.mar}"></div>${photo}`),
    T(ctx, t0 + 0.05, t1, 150, lines),
  ];
}

const EASE: Record<EasingKind, Easing> = {
  spring: E.outBack,
  snap: E.outExpo,
  smooth: E.outCubic,
  soft: E.outQuint,
  steps: steps(4),
};

/**
 * Entrance of a typography item under the style's motion. `perWord` items (the rising poster
 * lines) keep the house word-by-word rise when the style says `rise`; block items under `rise`
 * keep the house pop — that pairing *is* the editorial look.
 */
function typoEnter(el: HTMLElement, a: number, m: Motion, perWord: boolean): Transform {
  const sp = m.speed;
  const ease = EASE[m.easing];
  const words = el.querySelectorAll<HTMLElement>(".wi");
  el.style.clipPath = "";
  if (m.enter === "rise" && perWord) {
    words.forEach((w, i) => {
      const p = prog(
        a,
        i * 0.055 * sp,
        i * 0.055 * sp + 0.5 * sp,
        m.easing === "spring" ? E.outExpo : ease,
      );
      w.style.transform = `translateY(${(1 - p) * 125}%)`;
    });
    return {};
  }
  if (m.enter === "letters" && perWord) {
    // per-letter stagger: split each word once, then pop the letters in on the beat
    for (const w of words) {
      if (!w.dataset["split"]) {
        w.innerHTML = graphemes(w.textContent ?? "")
          .map((ch) => `<span class="ch" style="display:inline-block">${esc(ch)}</span>`)
          .join("");
        w.dataset["split"] = "1";
      }
      w.style.transform = "";
    }
    let i = 0;
    el.querySelectorAll<HTMLElement>(".ch").forEach((ch) => {
      const p = prog(a, i * 0.028 * sp, i * 0.028 * sp + 0.32 * sp, ease);
      ch.style.transform = `translateY(${(1 - p) * 60}%) scale(${0.6 + 0.4 * p})`;
      ch.style.opacity = String(prog(a, i * 0.028 * sp, i * 0.028 * sp + 0.08 * sp));
      i++;
    });
    return {};
  }
  if (m.enter === "type" && perWord) {
    // typewriter: letters appear left to right, 2 frames each, a block cursor rides the end
    for (const w of words) {
      if (!w.dataset["split"]) {
        w.innerHTML = graphemes(w.textContent ?? "")
          .map((ch) => `<span class="ch" style="display:inline-block">${esc(ch)}</span>`)
          .join("");
        w.dataset["split"] = "1";
      }
      w.style.transform = "";
    }
    const chars = el.querySelectorAll<HTMLElement>(".ch");
    const per = 0.07 * sp;
    let cursorAt: HTMLElement | null = null;
    chars.forEach((ch, i) => {
      const on = a >= i * per;
      ch.style.opacity = on ? "1" : "0";
      ch.classList.remove("cur");
      if (on) cursorAt = ch;
    });
    if (cursorAt && a < chars.length * per + 0.4) (cursorAt as HTMLElement).classList.add("cur");
    return {};
  }
  if (m.enter === "mask" && perWord) {
    // the whole line rises under its mask at once — no per-word stagger
    words.forEach((w) => {
      const p = prog(a, 0, 0.55 * sp, ease);
      w.style.transform = `translateY(${(1 - p) * 125}%)`;
    });
    return {};
  }
  words.forEach((w) => (w.style.transform = ""));
  switch (m.enter) {
    case "type":
    case "letters":
    case "mask":
    case "rise":
    case "pop": {
      const p = prog(a, 0, 0.45 * sp, ease);
      el.style.transformOrigin = "50% 25%";
      return { s: 0.6 + 0.4 * p, o: prog(a, 0, 0.12 * sp) };
    }
    case "slam": {
      // nothing grows from zero: arrive oversize and decelerate onto the mark
      const p = prog(a, 0, 0.34 * sp, m.easing === "spring" ? E.outExpo : ease);
      el.style.transformOrigin = "50% 40%";
      return { s: 3.2 - 2.2 * p, blur: (1 - p) * 10, o: prog(a, 0, 0.07 * sp) };
    }
    case "slide": {
      const p = prog(a, 0, 0.5 * sp, ease);
      return { x: (1 - p) * -160, o: prog(a, 0, 0.2 * sp) };
    }
    case "fade":
      return { o: prog(a, 0, 0.35 * sp, E.outCubic) };
    case "blur": {
      const p = prog(a, 0, 0.45 * sp, E.outCubic);
      el.style.transformOrigin = "50% 50%";
      return { s: 1.06 - 0.06 * p, blur: (1 - p) * 18, o: prog(a, 0, 0.3 * sp) };
    }
    case "draw": {
      const p = prog(a, 0, 0.6 * sp, E.inOutCubic);
      el.style.clipPath = `inset(-2% ${(1 - p) * 100}% -2% 0)`;
      return { o: 1 };
    }
  }
}

/** Apply the style's exit to a transform (ex = 0→1 exit progress). */
function withExit(
  el: HTMLElement,
  tr: Transform,
  ex: number,
  kind: ExitKind,
  liftBlur = false,
): Transform {
  if (ex <= 0) return tr;
  const o = tr.o ?? 1;
  switch (kind) {
    case "lift":
      return liftBlur
        ? { ...tr, y: (tr.y ?? 0) - ex * 50, o: o * (1 - ex), blur: Math.max(tr.blur ?? 0, ex * 8) }
        : { ...tr, y: (tr.y ?? 0) - ex * 40, o: o * (1 - ex) };
    case "dive":
      return { ...tr, y: (tr.y ?? 0) + ex * 40, s: (tr.s ?? 1) * (1 - 0.1 * ex), o: o * (1 - ex) };
    case "fade":
      return { ...tr, o: o * (1 - ex) };
    case "cut":
      return { ...tr, o: ex >= 1 ? 0 : o };
    case "wipe":
      el.style.clipPath = `inset(-2% 0 -2% ${ex * 100}%)`;
      return tr;
  }
}

/** Per-frame update for one item — the reference render loop body, under the style's motion. */
export function updateItem(it: Item, t: number, m: Motion = DEFAULT_MOTION): void {
  const { el, t0, t1, kind } = it;
  if (t < t0 - 0.001 || t > t1) {
    el.style.display = "none";
    return;
  }
  el.style.display = "";
  const a = t - t0;
  const sp = m.speed;
  const ex =
    m.exit === "cut" ? (t >= t1 - 0.001 ? 1 : 0) : prog(t, t1 - 0.26 * sp, t1, E.inCubic);
  const fadeOrCut: ExitKind = m.exit === "cut" ? "cut" : "fade";
  switch (kind) {
    case "rise":
    case "pop":
      set(el, withExit(el, typoEnter(el, a, m, kind === "rise"), ex, m.exit, kind === "rise"));
      break;
    case "fade":
      set(el, withExit(el, { o: prog(a, 0, 0.25 * sp) }, ex, fadeOrCut));
      break;
    case "slide": {
      const p = prog(a, 0, 0.5 * sp, E.outExpo);
      set(el, { x: (1 - p) * 600 + ex * 600, o: 1 });
      break;
    }
    case "stamp": {
      const p = prog(a, 0, 0.22 * sp, E.outBack);
      el.style.transformOrigin = "300px 620px";
      set(el, withExit(el, { s: 2.2 - 1.2 * p, r: -7, o: prog(a, 0, 0.08) }, ex, fadeOrCut));
      break;
    }
    case "card":
    case "cardx": {
      const r = it.r ?? 0;
      let tr: Transform;
      el.style.clipPath = "";
      switch (m.family) {
        case "kinetic":
        case "launch": {
          const p = prog(a, 0, 0.5 * sp, EASE[m.easing]);
          tr = { y: (1 - p) * 140, s: 0.94 + 0.06 * p, r, o: prog(a, 0, 0.2 * sp) };
          break;
        }
        case "whiteboard":
        case "chalk": {
          const p = prog(a, 0, 0.55 * sp, E.inOutCubic);
          el.style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0)`;
          tr = { r, o: 1 };
          break;
        }
        case "hype": {
          const p = prog(a, 0, 0.3 * sp, E.outExpo);
          tr = { s: 1.9 - 0.9 * p, r: r * p, blur: (1 - p) * 8, o: prog(a, 0, 0.06) };
          break;
        }
        case "blocks": {
          // flat graphics slide in from the side on a hard beat, no tilt, no overshoot
          const p = prog(a, 0, 0.36 * sp, E.outExpo);
          tr = { x: (1 - p) * (r >= 0 ? 700 : -700), r: 0, o: 1 };
          break;
        }
        case "beat": {
          const p = prog(a, 0, 0.28 * sp, E.outBack);
          tr = { s: 0.5 + 0.5 * p, r: r * p, o: prog(a, 0, 0.05) };
          break;
        }
        default: {
          const p = prog(a, 0, 0.55 * sp, E.outBack);
          tr = { y: (1 - p) * 900, r: r * (1 + (1 - p) * 2), o: 1 };
        }
      }
      if (m.family === "editorial" || m.family === "collage") {
        // the house exit: cards fling out sideways, spinning
        set(el, { ...tr, x: ex * (r > 0 ? 900 : -900), r: (tr.r ?? 0) + ex * r * 3, blur: ex * 6 });
      } else set(el, withExit(el, tr, ex, m.exit));
      break;
    }
    case "bleed": {
      const p = prog(a, 0, 0.42 * sp, E.outExpo);
      el.style.clipPath = `inset(0 0 ${(1 - p) * 100}% 0)`;
      el.style.opacity = String(1 - prog(t, t1 - 0.2, t1));
      const k = el.querySelector<HTMLElement>(".k");
      if (k) k.style.transform = `scale(${1.1 - 0.08 * prog(a, 0, t1 - t0)})`;
      el.style.zIndex = String(Math.round(t0 * 10));
      break;
    }
    case "none":
      break;
  }
  it.fn?.(el, a, t, ex);
}

export { nextId };
