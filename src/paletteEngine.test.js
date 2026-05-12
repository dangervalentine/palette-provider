import { describe, it, expect } from "vitest";
import { extractPalette, stratifiedSample } from "./paletteEngine";

function makeImageData(pixels, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i * 4;
      const [r, g, b] = pixels[i] || [0, 0, 0];
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  return data;
}

describe("stratifiedSample", () => {
  it("returns roughly targetCount pixels", () => {
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
    const result = stratifiedSample(data, 50, 50, 100);
    result.forEach(([r, g, b]) => {
      expect(r).toBe(128);
      expect(g).toBe(64);
      expect(b).toBe(32);
    });
  });
});

describe("extractPalette", () => {
  it("extracts two colors from a half-red half-blue image", () => {
    const w = 20;
    const h = 20;
    const pixels = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        pixels.push(x < w / 2 ? [255, 0, 0] : [0, 0, 255]);
      }
    }
    const imageData = makeImageData(pixels, w, h);
    const result = extractPalette(imageData, w, h, {
      mode: "faithful",
      detail: "essential",
    });
    expect(result.length).toBeGreaterThanOrEqual(2);
    const reds = result.filter((c) => c.color[0] > 200);
    const blues = result.filter((c) => c.color[2] > 200);
    expect(reds.length).toBeGreaterThanOrEqual(1);
    expect(blues.length).toBeGreaterThanOrEqual(1);
  });

  it("returns colors with tier and percentage", () => {
    const w = 10;
    const h = 10;
    const pixels = Array.from({ length: w * h }, () => [100, 150, 200]);
    const imageData = makeImageData(pixels, w, h);
    const result = extractPalette(imageData, w, h);
    result.forEach((c) => {
      expect(c).toHaveProperty("color");
      expect(c).toHaveProperty("tier");
      expect(c).toHaveProperty("percentage");
      expect(c).toHaveProperty("okL");
      expect(c.color).toHaveLength(3);
    });
  });

  it("percentages sum to ~100", () => {
    const w = 20;
    const h = 20;
    const pixels = [];
    for (let i = 0; i < w * h; i++) {
      pixels.push(i < 200 ? [255, 0, 0] : [0, 255, 0]);
    }
    const imageData = makeImageData(pixels, w, h);
    const result = extractPalette(imageData, w, h);
    const total = result.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it("design mode merges similar colors", () => {
    const w = 20;
    const h = 20;
    const pixels = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < 7) pixels.push([255, 0, 0]);
        else if (x < 14) pixels.push([250, 5, 5]);
        else pixels.push([0, 0, 255]);
      }
    }
    const imageData = makeImageData(pixels, w, h);
    const faithful = extractPalette(imageData, w, h, { mode: "faithful", detail: "balanced" });
    const design = extractPalette(imageData, w, h, { mode: "design", detail: "balanced" });
    expect(design.length).toBeLessThanOrEqual(faithful.length);
  });

  it("complete mode captures outlier colors", () => {
    const w = 20;
    const h = 20;
    const pixels = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (y === 0 && x < 3) pixels.push([0, 255, 0]);
        else if (x < w / 2) pixels.push([255, 0, 0]);
        else pixels.push([0, 0, 255]);
      }
    }
    const imageData = makeImageData(pixels, w, h);
    const faithful = extractPalette(imageData, w, h, { mode: "faithful", detail: "balanced" });
    const complete = extractPalette(imageData, w, h, { mode: "complete", detail: "balanced" });
    expect(complete.length).toBeGreaterThanOrEqual(faithful.length);
  });
});
