import { el, rect, circle, line, path, group, rgbFill } from "./svg.js";
import { oklabToRgb, oklabToLch } from "../oklab.js";
import { BIN_SIZE, FAMILY_SEPARATION } from "../densityPeaks.js";
import { NEUTRAL_CHROMA } from "../paletteOrder.js";

// Chroma shown at the plot's edge. Wide enough for the most colorful peaks,
// narrow enough that a muted image does not collapse into the center.
const MIN_RANGE = 0.12;
const MAX_RANGE = 0.34;

// At most this many member dots are drawn for a selected family.
const MAX_MEMBER_DOTS = 1500;

const HUE_SEGMENTS = 72;

// Samples binned on the a/b plane only. Lightness is summed away, so each
// bin's color is the mean of the samples in it and its weight is their count.
function abBins(oklab) {
  const bins = new Map();
  for (const p of oklab) {
    const k = `${Math.floor(p[1] / BIN_SIZE)},${Math.floor(p[2] / BIN_SIZE)}`;
    let bin = bins.get(k);
    if (!bin) {
      bin = { count: 0, sum: [0, 0, 0] };
      bins.set(k, bin);
    }
    bin.count++;
    bin.sum[0] += p[0];
    bin.sum[1] += p[1];
    bin.sum[2] += p[2];
  }
  return [...bins.values()].map((b) => ({
    count: b.count,
    mean: b.sum.map((v) => v / b.count),
  }));
}

function chromaRange(oklab, families) {
  const chromas = oklab.map((p) => Math.hypot(p[1], p[2])).sort((a, b) => a - b);
  const p99 = chromas[Math.floor(chromas.length * 0.99)] ?? 0;
  const peaks = Math.max(0, ...families.map((f) => Math.hypot(f.peak[1], f.peak[2])));
  return Math.min(MAX_RANGE, Math.max(MIN_RANGE, p99 * 1.1, peaks + FAMILY_SEPARATION / 2));
}

