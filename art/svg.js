import { el, text, rect, group } from "../src/viz/svg.js";

export { el, text, rect, circle, line, path, group } from "../src/viz/svg.js";

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
