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

// A rounded swatch with a hairline so light colors keep an edge.
export function swatch(x, y, w, h, rgb, attrs = {}) {
  return rect(x, y, w, h, {
    rx: 4,
    fill: `rgb(${rgb.join(",")})`,
    stroke: "rgba(255,255,255,0.12)",
    "stroke-width": 1,
    ...attrs,
  });
}

// Title block used by the step pages: "01" in primary, a title, a caption.
export function stepHeader(num, title, captionLines, x = 48, y = 72) {
  const g = group();
  g.append(text(x, y, num, { class: "label", fill: "#82aaff", style: "font-size:13px" }));
  g.append(text(x, y + 40, title, { class: "title" }));
  captionLines.forEach((ln, i) => g.append(text(x, y + 76 + i * 22, ln, { class: "caption" })));
  return g;
}

// Marks the frame as ready once fonts are in, so the capture script waits
// for real glyphs rather than fallbacks.
export async function ready() {
  await document.fonts.ready;
  document.getElementById("frame").dataset.ready = "1";
}
