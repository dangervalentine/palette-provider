import { el, text, rect, circle, line, path, group, swatch, ready } from "./svg.js";
import { loadSource, analyze, hueDensity } from "./data.js";

const W = 1280;
const H = 720;
const pct = (share) => `${(share * 100).toFixed(1)}%`;

const PRIMARY = "#82aaff";
const NEUTRAL_CHROMA = 0.03;
const SWATCH_W = 34;
const SWATCH_H = 20;
const SHADE_GAP = 4;
const MIN_GAP = 78;
const BEAD_GAP = 15; // two 7px peak circles plus a hair of air

function photoCard(a, source, x, y, w, h) {
  const g = group();
  g.append(text(x, y - 14, "SOURCE PHOTO · 10,000 SAMPLES", { class: "label" }));
  const scale = Math.max(w / source.width, h / source.height);
  const dw = source.width * scale;
  const dh = source.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  g.append(el("clipPath", { id: "photo-clip" }, rect(x, y, w, h, { rx: 6 })));
  g.append(el("image", {
    href: source.canvas.toDataURL("image/jpeg", 0.92),
    x: dx, y: dy, width: dw, height: dh, "clip-path": "url(#photo-clip)",
  }));
  // Dim the photo slightly so the sample stipple reads.
  g.append(rect(x, y, w, h, { rx: 6, fill: "#011627", opacity: 0.25 }));
  const top = a.families[0];
  const dots = group({ "clip-path": "url(#photo-clip)", fill: PRIMARY, opacity: 0.9 });
  for (const i of top.members) {
    const p = a.points[i];
    dots.append(rect(dx + p.x * scale - 1, dy + p.y * scale - 1, 2, 2));
  }
  g.append(dots);
  g.append(rect(x, y, w, h, { rx: 6, class: "hair", stroke: PRIMARY, "stroke-opacity": 0.5 }));
  g.append(text(x, y + h + 22, `SAMPLES FEEDING ${top.hex}`, { class: "label", fill: PRIMARY }));
  return g;
}

function stats(a, x, y) {
  const rows = [
    ["SPACE", "OKLAB"],
    ["SAMPLED", "100 × 100"],
    ["SEPARATION", "0.10 ΔE"],
    ["FAMILIES", String(a.families.length)],
    ["SHADES", "≤ 2 per family"],
    ["PALETTE", `${a.entries.length} colors`],
  ];
  const g = group();
  rows.forEach(([k, v], i) => {
    const yy = y + i * 40;
    g.append(text(x, yy, k, { class: "label-muted" }));
    g.append(text(x, yy + 18, v, { class: "value-strong", style: "font-size:15px" }));
  });
  return g;
}

function palettePanel(a, x, y, w, h) {
  const g = group();
  g.append(rect(x, y, w, h, { rx: 10, class: "panel" }));
  g.append(text(x + 16, y + 26, "PALETTE", { class: "label", fill: "#d6deeb" }));
  const counts = ["dominant", "supporting", "accent"]
    .map((t) => `${(a.byTier[t] ?? []).length} ${t.slice(0, 3)}`)
    .join(" · ");
  g.append(text(x + w - 16, y + 26, counts.toUpperCase(), { class: "label-muted", "text-anchor": "end", style: "font-size:9px" }));
  const rows = ["dominant", "supporting", "accent"].flatMap((t) => a.byTier[t] ?? []);
  const perCol = Math.ceil(rows.length / 2);
  rows.forEach((e, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    const rx = x + 14 + col * (w / 2);
    const ry = y + 46 + row * 20;
    if (i === 0) g.append(rect(rx - 6, ry - 13, w / 2 - 12, 19, { rx: 4, fill: "rgba(130,170,255,0.14)" }));
    g.append(circle(rx + 5, ry - 4, 5, { fill: `rgb(${e.color.join(",")})`, stroke: "rgba(255,255,255,0.15)" }));
    g.append(text(rx + 18, ry, e.hex, { class: "value", style: "font-size:11px" }));
    g.append(text(rx + w / 2 - 22, ry, pct(e.percentage / 100), { class: "value", "text-anchor": "end", style: "font-size:10px", fill: i === 0 ? PRIMARY : "#9db2c0" }));
  });
  return g;
}

