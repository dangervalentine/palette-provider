import { el, text, circle, path, swatch, ready, stepHeader } from "./svg.js";
import { loadSource, analyze } from "./data.js";
import { oklabToRgb } from "../src/oklab.js";

const W = 1200, H = 480;

async function main() {
  const source = await loadSource();
  const a = analyze(source);
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(stepHeader("04 / TIERS", "Rank and order by hue", [
    "Families are ranked into dominant,",
    "supporting and accent tiers by their",
    "share. Inside each tier the chips run",
    "around the hue wheel, grays last, so",
    "shades of one color sit together.",
  ]));

  const cx = 560, cy = 240, r = 90;
  const segs = 72;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * 2 * Math.PI, a1 = ((i + 1) / segs) * 2 * Math.PI;
    const h = ((i + 0.5) / segs) * 2 * Math.PI;
    const rgb = oklabToRgb(0.7, 0.15 * Math.cos(h), 0.15 * Math.sin(h));
    const d = `M ${cx + (r - 10) * Math.cos(a0)} ${cy + (r - 10) * Math.sin(a0)} A ${r - 10} ${r - 10} 0 0 1 ${cx + (r - 10) * Math.cos(a1)} ${cy + (r - 10) * Math.sin(a1)} L ${cx + (r + 10) * Math.cos(a1)} ${cy + (r + 10) * Math.sin(a1)} A ${r + 10} ${r + 10} 0 0 0 ${cx + (r + 10) * Math.cos(a0)} ${cy + (r + 10) * Math.sin(a0)} Z`;
    svg.append(path(d, { fill: `rgb(${rgb.join(",")})`, opacity: 0.55 }));
  }
  svg.append(text(cx + r + 16, cy + 4, "0°", { class: "label-muted", style: "font-size:9px" }));
  svg.append(text(cx - r - 16, cy + 4, "180°", { class: "label-muted", "text-anchor": "end", style: "font-size:9px" }));
  svg.append(text(cx, cy + r + 34, "OKLCH HUE WHEEL", { class: "label", "text-anchor": "middle" }));
  // Smallest first so the largest family's dot ends up on top.
  [...a.families]
    .filter((f) => f.lch.chroma >= 0.03)
    .sort((x, y) => x.share - y.share)
    .forEach((f) => {
      const ang = (f.lch.hue / 180) * Math.PI;
      const px = cx + r * Math.cos(ang), py = cy + r * Math.sin(ang);
      svg.append(circle(px, py, 5 + Math.min(7, f.share * 20), { fill: `rgb(${f.rgb.join(",")})`, stroke: "#fff", "stroke-width": 1.5 }));
    });

  const tx = 760, ty = 100;
  ["dominant", "supporting", "accent"].forEach((tier, ti) => {
    const yy = ty + ti * 110;
    const items = a.byTier[tier] ?? [];
    svg.append(text(tx, yy, `${tier.toUpperCase()}  ${items.length}`, { class: "label" }));
    items.forEach((e, i) => {
      const sx = tx + i * 50;
      svg.append(swatch(sx, yy + 12, 44, 28, e.color));
      svg.append(text(sx + 22, yy + 54, e.hex, { class: "label-muted", "text-anchor": "middle", style: "font-size:8px;letter-spacing:0.04em" }));
    });
  });

  document.getElementById("frame").append(svg);
  await ready();
}
main();
