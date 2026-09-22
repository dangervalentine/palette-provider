import { rgbToOklab, oklabToLch } from "./oklab";

export const ORDERS = ["prevalence", "hue"];

// Below this OKLCH chroma a color reads as gray, and its hue is noise.
const NEUTRAL_CHROMA = 0.03;

// Extracted colors by share of the image, largest first. Sampled colors have no
// share, so they follow in the order they were picked (the sort is stable).
function byPrevalence(colors) {
  return [...colors].sort(
    (a, b) => (b.percentage ?? -1) - (a.percentage ?? -1)
  );
}

// Colorful items around the hue wheel, then grays from light to dark. Each
// item is { L, chroma, hue, ...anything }.
function hueWheelOrder(items) {
  const chromatic = items
    .filter((x) => x.chroma >= NEUTRAL_CHROMA)
    .sort((x, y) => x.hue - y.hue);
  const neutral = items
    .filter((x) => x.chroma < NEUTRAL_CHROMA)
    .sort((x, y) => y.L - x.L);
  return [...chromatic, ...neutral];
}

// Colorful entries around the OKLCH hue wheel, then grays from light to dark.
function byHue(colors) {
  const items = colors.map((c) => ({ c, ...oklabToLch(rgbToOklab(...c.color)) }));
  return hueWheelOrder(items).map((x) => x.c);
}

export function orderColors(colors, order) {
  return order === "hue" ? byHue(colors) : byPrevalence(colors);
}

// Order for the chips inside one tier: families around the hue wheel, grays
// last from light to dark, and within a family shades from light to dark.
// Entries without a family (eyedropper samples) each count as their own
// family, placed by their own hue. A family's hue and chroma are read from the
// first entry seen for it; the engine sets the same values on every shade.
export function orderWithinTier(colors) {
  const groups = new Map();
  colors.forEach((c, i) => {
    const key = c.family ?? `single-${i}`;
    if (!groups.has(key)) {
      const lch =
        c.familyHue !== undefined
          ? { hue: c.familyHue, chroma: c.familyChroma }
          : oklabToLch(rgbToOklab(...c.color));
      groups.set(key, { hue: lch.hue, chroma: lch.chroma, shades: [] });
    }
    groups.get(key).shades.push(c);
  });

  const families = [...groups.values()].map((g) => {
    const shades = [...g.shades].sort((a, b) => b.okL - a.okL);
    const L = shades.reduce((sum, s) => sum + s.okL, 0) / shades.length;
    return { ...g, shades, L };
  });

  return hueWheelOrder(families).flatMap((f) => f.shades);
}
