import { rgbToOklab, oklabToLch } from "./oklab";

export const ORDERS = ["prevalence", "family"];

// Below this OKLCH chroma a color reads as gray, and its hue is noise.
export const NEUTRAL_CHROMA = 0.03;

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

// Shades of one family side by side: families around the hue wheel, grays
// last from light to dark, and within a family shades from light to dark.
// Entries without a family (eyedropper samples) each count as their own
// family, placed by their own hue. A family's hue and chroma are read from the
// first entry seen for it; the engine sets the same values on every shade.
function byFamily(colors) {
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

export function orderColors(colors, order) {
  return order === "family" ? byFamily(colors) : byPrevalence(colors);
}
