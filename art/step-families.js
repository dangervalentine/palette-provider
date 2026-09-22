import { el, text, rect, swatch, ready, group } from "./svg.js";
import { loadSource, analyze, shadesPerDetail } from "./data.js";

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
  const per = shadesPerDetail(source);
  document.getElementById("frame").classList.add("step");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(header("03 / SHADES", "Split families into shades", [
    "Detail controls how many lightness",
    "shades a family may show: one at",
    "Essential, two at Balanced, three",
    "at Rich. It never adds or removes",
    "a family.",
  ]));

  // Starts right of the 38px title, which runs to about x 478.
  const x0 = 504, y0 = 90;
  // Headers are shortened so they fit over the narrow shade columns.
  const cols = [["essential", 846, "ESS"], ["balanced", 940, "BAL"], ["rich", 1040, "RICH"]];
  svg.append(text(x0, y0, "FAMILY", { class: "label" }));
  svg.append(text(x0 + 156, y0, "SHARE", { class: "label" }));
  cols.forEach(([, cx, head]) => svg.append(text(cx, y0, head, { class: "label" })));
  const rowH = Math.min(46, (H - y0 - 40) / a.families.length);
  a.families.forEach((f, fi) => {
    const yy = y0 + 18 + fi * rowH;
    const sh = rowH - 18;
    svg.append(swatch(x0, yy, 56, sh, f.rgb));
    svg.append(text(x0 + 64, yy + sh / 2 + 5, f.hex, { class: "value", style: "font-size:15px" }));
    svg.append(rect(x0 + 156, yy + sh / 2 - 3, 90, 6, { rx: 3, fill: "#132a3e" }));
    svg.append(rect(x0 + 156, yy + sh / 2 - 3, Math.max(2, 90 * f.share), 6, { rx: 3, fill: "#82aaff" }));
    svg.append(text(x0 + 254, yy + sh / 2 + 5, `${(f.share * 100).toFixed(1)}%`, { class: "value", style: "font-size:14px", fill: "#9db2c0" }));
    cols.forEach(([d, cx]) => {
      const shades = per[d].filter((e) => e.family === fi);
      shades.forEach((e, si) => svg.append(swatch(cx + si * 34, yy, 30, sh, e.color)));
    });
  });

  document.getElementById("frame").append(svg);
  await ready();
}
main();
