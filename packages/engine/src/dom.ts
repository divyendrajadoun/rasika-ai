/** Tiny DOM helpers. All plan text goes through `esc` before it reaches innerHTML. */

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function div(className: string, style?: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  if (className) el.className = className;
  if (style) Object.assign(el.style, style);
  return el;
}

export function px(n: number): string {
  return `${n}px`;
}

/** rgba() from a #rrggbb hex. */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

let uid = 0;
export const nextId = (prefix: string): string => `${prefix}-${(uid++).toString(36)}`;
