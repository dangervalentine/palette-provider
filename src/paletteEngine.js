import { rgbToOklab, oklabToRgb, oklabToLch } from "./oklab";
import { findFamilies } from "./densityPeaks";
import { splitShades } from "./shades";

const TARGET_SAMPLES = 10000;

// How many lightness shades one family may split into at each Detail level.
export const DETAIL_SHADES = { essential: 1, balanced: 2, rich: 3 };

// Deterministic hash of a grid cell to [0, 1). `salt` gives independent
// values for the x and y offsets.
function cellHash(gx, gy, salt) {
  let h = Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663) ^ Math.imul(salt, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// The grid cell positions that stratifiedSample reads, in image pixels. One
// per cell of a square grid, at a hashed offset inside the cell so thin
// regular structures do not alias with the grid.
export function samplePoints(width, height, targetCount) {
  const gridSize = Math.ceil(Math.sqrt(targetCount));
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  const points = [];
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      points.push({
        x: Math.min(Math.floor(gx * cellW + cellHash(gx, gy, 1) * cellW), width - 1),
        y: Math.min(Math.floor(gy * cellH + cellHash(gx, gy, 2) * cellH), height - 1),
      });
    }
  }
  return points;
}

export function stratifiedSample(imageData, width, height, targetCount) {
  return samplePoints(width, height, targetCount).map(({ x, y }) => {
    const idx = (y * width + x) * 4;
    return [imageData[idx], imageData[idx + 1], imageData[idx + 2]];
  });
}

// Everything the palette and its diagrams are built from, computed once per
// image: the sample positions and their OKLAB values, and the families with
// their shades at every Detail level. Changing Detail reads a different set of
// shades from the same analysis, so it needs no new pass over the image.
// Families are sorted by share, largest first; each carries
// { peak, color, members, share, rgb, hue, chroma, shades: { [detail]: [...] } }.
export function analyzeImage(imageData, width, height) {
  if (width === 0 || height === 0) return { points: [], oklab: [], families: [] };

  const points = samplePoints(width, height, TARGET_SAMPLES);
  const oklab = points.map(({ x, y }) => {
    const idx = (y * width + x) * 4;
    return rgbToOklab(imageData[idx], imageData[idx + 1], imageData[idx + 2]);
  });

  const families = findFamilies(oklab).map((family) => {
    const { hue, chroma } = oklabToLch(family.color);
    const shades = {};
    for (const [detail, maxShades] of Object.entries(DETAIL_SHADES)) {
      shades[detail] = splitShades(family, oklab, maxShades, oklab.length);
    }
    return {
      ...family,
      rgb: oklabToRgb(...family.color),
      hue,
      chroma,
      shades,
    };
  });

  return { points, oklab, families };
}

// The palette entries for one Detail level: every shade of every family, in
// family order, each as { color, okL, percentage, family, familyHue, familyChroma }.
export function paletteFor(analysis, detail = "balanced") {
  const level = detail in DETAIL_SHADES ? detail : "balanced";
  return analysis.families.flatMap((family, familyIndex) =>
    family.shades[level].map((shade) => ({
      color: oklabToRgb(shade.color[0], shade.color[1], shade.color[2]),
      okL: shade.color[0],
      percentage: shade.share * 100,
      family: familyIndex,
      familyHue: family.hue,
      familyChroma: family.chroma,
    }))
  );
}

export function extractPalette(
  imageData,
  width,
  height,
  { detail = "balanced" } = {}
) {
  return paletteFor(analyzeImage(imageData, width, height), detail);
}