// Pushes centers apart so consecutive ones sit at least `gap` apart, keeping
// the run inside [lo, hi]. `ideal` must be sorted ascending.
function spread(ideal, gap, lo, hi) {
  const out = [];
  ideal.forEach((x, i) => {
    out.push(Math.max(x, lo, i ? out[i - 1] + gap : -Infinity));
  });
  // Overflowing the right edge: pull the run back from the right, only as far
  // as each swatch needs to move.
  for (let i = out.length - 1; i >= 0; i--) {
    const limit = i === out.length - 1 ? hi : out[i + 1] - gap;
    out[i] = Math.min(out[i], limit);
  }
  return out;
}

function* permutations(items) {
  if (items.length <= 1) { yield items; return; }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

// Number of pairs of peak-to-swatch connectors that cross.
function crossings(placed, famY) {
  const side = (ax, ay, bx, by, cx, cy) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  let n = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const p = placed[i];
      const q = placed[j];
      if (
        side(p.px, p.py, p.cx, famY, q.px, q.py) * side(p.px, p.py, p.cx, famY, q.cx, famY) < 0 &&
        side(q.px, q.py, q.cx, famY, p.px, p.py) * side(q.px, q.py, q.cx, famY, p.cx, famY) < 0
      ) n++;
    }
  }
  return n;
}

