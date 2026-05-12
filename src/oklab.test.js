import { describe, it, expect } from "vitest";
import { rgbToOklab, oklabToRgb, oklabDistance } from "./oklab";

describe("rgbToOklab", () => {
  it("converts black to origin", () => {
    const [L, a, b] = rgbToOklab(0, 0, 0);
    expect(L).toBeCloseTo(0, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it("converts white to L=1", () => {
    const [L, a, b] = rgbToOklab(255, 255, 255);
    expect(L).toBeCloseTo(1, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it("converts pure red", () => {
    const [L, a, b] = rgbToOklab(255, 0, 0);
    expect(L).toBeCloseTo(0.628, 2);
    expect(a).toBeCloseTo(0.225, 2);
    expect(b).toBeCloseTo(0.126, 2);
  });

  it("converts pure green", () => {
    const [L] = rgbToOklab(0, 255, 0);
    expect(L).toBeGreaterThan(0.5);
  });

  it("converts pure blue", () => {
    const [L, a, b] = rgbToOklab(0, 0, 255);
    expect(L).toBeCloseTo(0.452, 2);
    expect(b).toBeLessThan(-0.2);
  });
});

describe("oklabToRgb", () => {
  it("converts origin to black", () => {
    expect(oklabToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("converts L=1 to white", () => {
    expect(oklabToRgb(1, 0, 0)).toEqual([255, 255, 255]);
  });

  it("round-trips pure red", () => {
    const oklab = rgbToOklab(255, 0, 0);
    const rgb = oklabToRgb(oklab[0], oklab[1], oklab[2]);
    expect(rgb[0]).toBeGreaterThanOrEqual(254);
    expect(rgb[1]).toBeLessThanOrEqual(1);
    expect(rgb[2]).toBeLessThanOrEqual(1);
  });

  it("round-trips a mid-range color", () => {
    const original = [45, 90, 123];
    const oklab = rgbToOklab(...original);
    const rgb = oklabToRgb(...oklab);
    expect(rgb[0]).toBeCloseTo(original[0], 0);
    expect(rgb[1]).toBeCloseTo(original[1], 0);
    expect(rgb[2]).toBeCloseTo(original[2], 0);
  });

  it("clamps out-of-range values to 0-255", () => {
    const rgb = oklabToRgb(1.5, 0.5, 0.5);
    rgb.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    });
  });
});

describe("oklabDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(oklabDistance([0.5, 0.1, -0.1], [0.5, 0.1, -0.1])).toBe(0);
  });

  it("returns positive distance for different colors", () => {
    const d = oklabDistance([0, 0, 0], [1, 0, 0]);
    expect(d).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = [0.6, 0.2, 0.1];
    const b = [0.4, -0.1, -0.3];
    expect(oklabDistance(a, b)).toBeCloseTo(oklabDistance(b, a), 10);
  });
});
