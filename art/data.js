import { oklabToLch } from "../src/oklab.js";
import { analyzeImage, paletteFor } from "../src/paletteEngine.js";
import { FAMILY_SEPARATION } from "../src/densityPeaks.js";
import { rgbToHex } from "../src/colorUtils.js";
import { orderColors } from "../src/paletteOrder.js";
import { landscape } from "../src/testImages.js";

export const SAMPLE_COUNT = 10000;
export { FAMILY_SEPARATION };

// Loads art/source.jpg into a canvas. Falls back to the synthetic landscape
// so the pages render without the photo.
export async function loadSource(url = "./source.jpg") {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
  } catch {
    const { data, width, height } = landscape();
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(new ImageData(data, width, height), 0, 0);
  }
  const { width, height } = canvas;
  return { canvas, width, height, data: ctx.getImageData(0, 0, width, height).data };
}

// Everything the compositions draw, computed once from the real engine.
export function analyze(source, detail = "balanced") {
  const { data, width, height } = source;
  const analysis = analyzeImage(data, width, height);
  const families = analysis.families.map((f) => ({
    ...f,
    hex: rgbToHex(...f.rgb),
    lch: oklabToLch(f.color),
  }));
  const withHex = (e, i) => ({ ...e, key: `e${i}`, hex: rgbToHex(...e.color) });
  const entries = paletteFor(analysis, detail).map(withHex);
  // Shades of every family at each Detail level, for the shades step.
  const perDetail = {};
  for (const d of ["essential", "balanced", "rich"]) perDetail[d] = paletteFor(analysis, d).map(withHex);
  return {
    analysis,
    points: analysis.points,
    lab: analysis.oklab,
    families,
    entries,
    perDetail,
    byPrevalence: orderColors(entries, "prevalence"),
    byFamily: orderColors(entries, "family"),
    width,
    height,
  };
}

// Density of chromatic samples around the hue wheel, smoothed, normalized to 1.
export function hueDensity(lab, binCount = 72) {
  const raw = new Array(binCount).fill(0);
  for (const p of lab) {
    const { chroma, hue } = oklabToLch(p);
    if (chroma < 0.03) continue;
    raw[Math.floor((hue / 360) * binCount) % binCount] += 1;
  }
  const smooth = raw.map((_, i) => {
    let s = 0;
    for (let k = -2; k <= 2; k++) s += raw[(i + k + binCount) % binCount] * (3 - Math.abs(k));
    return s / 9;
  });
  const max = Math.max(...smooth, 1);
  return smooth.map((v) => v / max);
}
