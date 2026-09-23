import { el, text, rect, line, swatch, ready, group } from "./svg.js";
import { loadSource, analyze } from "./data.js";

const W = 1200, H = 480;

// Same look as stepHeader in svg.js, with caption lines spaced for the larger
// step-page type.
function header(num, title, captionLines, x = 48, y = 72) {
  const g = group();
  g.append(text(x, y, num, { class: "label", fill: "#82aaff", style: "font-size:18px" }));
  g.append(text(x, y + 40, title, { class: "title" }));
  captionLines.forEach((ln, i) => g.append(text(x, y + 76 + i * 30, ln, { class: "caption" })));
  return g;
}

const pct = (p) => `${p.toFixed(p < 10 ? 1 : 0)}%`;

// One palette strip, the way the app draws it: equal segments, rounded ends.
function strip(entries, x, y, w, h, clipId) {
  const g = group();
  const segW = w / entries.length;
  g.append(el("clipPath", { id: clipId }, rect(x, y, w, h, { rx: 8 })));
  const segs = group({ "clip-path": `url(#${clipId})` });
  entries.forEach((e, i) => segs.append(rect(x + i * segW, y, segW + 0.5, h, { fill: `rgb(${e.color.join(",")})` })));
  g.append(segs);
  g.append(rect(x, y, w, h, { rx: 8, fill: "none", stroke: "rgba(255,255,255,0.12)" }));
  return { g, segW };
}

async function main() {
  const source = await loadSource();
  const a = analyze(source);
  document.getElementById("frame").classList.add("step");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(header("04 / ORDER", "Order the palette", [
    "Prevalence puts the largest",
    "shades first. Family keeps each",
    "family's shades together, light",
    "to dark, with families around",
    "the hue wheel and grays last.",
  ]));

  const x0 = 504, w = 648, h = 64;

  // Prevalence: every shade by its own share.
  const y1 = 96;
  svg.append(text(x0, y1 - 18, "PREVALENCE", { class: "label" }));
  const p = strip(a.byPrevalence, x0, y1, w, h, "strip-prevalence");
  svg.append(p.g);
  a.byPrevalence.forEach((e, i) => {
    if (p.segW < 44) return;
    svg.append(text(x0 + (i + 0.5) * p.segW, y1 + h + 24, pct(e.percentage), {
      class: "value", "text-anchor": "middle", style: "font-size:14px", fill: "#9db2c0",
    }));
  });

  // Family: brackets under the strip mark each family's run of shades.
  const y2 = 270;
  svg.append(text(x0, y2 - 18, "FAMILY", { class: "label" }));
  const f = strip(a.byFamily, x0, y2, w, h, "strip-family");
  svg.append(f.g);
  let start = 0;
  a.byFamily.forEach((e, i) => {
    const next = a.byFamily[i + 1];
    if (next && next.family === e.family) return;
    const bx0 = x0 + start * f.segW + 3, bx1 = x0 + (i + 1) * f.segW - 3;
    const by = y2 + h + 10;
    svg.append(line(bx0, by, bx1, by, { class: "link" }));
    svg.append(line(bx0, by - 5, bx0, by, { class: "link" }));
    svg.append(line(bx1, by - 5, bx1, by, { class: "link" }));
    const fam = a.families[e.family];
    if (bx1 - bx0 >= 34) {
      svg.append(swatch((bx0 + bx1) / 2 - 12, by + 10, 24, 14, fam.rgb));
    }
    start = i + 1;
  });
  svg.append(text(x0, y2 + h + 72, `${a.families.length} FAMILIES · ${a.entries.length} SHADES`, { class: "label-muted" }));

  document.getElementById("frame").append(svg);
  await ready();
}
main();
