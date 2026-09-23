import { describe, it, expect } from "vitest";
import {
  buildDensityMap,
  findFamilies,
  mergeFamilies,
  FAMILY_SEPARATION,
} from "./densityPeaks";
import { rgbToOklab, oklabDistance } from "./oklab";
import { seededRandom } from "./testImages";

const lab = (r, g, b) => rgbToOklab(r, g, b);

function noisy(count, base, spread, rand) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const n = rand();
    out.push(lab(base[0] + n * spread, base[1] + n * spread, base[2] + n * spread));
  }
  return out;
}

describe("buildDensityMap", () => {
  it("counts pixels per bin and sums neighbor counts into density", () => {
    const pixels = [
      [0.5, 0, 0],
      [0.5, 0, 0],
      [0.5, 0.019, 0], // same bin as above (bin width 0.02)
      [0.5, 0.021, 0], // adjacent bin
      [0.9, 0, 0], // far away
    ];
    const bins = buildDensityMap(pixels);
    const main = bins.find((b) => b.count === 3);
    const adjacent = bins.find((b) => b.count === 1 && b.density === 4);
    const far = bins.find((b) => b.count === 1 && b.density === 1);
    expect(main.density).toBe(4);
    expect(adjacent).toBeDefined();
    expect(far).toBeDefined();
    expect(main.center[0]).toBeCloseTo(0.5, 6);
  });
});

describe("findFamilies", () => {
  it("finds a 5% distinct color next to a 95% noisy one", () => {
    const rand = seededRandom(1);
    const green = noisy(9500, [40, 120, 30], 40, rand);
    const red = Array.from({ length: 500 }, () => lab(220, 30, 40));
    const families = findFamilies([...green, ...red]);

    expect(families.length).toBeGreaterThanOrEqual(2);
    expect(families.length).toBeLessThanOrEqual(3);
    const redFamily = families.find(
      (f) => oklabDistance(f.color, lab(220, 30, 40)) < 0.03
    );
    expect(redFamily).toBeDefined();
    expect(redFamily.share).toBeCloseTo(0.05, 2);
    // Largest family first
    expect(families[0].share).toBeGreaterThan(families[1].share);
  });

  it("keeps a smooth gradient to a couple of families", () => {
    const pixels = [];
    for (let i = 0; i < 2000; i++) {
      const t = i / 2000;
      pixels.push(lab(20 + t * 40, 60 + t * 60, 150 + t * 80));
    }
    const count = findFamilies(pixels).length;
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBeLessThanOrEqual(2);
  });

  it("collapses two peaks closer than the separation into one family", () => {
    const a = Array.from({ length: 500 }, () => [0.5, 0.1, 0.1]);
    const b = Array.from({ length: 500 }, () => [
      0.5 + FAMILY_SEPARATION * 0.5,
      0.1,
      0.1,
    ]);
    expect(findFamilies([...a, ...b])).toHaveLength(1);
  });

  it("absorbs isolated noise below the minimum share", () => {
    const main = Array.from({ length: 1000 }, () => [0.5, 0.1, 0.1]);
    const speck = [[0.9, -0.2, -0.2], [0.9, -0.2, -0.2]]; // 0.2% of pixels
    const families = findFamilies([...main, ...speck]);
    expect(families).toHaveLength(1);
    expect(families[0].members).toHaveLength(1002);
  });

  it("returns members as indices into the input", () => {
    const pixels = [[0.2, 0, 0], [0.2, 0, 0], [0.8, 0, 0], [0.8, 0, 0]];
    const families = findFamilies(pixels, { minShare: 0 });
    const all = families.flatMap((f) => f.members).sort((x, y) => x - y);
    expect(all).toEqual([0, 1, 2, 3]);
  });

  it("returns an empty list for no pixels", () => {
    expect(findFamilies([])).toEqual([]);
  });

  it("keeps at most maxFamilies families, by share, and reassigns the rest", () => {
    // Twenty well-separated flat colors of unequal size.
    const pixels = [];
    for (let f = 0; f < 20; f++) {
      const size = 100 + f * 10;
      const color = [0.1 + f * 0.04, (f % 2 ? 0.2 : -0.2), (f % 3) * 0.15 - 0.15];
      for (let i = 0; i < size; i++) pixels.push(color);
    }
    const families = findFamilies(pixels, { minShare: 0, maxFamilies: 5 });
    expect(families).toHaveLength(5);
    expect(families.flatMap((f) => f.members)).toHaveLength(pixels.length);
    // The five biggest colors survive: sizes 290, 280, 270, 260, 250 plus what they absorb
    for (const f of families) expect(f.members.length).toBeGreaterThanOrEqual(250);
  });

  it("keeps lightness variation of one hue in a single family", () => {
    // Same a/b, lightness spread over 0.18: one color under different light.
    // Unweighted, this span splits into two peaks.
    const pixels = Array.from({ length: 2000 }, (_, i) => [
      0.45 + (0.18 * i) / 1999,
      -0.12,
      0.1,
    ]);
    expect(findFamilies(pixels)).toHaveLength(1);
  });

  it("still separates a different hue at the same lightness", () => {
    const a = Array.from({ length: 1000 }, () => [0.5, -0.12, 0.1]);
    const b = Array.from({ length: 1000 }, () => [0.5, 0.12, 0.05]);
    expect(findFamilies([...a, ...b])).toHaveLength(2);
  });
});

