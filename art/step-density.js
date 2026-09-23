import { el, text, group, swatch, ready } from "./svg.js";
import { loadSource, analyze } from "./data.js";
import { colorSpacePlot } from "../src/viz/colorSpace.js";

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

  // The same plot the app shows on its Color space tab. Angle is hue, the
  // distance from the center is chroma, and lightness is flattened.
  const size = 390;
  const plot = colorSpacePlot({ oklab: a.lab, families: a.families, size, idPrefix: "density" }).node;
  plot.setAttribute("x", 486);
  plot.setAttribute("y", 22);
  plot.setAttribute("width", size);
  plot.setAttribute("height", size);
  svg.append(plot);
  svg.append(text(486, 446, "OKLAB A/B PLANE · HUE RING", { class: "label" }));

  const lx = 910, ly = 90;
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
