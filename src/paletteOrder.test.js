import { describe, it, expect } from "vitest";
import { orderColors } from "./paletteOrder";
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
  };
}

function sampled(key, color) {
  return { key, color, okL: rgbToOklab(...color)[0] };
}

describe("orderColors by family", () => {
  it("orders families around the hue wheel", () => {
    const colors = [
      extracted("blue", [0, 0, 255], 0),
      extracted("red", [255, 0, 0], 1),
      extracted("green", [0, 200, 0], 2),
    ];
    expect(orderColors(colors, "family").map((c) => c.key)).toEqual([
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
    expect(orderColors(colors, "family").map((c) => c.key)).toEqual([
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
    expect(orderColors(colors, "family").map((c) => c.key)).toEqual([
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
    expect(orderColors(colors, "family").map((c) => c.key)).toEqual([
      "s-red",
      "s-yellow",
      "s-blue",
      "s-gray",
    ]);
  });

  it("does not modify the input", () => {
    const colors = [extracted("b", [0, 0, 255], 0), extracted("r", [255, 0, 0], 1)];
    orderColors(colors, "family");
    expect(colors.map((c) => c.key)).toEqual(["b", "r"]);
  });
});
