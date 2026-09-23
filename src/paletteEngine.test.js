import { describe, it, expect } from "vitest";
import { extractPalette, analyzeImage, paletteFor, stratifiedSample, samplePoints } from "./paletteEngine";
import { rgbToOklab, oklabDistance } from "./oklab";
import {
  makeImageData,
  greenWithRed,
  blueWithYellowMagenta,
  sandWithTeal,
  landscape,
} from "./testImages";

const DETAILS = ["essential", "balanced", "rich"];
const MAX_SHADES = { essential: 1, balanced: 2, rich: 3 };

// Entries whose OKLCH hue is within `tol` degrees of `hue` and that are not gray.
function withHue(result, hue, tol = 20) {
  return result.filter((c) => {
    const [, a, b] = rgbToOklab(...c.color);
    if (Math.hypot(a, b) < 0.03) return false;
    const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    const diff = Math.abs(((h - hue + 540) % 360) - 180);
    return diff <= tol;
  });
}

describe("stratifiedSample", () => {
  it("returns gridSize squared pixels", () => {
    const data = new Uint8ClampedArray(100 * 100 * 4);
    const result = stratifiedSample(data, 100, 100, 500);
    const gridSize = Math.ceil(Math.sqrt(500));
    expect(result).toHaveLength(gridSize * gridSize);
  });

  it("returns valid RGB tuples", () => {
    const data = new Uint8ClampedArray(50 * 50 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 64;
      data[i + 2] = 32;
      data[i + 3] = 255;
    }
    for (const [r, g, b] of stratifiedSample(data, 50, 50, 100)) {
      expect([r, g, b]).toEqual([128, 64, 32]);
    }
  });

  it("is deterministic", () => {
    const data = new Uint8ClampedArray(60 * 40 * 4).map((_, i) => i % 251);
    expect(stratifiedSample(data, 60, 40, 300)).toEqual(
      stratifiedSample(data, 60, 40, 300)
    );
  });

  it("samplePoints returns in-bounds coordinates that stratifiedSample reads", () => {
    const w = 37;
    const h = 23;
    const data = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 7) % 256);
    const points = samplePoints(w, h, 200);
    expect(points).toHaveLength(Math.ceil(Math.sqrt(200)) ** 2);
    for (const { x, y } of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(h);
    }
    const viaPoints = points.map(({ x, y }) => {
      const i = (y * w + x) * 4;
      return [data[i], data[i + 1], data[i + 2]];
    });
    expect(stratifiedSample(data, w, h, 200)).toEqual(viaPoints);
  });

  it("samples thin stripes on even coordinates that a center-only grid would miss", () => {
    // 200x200 image, 10k samples: cells are 2px, so exact centers land only
    // on odd coordinates. Rows at y % 50 === 0 are all even.
    const { data, width, height } = blueWithYellowMagenta();
    const samples = stratifiedSample(data, width, height, 10000);
    const yellow = samples.filter(([r, g, b]) => r === 250 && g === 220 && b === 40);
    expect(yellow.length).toBeGreaterThan(100);
  });
});

describe("extractPalette shape", () => {
  it("returns entries with the fields the UI needs", () => {
    const pixels = Array.from({ length: 100 }, () => [100, 150, 200]);
    const result = extractPalette(makeImageData(pixels, 10, 10), 10, 10);
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.color).toHaveLength(3);
      expect(typeof c.okL).toBe("number");
      expect(typeof c.percentage).toBe("number");
      expect(typeof c.family).toBe("number");
      expect(typeof c.familyHue).toBe("number");
      expect(typeof c.familyChroma).toBe("number");
    }
  });

  it("returns an empty list for an empty image", () => {
    expect(extractPalette(new Uint8ClampedArray(0), 0, 0)).toEqual([]);
  });

  it("percentages sum to about 100", () => {
    const pixels = Array.from({ length: 400 }, (_, i) =>
      i < 200 ? [255, 0, 0] : [0, 255, 0]
    );
    const result = extractPalette(makeImageData(pixels, 20, 20), 20, 20);
    const total = result.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("extracts two colors from a half-red half-blue image", () => {
    const pixels = [];
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) pixels.push(x < 10 ? [255, 0, 0] : [0, 0, 255]);
    }
    const result = extractPalette(makeImageData(pixels, 20, 20), 20, 20, {
      detail: "essential",
    });
    expect(result).toHaveLength(2);
    expect(result.some((c) => c.color[0] > 200)).toBe(true);
    expect(result.some((c) => c.color[2] > 200)).toBe(true);
  });

  it("is deterministic", () => {
    const { data, width, height } = landscape();
    expect(extractPalette(data, width, height, { detail: "rich" })).toEqual(
      extractPalette(data, width, height, { detail: "rich" })
    );
  });

  it("gives every shade its family's hue and chroma", () => {
    const { data, width, height } = landscape();
    const { families } = analyzeImage(data, width, height);
    for (const c of extractPalette(data, width, height, { detail: "rich" })) {
      expect(c.familyHue).toBe(families[c.family].hue);
      expect(c.familyChroma).toBe(families[c.family].chroma);
    }
  });
});