// The OKLAB a/b plane as a disc: hue is the angle, chroma the distance from
// the center, and a hue ring runs around the edge. Samples are drawn as
// density bins, each family as its peak with a dashed circle of the family
// separation, and chromatic families get a tick on the ring at their hue.
//
// Returns { node, select }. `node` is an <svg> with viewBox 0 0 size size.
// `select(index | null, members?)` highlights one family and draws its member
// samples, or only `members` when given (one shade of the family).
// Chrome (disc, grid, separation circles, peak outlines) is styled by the
// host page through the cs-* classes, so it follows the page's theme.
export function colorSpacePlot({ oklab, families, size = 400, idPrefix = "cs" }) {
  const c = size / 2;
  const ringW = size * 0.035;
  const R = c - ringW - size * 0.03;
  const range = chromaRange(oklab, families);
  const k = R / range;
  const X = (a) => c + a * k;
  const Y = (b) => c - b * k;
  const clipId = `${idPrefix}-clip`;

  const svg = el("svg", {
    viewBox: `0 0 ${size} ${size}`,
    class: "cs-plot",
    role: "img",
    "aria-label": "Samples and color families on the OKLAB a/b plane",
  });
  svg.append(el("clipPath", { id: clipId }, circle(c, c, R)));
  svg.append(circle(c, c, R, { class: "cs-disc" }));

  // Chroma rings every 0.05 and the a/b axes.
  const grid = group({ class: "cs-grid" });
  for (let ch = 0.05; ch < range; ch += 0.05) grid.append(circle(c, c, ch * k));
  grid.append(line(c - R, c, c + R, c), line(c, c - R, c, c + R));
  svg.append(grid);

  // Density: square root keeps sparse regions visible beside a dense one.
  const bins = abBins(oklab);
  const maxCount = Math.max(1, ...bins.map((b) => b.count));
  const binPx = BIN_SIZE * k;
  const binLayer = group({ "clip-path": `url(#${clipId})` });
  for (const b of bins) {
    const [, a, bb] = b.mean;
    binLayer.append(rect(X(a) - binPx / 2, Y(bb) - binPx / 2, binPx, binPx, {
      fill: rgbFill(oklabToRgb(...b.mean)),
      opacity: (0.2 + 0.8 * Math.sqrt(b.count / maxCount)).toFixed(3),
    }));
  }
  svg.append(binLayer);

  // Hue ring. Angles run counterclockwise from +a, matching the plane.
  const r0 = c - ringW - size * 0.012;
  const r1 = r0 + ringW;
  const ring = group({ class: "cs-ring" });
  for (let i = 0; i < HUE_SEGMENTS; i++) {
    const t0 = (i / HUE_SEGMENTS) * 2 * Math.PI;
    const t1 = ((i + 1.05) / HUE_SEGMENTS) * 2 * Math.PI;
    const tm = ((i + 0.5) / HUE_SEGMENTS) * 2 * Math.PI;
    const pt = (r, t) => `${(c + r * Math.cos(t)).toFixed(2)} ${(c - r * Math.sin(t)).toFixed(2)}`;
    ring.append(path(
      `M ${pt(r0, t0)} A ${r0} ${r0} 0 0 0 ${pt(r0, t1)} L ${pt(r1, t1)} A ${r1} ${r1} 0 0 1 ${pt(r1, t0)} Z`,
      { fill: rgbFill(oklabToRgb(0.72, 0.13 * Math.cos(tm), 0.13 * Math.sin(tm))) }
    ));
  }
  svg.append(ring);

  // Member samples of the selected family sit under the peaks.
  const memberLayer = group({ class: "cs-members", "clip-path": `url(#${clipId})` });
  svg.append(memberLayer);

  const sepR = FAMILY_SEPARATION * k;
  const familyNodes = families.map((f, i) => {
    const px = X(f.peak[1]);
    const py = Y(f.peak[2]);
    const g = group({ class: "cs-family", "data-family": i });
    // Decorations never take the pointer, so they cannot block another
    // family's peak underneath them.
    g.append(circle(px, py, sepR, { class: "cs-sep", "clip-path": `url(#${clipId})`, "pointer-events": "none" }));
    const { chroma, hue } = oklabToLch(f.color);
    if (chroma >= NEUTRAL_CHROMA) {
      const t = (hue / 180) * Math.PI;
      g.append(line(
        c + (r0 - size * 0.02) * Math.cos(t), c - (r0 - size * 0.02) * Math.sin(t),
        c + (r1 + size * 0.008) * Math.cos(t), c - (r1 + size * 0.008) * Math.sin(t),
        { class: "cs-tick", "pointer-events": "none" }
      ));
    }
    // A larger invisible target makes small peaks easy to tap.
    g.append(circle(px, py, size * 0.04, { class: "cs-hit" }));
    // Peaks go in a layer above every target, so a small family's target
    // never covers a large family's peak.
    const peak = group({ class: "cs-family", "data-family": i },
      circle(px, py, size * 0.022, { class: "cs-peak", fill: rgbFill(f.rgb ?? oklabToRgb(...f.color)) }));
    return [g, peak];
  });
  // Smallest on top so a small family's peak is never hidden by a large one.
  const reversed = [...familyNodes].reverse();
  reversed.forEach(([g]) => svg.append(g));
  reversed.forEach(([, peak]) => svg.append(peak));

  const select = (index, only) => {
    memberLayer.replaceChildren();
    familyNodes.forEach((nodes, i) => {
      for (const node of nodes) {
        node.classList.toggle("is-selected", i === index);
        node.classList.toggle("is-dim", index != null && i !== index);
      }
    });
    if (index == null || !families[index]) return;
    const members = only ?? families[index].members;
    const step = Math.max(1, Math.ceil(members.length / MAX_MEMBER_DOTS));
    const dotR = size * 0.004;
    for (let m = 0; m < members.length; m += step) {
      const p = oklab[members[m]];
      memberLayer.append(circle(X(p[1]), Y(p[2]), dotR));
    }
  };

  return { node: svg, select };
}
