import { el, text, rect, circle, line, ready, group } from "./svg.js";
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

async function main() {
  const source = await loadSource();
  const a = analyze(source);
  document.getElementById("frame").classList.add("step");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
  svg.append(header("01 / SAMPLE", "Sample the image", [
    "10,000 points on a square grid,",
    "each nudged inside its cell so",
    "thin stripes never line up with",
    "the grid and disappear.",
  ]));

  // Photo with coarse grid and genuine sample dots
  const px = 470, py = 80, ps = 320;
  const scale = Math.max(ps / source.width, ps / source.height);
  const ix = px + (ps - source.width * scale) / 2, iy = py + (ps - source.height * scale) / 2;
  svg.append(el("clipPath", { id: "c" }, rect(px, py, ps, ps, { rx: 6 })));
  svg.append(el("image", { href: source.canvas.toDataURL("image/jpeg", 0.9), x: ix, y: iy, width: source.width * scale, height: source.height * scale, "clip-path": "url(#c)", opacity: 0.85 }));
  const coarse = 12;
  const grid = 100; // engine cells per side for 10,000 samples
  for (let i = 0; i <= coarse; i++) {
    const t = (i * ps) / coarse;
    svg.append(line(px + t, py, px + t, py + ps, { class: "hair", "stroke-opacity": 0.6 }));
    svg.append(line(px, py + t, px + ps, py + t, { class: "hair", "stroke-opacity": 0.6 }));
  }
  // Engine cells are only a few display pixels wide, so show the real hashed
  // offset of engine cell (gx, gy) at the coarse scale, and color the dot by
  // the image pixel under its display position.
  const engW = source.width / grid, engH = source.height / grid;
  const drawn = ps / coarse;
  for (let gy = 0; gy < coarse; gy++) for (let gx = 0; gx < coarse; gx++) {
    const p = a.points[gy * grid + gx];
    const fx = (p.x - gx * engW) / engW, fy = (p.y - gy * engH) / engH;
    const sx = px + (gx + fx) * drawn, sy = py + (gy + fy) * drawn;
    const u = Math.min(source.width - 1, Math.max(0, Math.floor((sx - ix) / scale)));
    const v = Math.min(source.height - 1, Math.max(0, Math.floor((sy - iy) / scale)));
    const k = (v * source.width + u) * 4;
    const c = [source.data[k], source.data[k + 1], source.data[k + 2]];
    svg.append(circle(sx, sy, 3.5, { fill: `rgb(${c.join(",")})`, stroke: "#fff", "stroke-width": 1, "clip-path": "url(#c)" }));
  }
  svg.append(rect(px, py, ps, ps, { rx: 6, class: "hair", stroke: "#82aaff", "stroke-opacity": 0.5 }));
  svg.append(text(px, py + ps + 28, "100 × 100 CELLS", { class: "label" }));
  svg.append(text(px, py + ps + 50, "ONE SAMPLE EACH", { class: "label" }));

  // Zoom inset of one cell
  const zx = 880, zy = 110, zs = 200;
  const cell = a.points[55 * grid + 55];
  const cellW = source.width / grid, cellH = source.height / grid;
  const fx = (cell.x - 55 * cellW) / cellW, fy = (cell.y - 55 * cellH) / cellH;
  svg.append(rect(zx, zy, zs, zs, { class: "hair", "stroke-dasharray": "6 5", stroke: "#82aaff" }));
  svg.append(line(zx + zs / 2 - 8, zy + zs / 2, zx + zs / 2 + 8, zy + zs / 2, { class: "hair", stroke: "#7e8e94" }));
  svg.append(line(zx + zs / 2, zy + zs / 2 - 8, zx + zs / 2, zy + zs / 2 + 8, { class: "hair", stroke: "#7e8e94" }));
  const dx = zx + fx * zs, dy = zy + fy * zs;
  // Keep both labels inside the dashed square: CELL CENTER sits under the
  // crosshair, or above it when the sample dot is below the center.
  const centerLabelY = dy > zy + zs / 2 ? zy + zs / 2 - 16 : zy + zs / 2 + 28;
  svg.append(text(zx + zs / 2, centerLabelY, "CELL CENTER", { class: "label-muted", "text-anchor": "middle", style: "font-size:13px;letter-spacing:0.12em" }));
  svg.append(circle(dx, dy, 6, { fill: "#c3e88d" }));
  const sampleRight = dx + 14 + 56 < zx + zs - 8;
  svg.append(text(sampleRight ? dx + 14 : dx - 14, dy + 5, "SAMPLE", { class: "label", fill: "#c3e88d", "text-anchor": sampleRight ? "start" : "end", style: "font-size:13px;letter-spacing:0.12em" }));
  svg.append(text(zx, zy + zs + 28, "ONE CELL", { class: "label" }));
  svg.append(text(zx, zy + zs + 50, "HASHED OFFSET", { class: "label" }));

  document.getElementById("frame").append(svg);
  await ready();
}
main();
