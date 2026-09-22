import { rgbToOklab, oklabToRgb, oklabToLch } from "./oklab";
import { findFamilies } from "./densityPeaks";
import { splitShades } from "./shades";
import { classifyTiers } from "./tierClassifier";

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

// One sample per cell of a square grid, at a hashed offset inside the cell so
// thin regular structures do not alias with the grid.
export function stratifiedSample(imageData, width, height, targetCount) {
  const gridSize = Math.ceil(Math.sqrt(targetCount));
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  const pixels = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const x = Math.min(
        Math.floor(gx * cellW + cellHash(gx, gy, 1) * cellW),
        width - 1
      );
      const y = Math.min(
        Math.floor(gy * cellH + cellHash(gx, gy, 2) * cellH),
        height - 1
      );
      const idx = (y * width + x) * 4;
      pixels.push([imageData[idx], imageData[idx + 1], imageData[idx + 2]]);
    }
  }

  return pixels;
}

export function extractPalette(
  imageData,
  width,
  height,
  { detail = "balanced" } = {}
) {
  if (width === 0 || height === 0) return [];

  const rgbPixels = stratifiedSample(imageData, width, height, TARGET_SAMPLES);
  const oklabPixels = rgbPixels.map(([r, g, b]) => rgbToOklab(r, g, b));

  const families = findFamilies(oklabPixels);
  if (families.length === 0) return [];

  // Tiers are decided per family; every shade inherits its family's tier.
  const tiered = classifyTiers(
    families.map((f) => ({ count: f.members.length }))
  );
  const maxShades = DETAIL_SHADES[detail] ?? DETAIL_SHADES.balanced;

  const entries = [];
  families.forEach((family, familyIndex) => {
    const { hue, chroma } = oklabToLch(family.color);
    const shades = splitShades(family, oklabPixels, maxShades, oklabPixels.length);
    for (const shade of shades) {
      entries.push({
        color: oklabToRgb(shade.color[0], shade.color[1], shade.color[2]),
        okL: shade.color[0],
        percentage: shade.share * 100,
        tier: tiered[familyIndex].tier,
        family: familyIndex,
        familyHue: hue,
        familyChroma: chroma,
      });
    }
  });

  return entries;
}
