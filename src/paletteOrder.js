import { rgbToOklab } from "./oklab";

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

// Colorful entries around the OKLCH hue wheel, then grays from light to dark.
function byHue(colors) {
  const withLch = colors.map((c) => {
    const [L, a, b] = rgbToOklab(...c.color);
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    return { c, L, chroma: Math.hypot(a, b), hue: (hue + 360) % 360 };
  });

  const chromatic = withLch
    .filter((x) => x.chroma >= NEUTRAL_CHROMA)
    .sort((x, y) => x.hue - y.hue);
  const neutral = withLch
    .filter((x) => x.chroma < NEUTRAL_CHROMA)
    .sort((x, y) => y.L - x.L);

  return [...chromatic, ...neutral].map((x) => x.c);
}

export function orderColors(colors, order) {
  return order === "hue" ? byHue(colors) : byPrevalence(colors);
}
