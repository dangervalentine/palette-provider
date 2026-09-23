const NS = "http://www.w3.org/2000/svg";

// el("rect", { x: 1, class: "panel" }, children...) builds an SVG element.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  }
  for (const c of children) {
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export const text = (x, y, str, attrs = {}) => el("text", { x, y, ...attrs }, str);
export const rect = (x, y, w, h, attrs = {}) => el("rect", { x, y, width: w, height: h, ...attrs });
export const circle = (cx, cy, r, attrs = {}) => el("circle", { cx, cy, r, ...attrs });
export const line = (x1, y1, x2, y2, attrs = {}) => el("line", { x1, y1, x2, y2, ...attrs });
export const path = (d, attrs = {}) => el("path", { d, ...attrs });
export const group = (attrs = {}, ...children) => el("g", attrs, ...children);

export const rgbFill = (rgb) => `rgb(${rgb.join(",")})`;
