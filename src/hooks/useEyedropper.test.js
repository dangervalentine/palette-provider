import { describe, it, expect } from "vitest";
import { mapToCanvasCoords, samplePixel } from "./useEyedropper";

describe("mapToCanvasCoords", () => {
  it("maps event coords to canvas pixel space", () => {
    const imgRect = { left: 100, top: 50, width: 400, height: 300 };
    const canvas = { width: 800, height: 600 };
    const result = mapToCanvasCoords(300, 200, imgRect, canvas);
    // (300 - 100) / 400 * 800 = 400
    // (200 - 50) / 300 * 600 = 300
    expect(result).toEqual({ x: 400, y: 300 });
  });

  it("clamps to canvas bounds", () => {
    const imgRect = { left: 0, top: 0, width: 200, height: 200 };
    const canvas = { width: 100, height: 100 };
    // event at (-10, 250) should clamp to (0, 99)
    const result = mapToCanvasCoords(-10, 250, imgRect, canvas);
    expect(result).toEqual({ x: 0, y: 99 });
  });
});

describe("samplePixel", () => {
  it("reads the correct pixel from canvas context", () => {
    const fakeCtx = {
      getImageData: (x, y, w, h) => ({
        data: new Uint8ClampedArray([120, 200, 55, 255]),
      }),
    };
    const result = samplePixel(fakeCtx, 10, 20);
    expect(result).toEqual([120, 200, 55]);
  });
});
