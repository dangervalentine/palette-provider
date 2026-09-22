import { describe, it, expect } from "vitest";
import { splitShades, MIN_SHADE_SPREAD } from "./shades";

// A family whose members' lightness runs evenly from lo to hi.
function family(count, lo, hi) {
  const pixels = Array.from({ length: count }, (_, i) => [
    lo + ((hi - lo) * i) / (count - 1),
    0.1,
    0.05,
  ]);
  const members = pixels.map((_, i) => i);
  const color = [(lo + hi) / 2, 0.1, 0.05];
  return { pixels, family: { peak: color, color, members, share: 1 } };
}

describe("splitShades", () => {
  it("returns the family as one shade when maxShades is 1", () => {
    const { pixels, family: fam } = family(100, 0.2, 0.8);
    const shades = splitShades(fam, pixels, 1, pixels.length);
    expect(shades).toHaveLength(1);
    expect(shades[0].color).toEqual(fam.color);
    expect(shades[0].members).toBe(fam.members);
    expect(shades[0].share).toBe(1);
  });

  it("does not split a family with narrow lightness spread", () => {
    const { pixels, family: fam } = family(100, 0.5, 0.5 + MIN_SHADE_SPREAD / 2);
    expect(splitShades(fam, pixels, 3, pixels.length)).toHaveLength(1);
  });

  it("splits a wide family into maxShades shades, light to dark", () => {
    const { pixels, family: fam } = family(300, 0.2, 0.8);
    const shades = splitShades(fam, pixels, 3, pixels.length);
    expect(shades).toHaveLength(3);
    expect(shades[0].color[0]).toBeGreaterThan(shades[1].color[0]);
    expect(shades[1].color[0]).toBeGreaterThan(shades[2].color[0]);
    const total = shades.reduce((s, sh) => s + sh.share, 0);
    expect(total).toBeCloseTo(fam.share, 6);
    const memberCount = shades.reduce((s, sh) => s + sh.members.length, 0);
    expect(memberCount).toBe(300);
  });

  it("uses fewer shades when a split would create a shade under the minimum share", () => {
    // 300 family pixels in an image of 10,000: the family is 3%. Three shades
    // would be about 1% each, but the light end is sparse, so a three-way
    // split leaves one shade under 1% of the image.
    const dense = Array.from({ length: 280 }, (_, i) => [0.2 + (0.3 * i) / 279, 0.1, 0.05]);
    const sparse = Array.from({ length: 20 }, (_, i) => [0.75 + (0.05 * i) / 19, 0.1, 0.05]);
    const pixels = [...dense, ...sparse];
    const fam = {
      peak: [0.35, 0.1, 0.05],
      color: [0.35, 0.1, 0.05],
      members: pixels.map((_, i) => i),
      share: 0.03,
    };
    const shades = splitShades(fam, pixels, 3, 10000);
    expect(shades.length).toBeLessThan(3);
    expect(shades.length).toBeGreaterThanOrEqual(1);
    for (const shade of shades) {
      expect(shade.members.length / 10000).toBeGreaterThanOrEqual(0.01);
    }
  });
});
