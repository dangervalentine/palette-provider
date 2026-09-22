import { describe, it, expect } from "vitest";
import { orderColors } from "./paletteOrder";

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
