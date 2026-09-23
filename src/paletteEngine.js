import { rgbToOklab, oklabToRgb, oklabToLch } from "./oklab";
import { findFamilies, mergeFamilies } from "./densityPeaks";
import { splitShades } from "./shades";

const TARGET_SAMPLES = 10000;

// How many lightness shades one family may split into at each Detail level.
export const DETAIL_SHADES = { essential: 1, balanced: 2, rich: 3 };

// The Colors choices: the most swatches a palette may show. "all" keeps every
// family the engine found; a number merges the closest families until their
// shades fit.
export const COLOR_LIMITS = ["all", 8, 5, 3];

// A family with its display color and its shades at every Detail level.
function describeFamily(family, oklab) {
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
}

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

  const families = findFamilies(oklab).map((family) => describeFamily(family, oklab));
  return { points, oklab, families };
}

const swatchCount = (families, detail) =>
  families.reduce((n, f) => n + f.shades[detail].length, 0);

// Hands out `slots` swatches across families: one each, then every extra slot
// to the family with the most share per swatch it already has, up to its
// shade count. Big families get depth first; every family keeps a swatch.
function allocateShades(families, slots, level) {
  const counts = families.map(() => 1);
  for (let left = slots - families.length; left > 0; left--) {
    let best = -1;
    for (let i = 0; i < families.length; i++) {
      if (counts[i] >= families[i].shades[level].length) continue;
      if (best < 0 || families[i].share / counts[i] > families[best].share / counts[best]) {
        best = i;
      }
    }
    if (best < 0) break;
    counts[best]++;
  }
  return counts;
}

// The analysis with at most `limit` swatches at the given Detail level, so
// Detail decides how the swatches are spent: distinct colors at Essential,
// fewer colors in more shades at Rich. The closest families merge one pair at
// a time (see mergeFamilies) until the shades fit, but never below
// max(2, limit / shades per family) families, so a tight limit keeps an accent
// instead of collapsing into one color. If shades still overflow, the
// families' shades are cut back (see allocateShades). A merged family gets
// fresh shades, since it now holds more of the image, and `mergedFrom`
// records how many families there were. Returns the analysis itself when it
// already fits.
export function limitFamilies(analysis, limit = "all", detail = "balanced") {
  const level = detail in DETAIL_SHADES ? detail : "balanced";
  if (limit === "all" || swatchCount(analysis.families, level) <= limit) {
    return analysis;
  }
  const minFamilies = Math.min(
    limit,
    Math.max(2, Math.ceil(limit / DETAIL_SHADES[level]))
  );
  let families = analysis.families;
  while (
    families.length > limit ||
    (families.length > minFamilies && swatchCount(families, level) > limit)
  ) {
    const previous = families;
    families = mergeFamilies(previous, analysis.oklab, previous.length - 1).map(
      // Only the family that absorbed another needs its shades redone.
      (family) =>
        previous.find(
          (p) => p.peak === family.peak && p.members.length === family.members.length
        ) ?? describeFamily(family, analysis.oklab)
    );
  }

  if (swatchCount(families, level) > limit) {
    const counts = allocateShades(families, limit, level);
    const total = analysis.oklab.length;
    families = families.map((family, i) =>
      counts[i] === family.shades[level].length
        ? family
        : {
            ...family,
            shades: {
              ...family.shades,
              [level]: splitShades(family, analysis.oklab, counts[i], total),
            },
          }
    );
  }
  return { ...analysis, families, mergedFrom: analysis.families.length };
}

// The palette entries for one Detail level: every shade of every family, in
// family order, each as { color, okL, percentage, family, shade, familyHue,
// familyChroma }. `shade` indexes the family's shades at this Detail level.
export function paletteFor(analysis, detail = "balanced") {
  const level = detail in DETAIL_SHADES ? detail : "balanced";
  return analysis.families.flatMap((family, familyIndex) =>
    family.shades[level].map((shade, shadeIndex) => ({
      color: oklabToRgb(shade.color[0], shade.color[1], shade.color[2]),
      okL: shade.color[0],
      percentage: shade.share * 100,
      family: familyIndex,
      shade: shadeIndex,
      familyHue: family.hue,
      familyChroma: family.chroma,
    }))
  );
}

export function extractPalette(
  imageData,
  width,
  height,
  { detail = "balanced", colors = "all" } = {}
) {
  return paletteFor(
    limitFamilies(analyzeImage(imageData, width, height), colors, detail),
    detail
  );
}