describe("analyzeImage", () => {
  it("reads one sample per grid point", () => {
    const { data, width, height } = landscape();
    const a = analyzeImage(data, width, height);
    expect(a.oklab).toHaveLength(a.points.length);
    expect(a.oklab[0]).toEqual(rgbToOklab(...stratifiedSample(data, width, height, 10000)[0]));
  });

  it("gives the same palette as extractPalette at every Detail level", () => {
    const { data, width, height } = landscape();
    const a = analyzeImage(data, width, height);
    for (const detail of DETAILS) {
      expect(paletteFor(a, detail)).toEqual(extractPalette(data, width, height, { detail }));
    }
  });

  it("returns families sorted by share whose members cover every sample", () => {
    const { data, width, height } = landscape();
    const a = analyzeImage(data, width, height);
    const shares = a.families.map((f) => f.share);
    expect(shares).toEqual([...shares].sort((x, y) => y - x));
    const members = a.families.flatMap((f) => f.members);
    expect(new Set(members).size).toBe(a.oklab.length);
  });

  it("returns empty results for an empty image", () => {
    expect(analyzeImage(new Uint8ClampedArray(0), 0, 0)).toEqual({ points: [], oklab: [], families: [] });
  });
});

describe("extractPalette faithfulness", () => {
  it.each(DETAILS)("every color at %s is close to a real sampled pixel", (detail) => {
    const { data, width, height } = blueWithYellowMagenta();
    const samples = stratifiedSample(data, width, height, 10000).map((p) =>
      rgbToOklab(...p)
    );
    const result = extractPalette(data, width, height, { detail });
    for (const c of result) {
      const lab = rgbToOklab(...c.color);
      const nearest = Math.min(...samples.map((s) => oklabDistance(s, lab)));
      expect(nearest).toBeLessThan(0.05);
    }
  });
});

describe("extractPalette regressions", () => {
  it.each(DETAILS)("green + 5%% red at %s keeps the red and limits the greens", (detail) => {
    const { data, width, height } = greenWithRed();
    const result = extractPalette(data, width, height, { detail });
    const reds = withHue(result, 26);
    expect(reds).toHaveLength(1);
    expect(reds[0].percentage).toBeGreaterThan(3);
    expect(reds[0].percentage).toBeLessThan(8);
    const greenFamilies = new Set(withHue(result, 142).map((c) => c.family));
    expect(greenFamilies.size).toBeLessThanOrEqual(2);
    expect(withHue(result, 142).length).toBeLessThanOrEqual(2 * MAX_SHADES[detail]);
  });

  it.each(DETAILS)("blue + yellow + magenta at %s keeps both accents unblended", (detail) => {
    const { data, width, height } = blueWithYellowMagenta();
    const result = extractPalette(data, width, height, { detail });
    expect(withHue(result, 99, 10)).toHaveLength(1); // yellow
    expect(withHue(result, 336, 10)).toHaveLength(1); // magenta
    expect(withHue(result, 19, 8)).toHaveLength(0); // the old fake pink
  });

  it.each(DETAILS)("sand + scattered teal at %s yields one teal family", (detail) => {
    const { data, width, height } = sandWithTeal();
    const result = extractPalette(data, width, height, { detail });
    const teal = withHue(result, 199, 15);
    expect(new Set(teal.map((c) => c.family)).size).toBe(1);
    expect(teal.length).toBeLessThanOrEqual(MAX_SHADES[detail]);
  });

  it.each(DETAILS)("landscape at %s keeps the orange roof and white cloud", (detail) => {
    const { data, width, height } = landscape();
    const result = extractPalette(data, width, height, { detail });
    expect(withHue(result, 53, 12).length).toBeGreaterThanOrEqual(1);
    const whites = result.filter((c) => c.okL > 0.95);
    expect(whites).toHaveLength(1);
  });
});
