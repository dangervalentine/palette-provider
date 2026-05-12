import { describe, it, expect } from "vitest";
import { medianCut, DETAIL_CONFIG } from "./medianCut";

describe("medianCut", () => {
  it("returns a single bucket for identical pixels", () => {
    const pixels = Array.from({ length: 100 }, () => [0.5, 0.1, -0.1]);
    const result = medianCut(pixels, "essential");
    expect(result).toHaveLength(1);
    expect(result[0].center[0]).toBeCloseTo(0.5, 5);
    expect(result[0].count).toBe(100);
  });

  it("splits two distinct color groups", () => {
    const red = Array.from({ length: 50 }, () => [0.63, 0.22, 0.13]);
    const blue = Array.from({ length: 50 }, () => [0.45, -0.03, -0.31]);
    const result = medianCut([...red, ...blue], "essential");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("produces more buckets with higher detail", () => {
    const pixels = [];
    for (let i = 0; i < 1000; i++) {
      pixels.push([Math.random(), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6]);
    }
    const essential = medianCut(pixels, "essential");
    const rich = medianCut(pixels, "rich");
    expect(rich.length).toBeGreaterThanOrEqual(essential.length);
  });

  it("bucket counts sum to total pixel count", () => {
    const pixels = Array.from({ length: 200 }, () => [
      Math.random(),
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
    ]);
    const result = medianCut(pixels, "balanced");
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(200);
  });

  it("each bucket has a center array of length 3", () => {
    const pixels = Array.from({ length: 100 }, () => [0.5, 0.0, 0.0]);
    const result = medianCut(pixels, "balanced");
    result.forEach((bucket) => {
      expect(bucket.center).toHaveLength(3);
      expect(typeof bucket.center[0]).toBe("number");
    });
  });

  it("returns empty array for empty input", () => {
    expect(medianCut([], "essential")).toEqual([]);
  });
});

describe("DETAIL_CONFIG", () => {
  it("has essential, balanced, and rich presets", () => {
    expect(DETAIL_CONFIG).toHaveProperty("essential");
    expect(DETAIL_CONFIG).toHaveProperty("balanced");
    expect(DETAIL_CONFIG).toHaveProperty("rich");
  });

  it("essential has lower maxDepth than rich", () => {
    expect(DETAIL_CONFIG.essential.maxDepth).toBeLessThan(DETAIL_CONFIG.rich.maxDepth);
  });
});
