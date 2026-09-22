// Synthetic images for extraction tests. Every builder is deterministic.

export function makeImageData(pixels, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = pixels[i] || [0, 0, 0];
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

// Linear congruential generator so noise is the same on every run.
export function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Builds a width x height image from a per-pixel function (x, y, rand) => [r, g, b].
export function buildImage(width, height, fn, seed = 42) {
  const rand = seededRandom(seed);
  const pixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push(fn(x, y, rand));
    }
  }
  return { data: makeImageData(pixels, width, height), width, height };
}

export const SIZE = 200;

// 95% noisy green, 5% flat red block in the bottom-right corner.
export const greenWithRed = () =>
  buildImage(SIZE, SIZE, (x, y, rand) => {
    if (x >= 155 && y >= 155) return [220, 30, 40];
    const n = rand();
    return [40 + n * 40, 120 + n * 60, 30 + n * 40];
  });

// 92% blue gradient, ~4% yellow rows, ~4% magenta columns, 2px thick.
export const blueWithYellowMagenta = () =>
  buildImage(SIZE, SIZE, (x, y) => {
    if (y % 50 < 2) return [250, 220, 40];
    if (x % 50 < 2) return [230, 40, 200];
    const t = x / SIZE;
    return [20 + t * 40, 60 + t * 60, 150 + t * 80];
  });

// 95% noisy sand, 5% scattered noisy teal dots.
export const sandWithTeal = () =>
  buildImage(SIZE, SIZE, (x, y, rand) => {
    const n = rand();
    if ((x * 7 + y * 13) % 20 === 0) {
      return [20 + n * 30, 150 + n * 40, 160 + n * 30];
    }
    return [200 + n * 40, 170 + n * 40, 120 + n * 40];
  });

// Sky gradient (top 40%), dark green trees (35%), brown ground (25%),
// a 1.4% orange roof and a 0.9% white cloud.
export const landscape = () =>
  buildImage(SIZE, SIZE, (x, y, rand) => {
    const n = rand();
    if (y < 80) {
      if (x > 60 && x < 100 && y > 20 && y < 30) {
        return [245 + n * 10, 245 + n * 10, 250];
      }
      const t = y / 80;
      return [110 + t * 60 + n * 10, 160 + t * 40 + n * 10, 230 - t * 20 + n * 10];
    }
    if (y < 150) {
      if (x > 120 && x < 160 && y > 90 && y < 105) {
        return [225 + n * 20, 110 + n * 30, 30 + n * 20];
      }
      return [25 + n * 30, 70 + n * 40, 30 + n * 20];
    }
    return [110 + n * 40, 80 + n * 30, 50 + n * 20];
  });
