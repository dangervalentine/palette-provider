import { describe, it, expect } from "vitest";
import { orderColors, orderWithinTier } from "./paletteOrder";
import { rgbToOklab, oklabToLch } from "./oklab";

const entry = (key, color, percentage) => ({ key, color, percentage });

describe("orderColors by prevalence", () => {
  it("sorts extracted colors by share, largest first", () => {
    const colors = [
      entry("small", [0, 0, 255], 10),
      entry("big", [255, 0, 0], 60),
      entry("mid", [0, 255, 0], 30),
    ];
    expect(orderColors(colors, "prevalence").map((c) => c.key)).toEqual([
      "big",
      "mid",
      "small",
    ]);
  });

  it("puts sampled colors last, in the order they were picked", () => {
    const colors = [
      entry("sampled-a", [10, 10, 10]),
      entry("extracted", [255, 0, 0], 5),
      entry("sampled-b", [20, 20, 20]),
    ];
    expect(orderColors(colors, "prevalence").map((c) => c.key)).toEqual([
      "extracted",
      "sampled-a",
      "sampled-b",
    ]);
  });
});

describe("orderColors by hue", () => {
  it("walks the hue wheel: red, yellow, green, blue, purple", () => {
    const colors = [
      entry("blue", [0, 0, 255]),
      entry("green", [0, 200, 0]),
      entry("purple", [150, 0, 200]),
      entry("red", [255, 0, 0]),
      entry("yellow", [240, 220, 0]),
    ];
    expect(orderColors(colors, "hue").map((c) => c.key)).toEqual([
      "red",
      "yellow",
      "green",
      "blue",
      "purple",
    ]);
  });

  it("puts grays after colorful entries, light to dark", () => {
    const colors = [
      entry("black", [0, 0, 0]),
      entry("red", [255, 0, 0]),
      entry("white", [255, 255, 255]),
      entry("gray", [128, 128, 128]),
    ];
    expect(orderColors(colors, "hue").map((c) => c.key)).toEqual([
      "red",
      "white",
      "gray",
      "black",
    ]);
  });

  it("places sampled colors by hue among the extracted ones", () => {
    const colors = [
      entry("extracted-red", [255, 0, 0], 50),
      entry("extracted-blue", [0, 0, 255], 40),
      entry("sampled-green", [0, 200, 0]),
    ];
    expect(orderColors(colors, "hue").map((c) => c.key)).toEqual([
      "extracted-red",
      "sampled-green",
      "extracted-blue",
    ]);
  });

  it("does not modify the input", () => {
    const colors = [entry("b", [0, 0, 255]), entry("r", [255, 0, 0])];
    orderColors(colors, "hue");
    expect(colors.map((c) => c.key)).toEqual(["b", "r"]);
  });
});

// An extracted entry as the engine produces it.
function extracted(key, color, family, okL) {
  const lab = rgbToOklab(...color);
  const { hue, chroma } = oklabToLch(lab);
  return {
    key,
    color,
    family,
    familyHue: hue,
    familyChroma: chroma,
    okL: okL ?? lab[0],
    percentage: 10,
    tier: "supporting",
  };
}

function sampled(key, color) {
  return { key, color, tier: "sampled", okL: rgbToOklab(...color)[0] };
}

describe("orderWithinTier", () => {
  it("orders families around the hue wheel", () => {
    const colors = [
      extracted("blue", [0, 0, 255], 0),
      extracted("red", [255, 0, 0], 1),
      extracted("green", [0, 200, 0], 2),
    ];
    expect(orderWithinTier(colors).map((c) => c.key)).toEqual([
      "red",
      "green",
      "blue",
    ]);
  });

  it("keeps a family's shades together, light to dark, by the family hue", () => {
    const colors = [
      extracted("red-dark", [120, 0, 0], 0),
      extracted("green", [0, 200, 0], 1),
      extracted("red-light", [255, 150, 150], 0),
    ];
    // Both reds share family 0, so they sit together even though the light
    // red's own hue differs from the family hue.
    expect(orderWithinTier(colors).map((c) => c.key)).toEqual([
      "red-light",
      "red-dark",
      "green",
    ]);
  });

  it("puts gray families after colorful ones, light to dark", () => {
    const colors = [
      extracted("black", [0, 0, 0], 0),
      extracted("red", [255, 0, 0], 1),
      extracted("white", [255, 255, 255], 2),
      extracted("gray", [128, 128, 128], 3),
    ];
    expect(orderWithinTier(colors).map((c) => c.key)).toEqual([
      "red",
      "white",
      "gray",
      "black",
    ]);
  });

  it("orders sampled colors, which have no family, by their own hue", () => {
    const colors = [
      sampled("s-blue", [0, 0, 255]),
      sampled("s-red", [255, 0, 0]),
      sampled("s-gray", [128, 128, 128]),
      sampled("s-yellow", [240, 220, 0]),
    ];
    expect(orderWithinTier(colors).map((c) => c.key)).toEqual([
      "s-red",
      "s-yellow",
      "s-blue",
      "s-gray",
    ]);
  });

  it("does not modify the input", () => {
    const colors = [extracted("b", [0, 0, 255], 0), extracted("r", [255, 0, 0], 1)];
    orderWithinTier(colors);
    expect(colors.map((c) => c.key)).toEqual(["b", "r"]);
  });
});
