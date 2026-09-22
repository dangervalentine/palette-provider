import { el, text, rect, swatch, ready, stepHeader } from "./svg.js";
import { loadSource, analyze, shadesPerDetail } from "./data.js";

const W = 1200, H = 480;

async function main() {
  const source = await loadSource();
  const a = analyze(source);
  const per = shadesPerDetail(source);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(stepHeader("03 / SHADES", "Split families into shades", [
    "Detail controls how many lightness",
    "shades a family may show: one at",
    "Essential, two at Balanced, three at",
    "Rich. It never adds or removes a",
    "family.",
  ]));

  const x0 = 470, y0 = 90;
  const cols = [["essential", 760], ["balanced", 880], ["rich", 1020]];
  svg.append(text(x0, y0, "FAMILY", { class: "label" }));
  svg.append(text(x0 + 120, y0, "SHARE", { class: "label" }));
  cols.forEach(([d, cx]) => svg.append(text(cx, y0, d.toUpperCase(), { class: "label" })));
  const rowH = Math.min(46, (H - y0 - 40) / a.families.length);
  a.families.forEach((f, fi) => {
    const yy = y0 + 18 + fi * rowH;
    const sh = rowH - 18;
    svg.append(swatch(x0, yy, 56, sh, f.rgb));
    svg.append(text(x0 + 64, yy + sh / 2 + 4, f.hex, { class: "value", style: "font-size:11px" }));
    svg.append(rect(x0 + 120, yy + sh / 2 - 3, 120, 6, { rx: 3, fill: "#132a3e" }));
    svg.append(rect(x0 + 120, yy + sh / 2 - 3, Math.max(2, 120 * f.share), 6, { rx: 3, fill: "#82aaff" }));
    svg.append(text(x0 + 248, yy + sh / 2 + 4, `${(f.share * 100).toFixed(1)}%`, { class: "value", style: "font-size:10px", fill: "#9db2c0" }));
    cols.forEach(([d, cx]) => {
      const shades = per[d].filter((e) => e.family === fi);
      shades.forEach((e, si) => svg.append(swatch(cx + si * 36, yy, 32, sh, e.color)));
    });
  });

  document.getElementById("frame").append(svg);
  await ready();
}
main();