function familyDiagram(a, x0, x1, yTop) {
  const g = group();
  const ridgeY = yTop + 60;
  const ridgeH = 50;
  const wheel0 = x0;
  const wheel1 = x1 - 90;
  const hueX = (hue) => wheel0 + (hue / 360) * (wheel1 - wheel0);

  g.append(text(x0, yTop, "COLOR FAMILIES · OKLAB", { class: "label-muted" }));
  g.append(text(x1, yTop, `${a.families.length} FAMILIES × ≤ 2 SHADES`, { class: "label-muted", "text-anchor": "end" }));

  // Hue-density ridge.
  // Square root keeps the minor hills visible next to a dominant one.
  const density = hueDensity(a.lab).map(Math.sqrt);
  const n = density.length;
  const ridgeAt = (hue) => {
    const f = (((hue / 360) * n - 0.5) % n + n) % n;
    const i = Math.floor(f);
    const t = f - i;
    const v = density[i] * (1 - t) + density[(i + 1) % n] * t;
    return ridgeY - v * ridgeH;
  };
  const pts = [];
  for (let s = 0; s <= 180; s++) {
    const hue = (s / 180) * 360;
    pts.push([hueX(hue), ridgeAt(hue)]);
  }
  const d = `M ${wheel0} ${ridgeY} ` + pts.map(([px, py]) => `L ${px.toFixed(1)} ${py.toFixed(1)}`).join(" ") + ` L ${wheel1} ${ridgeY} Z`;
  g.append(path(d, { fill: "rgba(130,170,255,0.10)", stroke: "#4976a1", "stroke-width": 1.25, "stroke-linejoin": "round" }));
  g.append(line(wheel0, ridgeY, wheel1, ridgeY, { class: "hair" }));
  g.append(text(wheel0, ridgeY + 14, "0°", { class: "label-muted", style: "font-size:9px" }));
  g.append(text(wheel1, ridgeY + 14, "360°", { class: "label-muted", "text-anchor": "end", style: "font-size:9px" }));

  // Neutral strip right of 360°.
  const neutralX0 = x1 - 60;
  g.append(line(neutralX0 - 12, ridgeY, x1 - 60 + 30 + 12, ridgeY, { class: "hair" }));
  g.append(text(neutralX0 + 15, ridgeY + 14, "GRAY", { class: "label-muted", "text-anchor": "middle", style: "font-size:9px" }));

  // Peak position (true hue) and ideal swatch x for every family.
  let neutralK = 0;
  const fams = a.families.map((f, index) => {
    const neutral = f.lch.chroma < NEUTRAL_CHROMA;
    const px = neutral ? neutralX0 + neutralK++ * 30 : hueX(f.lch.hue);
    const py = neutral ? ridgeY : ridgeAt(f.lch.hue);
    return { f, index, neutral, px, py, ideal: px };
  });

  // Peaks whose hues nearly coincide would hide each other. Group them into
  // clusters (chains closer than a bead), keep the largest family on the
  // ridge and stack the rest beneath it at the same true hue x.
  const sorted = [...fams].sort((p, q) => p.ideal - q.ideal);
  const clusters = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && !p.neutral && !last[0].neutral && p.px - last[last.length - 1].px < BEAD_GAP) last.push(p);
    else clusters.push([p]);
  }
  for (const c of clusters) {
    if (c.length < 2) continue;
    const byShare = [...c].sort((p, q) => q.f.share - p.f.share);
    byShare.forEach((p, k) => { p.py = byShare[0].py + k * BEAD_GAP; });
  }

  // Spreading rule: sort by ideal x, push apart to minGap, stay in range.
  const fanHalf = (2 * SWATCH_W + SHADE_GAP) / 2;
  const xs = spread(sorted.map((p) => p.ideal), MIN_GAP, x0 + fanHalf, x1 - fanHalf);
  const famY = ridgeY + 48;

  // Within a stacked cluster, pick which bead feeds which of the cluster's
  // slots so the straight connectors cross as little as possible.
  sorted.forEach((p, i) => { p.cx = xs[i]; });
  let offset = 0;
  for (const c of clusters) {
    const slots = xs.slice(offset, offset + c.length);
    offset += c.length;
    if (c.length < 2) continue;
    let best = null;
    for (const perm of permutations(c)) {
      perm.forEach((p, i) => { p.cx = slots[i]; });
      const cost = crossings(fams, famY);
      if (!best || cost < best.cost) best = { cost, perm: [...perm] };
    }
    best.perm.forEach((p, i) => { p.cx = slots[i]; });
  }

  const shadeY = famY + 46;
  const connectors = group();
  const peaks = group();
  const swatches = group();

  for (const p of fams) {
    const top = p.index === 0;
    const shades = a.entries.filter((e) => e.family === p.index);

    connectors.append(line(p.px, p.py, p.cx, famY, top
      ? { class: "link" }
      : { stroke: "#4976a1", "stroke-width": 1, "stroke-opacity": 0.8 }));

    peaks.append(circle(p.px, p.py, 7, {
      fill: `rgb(${p.f.rgb.join(",")})`,
      stroke: PRIMARY,
      "stroke-width": top ? 2 : 1.5,
    }));

    swatches.append(swatch(p.cx - SWATCH_W / 2, famY, SWATCH_W, SWATCH_H, p.f.rgb,
      top ? { stroke: PRIMARY, "stroke-width": 1.5 } : {}));
    swatches.append(text(p.cx, famY + SWATCH_H + 11, pct(p.f.share), {
      class: "value", "text-anchor": "middle",
      style: "font-size:8px", fill: top ? PRIMARY : "#9db2c0",
    }));

    const fanW = shades.length * SWATCH_W + (shades.length - 1) * SHADE_GAP;
    const busY = shadeY - 8;
    shades.forEach((e, k) => {
      const sx = p.cx - fanW / 2 + k * (SWATCH_W + SHADE_GAP);
      const scx = sx + SWATCH_W / 2;
      const attrs = top ? { class: "link" } : { class: "link-faint", stroke: "#3b5670" };
      connectors.append(path(`M ${p.cx} ${famY + SWATCH_H + 15} V ${busY} H ${scx} V ${shadeY}`, attrs));
      swatches.append(swatch(sx, shadeY, SWATCH_W, SWATCH_H, e.color,
        top && k === 0 ? { stroke: PRIMARY, "stroke-width": 2 } : {}));
    });
  }

  g.append(connectors, peaks, swatches);
  return g;
}

async function main() {
  const source = await loadSource();
  const a = analyze(source, "balanced");
  const frame = document.getElementById("frame");
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });

  svg.append(text(96, 300, "PALETTE", { class: "wordmark" }));
  svg.append(text(96, 375, "PROVIDER", { class: "wordmark" }));
  svg.append(rect(96, 412, 100, 4, { fill: "#c3e88d", rx: 2 }));
  svg.append(text(96, 470, "OKLAB COLOR FAMILIES", { class: "label", style: "font-size:15px;letter-spacing:0.3em" }));

  svg.append(photoCard(a, source, 540, 100, 230, 306));
  svg.append(stats(a, 800, 175));
  svg.append(palettePanel(a, 914, 104, 284, 180));
  svg.append(familyDiagram(a, 540, 1180, 466));

  frame.append(svg);
  await ready();
}

main();