// A flat family of  identical pixels, as findFamilies would return it.
function flatFamilies(specs) {
  const pixels = [];
  const families = specs.map(({ color, count }) => {
    const members = [];
    for (let i = 0; i < count; i++) members.push(pixels.push(color) - 1);
    return { peak: color, color, members };
  });
  for (const f of families) f.share = f.members.length / pixels.length;
  return { pixels, families };
}

describe("mergeFamilies", () => {
  const darkGray = [0.35, 0, 0];
  const midGray = [0.55, 0, 0];
  const lightGray = [0.75, 0, 0];
  const red = [0.6, 0.2, 0.1];

  it("returns the families unchanged when already within the limit", () => {
    const { pixels, families } = flatFamilies([
      { color: darkGray, count: 50 },
      { color: red, count: 50 },
    ]);
    expect(mergeFamilies(families, pixels, 3)).toBe(families);
  });

  it("merges shades of one color before a small distinct accent", () => {
    const { pixels, families } = flatFamilies([
      { color: darkGray, count: 400 },
      { color: midGray, count: 300 },
      { color: lightGray, count: 280 },
      { color: red, count: 20 }, // 2% accent
    ]);
    const merged = mergeFamilies(families, pixels, 2);
    expect(merged).toHaveLength(2);
    expect(merged.map((f) => f.color)).toContainEqual(red);
  });

  it("lets the larger family absorb the smaller and keep its color", () => {
    const { pixels, families } = flatFamilies([
      { color: darkGray, count: 600 },
      { color: midGray, count: 400 },
    ]);
    const [only] = mergeFamilies(families, pixels, 1);
    expect(only.color).toEqual(darkGray);
    expect(only.members).toHaveLength(1000);
    expect(only.share).toBe(1);
  });

  it("covers every sample and sorts by share", () => {
    const { pixels, families } = flatFamilies([
      { color: darkGray, count: 100 },
      { color: midGray, count: 300 },
      { color: lightGray, count: 200 },
      { color: red, count: 50 },
    ]);
    const merged = mergeFamilies(families, pixels, 2);
    const all = merged.flatMap((f) => f.members).sort((a, b) => a - b);
    expect(all).toEqual(pixels.map((_, i) => i));
    expect(merged[0].share).toBeGreaterThanOrEqual(merged[1].share);
  });

  it("does not mutate the input families", () => {
    const { pixels, families } = flatFamilies([
      { color: darkGray, count: 100 },
      { color: midGray, count: 100 },
    ]);
    mergeFamilies(families, pixels, 1);
    expect(families[0].members).toHaveLength(100);
    expect(families[1].members).toHaveLength(100);
  });
});
