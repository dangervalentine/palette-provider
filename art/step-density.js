import { el, text, rect, circle, line, group, swatch, ready } from "./svg.js";
import { loadSource, analyze, FAMILY_SEPARATION } from "./data.js";
import { oklabToRgb } from "../src/oklab.js";

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

async function main() {
  const source = await loadSource();
  const a = analyze(source);
  document.getElementById("frame").classList.add("step");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(header("02 / FIND PEAKS", "Find the color families", [
    "Samples are binned in OKLAB. The",
    "densest bins that sit 0.10 or more",
    "apart become family peaks, so a",
    "small color far from the rest is",
    "always its own family.",
  ]));

  const ox = 500, oy = 64, os = 330, range = 0.2;
  const X = (v) => ox + ((v + range) / (2 * range)) * os;
  const Y = (v) => oy + os - ((v + range) / (2 * range)) * os;
  const binPx = (0.02 / (2 * range)) * os;
  svg.append(el("clipPath", { id: "pl" }, rect(ox, oy, os, os, { rx: 6 })));
  svg.append(rect(ox, oy, os, os, { rx: 6, class: "panel" }));
  svg.append(line(X(0), oy, X(0), oy + os, { class: "hair", "stroke-opacity": 0.5 }));
  svg.append(line(ox, Y(0), ox + os, Y(0), { class: "hair", "stroke-opacity": 0.5 }));
  svg.append(text(ox + os - 6, Y(0) - 6, "+a", { class: "label-muted", "text-anchor": "end", style: "font-size:13px;text-transform:none" }));
  svg.append(text(X(0) + 6, oy + 14, "+b", { class: "label-muted", style: "font-size:13px;text-transform:none" }));

  const maxD = Math.max(...a.bins.map((b) => b.density));
  const binsG = group({ "clip-path": "url(#pl)" });
  for (const b of a.bins) {
    const [L, aa, bb] = b.center;
    const rgb = oklabToRgb(L, aa, bb);
    binsG.append(rect(X(aa) - binPx / 2, Y(bb) - binPx / 2, binPx, binPx, { fill: `rgb(${rgb.join(",")})`, opacity: 0.15 + 0.85 * (b.density / maxD) }));
  }
  svg.append(binsG);
  a.families.forEach((f) => {
    const cx = X(f.peak[1]), cy = Y(f.peak[2]);
    svg.append(circle(cx, cy, (FAMILY_SEPARATION / (2 * range)) * os, { fill: "none", stroke: "#82aaff", "stroke-opacity": 0.2, "stroke-dasharray": "4 4", "clip-path": "url(#pl)" }));
    svg.append(circle(cx, cy, 9, { fill: `rgb(${f.rgb.join(",")})`, stroke: "#82aaff", "stroke-width": 2 }));
  });
  svg.append(text(ox, oy + os + 26, "OKLAB a/b PLANE", { class: "label" }));
  svg.append(text(ox, oy + os + 48, "BIN 0.02 · SEPARATION 0.10", { class: "label" }));
  // Separation weights lightness down; peaks that differ mostly in L can sit
  // inside each other's circle in this a/b projection.
  const r = (FAMILY_SEPARATION / (2 * range)) * os;
  const overlap = a.families.some((f, i) =>
    a.families.some((g, j) => j > i && Math.hypot(X(f.peak[1]) - X(g.peak[1]), Y(f.peak[2]) - Y(g.peak[2])) < r));
  if (overlap) {
    svg.append(text(ox, oy + os + 70, "(distance is weighted, so peaks may overlap here)", { class: "label-muted", style: "font-size:12px;letter-spacing:0.08em" }));
  }

  const lx = 880, ly = 90;
  svg.append(text(lx, ly, "FAMILIES", { class: "label" }));
  a.families.forEach((f, i) => {
    const yy = ly + 34 + i * 34;
    svg.append(swatch(lx, yy - 16, 36, 22, f.rgb));
    svg.append(text(lx + 46, yy, f.hex, { class: "value" }));
    svg.append(text(lx + 150, yy, `${(f.share * 100).toFixed(1)}%`, { class: "value", fill: "#9db2c0" }));
    svg.append(text(lx + 220, yy, f.lch.chroma < 0.03 ? "gray" : `${Math.round(f.lch.hue)}°`, { class: "value", fill: "#7e8e94" }));
  });

  document.getElementById("frame").append(svg);
  await ready();
}
main();
