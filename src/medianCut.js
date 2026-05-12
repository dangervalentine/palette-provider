export const DETAIL_CONFIG = {
  essential: { maxDepth: 3, minBucketFraction: 0.04 },
  balanced: { maxDepth: 4, minBucketFraction: 0.01 },
  rich: { maxDepth: 5, minBucketFraction: 0.005 },
};

function computeLeaf(pixels) {
  const center = [0, 0, 0];
  for (const p of pixels) {
    center[0] += p[0];
    center[1] += p[1];
    center[2] += p[2];
  }
  center[0] /= pixels.length;
  center[1] /= pixels.length;
  center[2] /= pixels.length;
  return { center, count: pixels.length };
}

export function medianCut(oklabPixels, detail) {
  if (oklabPixels.length === 0) return [];

  const config = DETAIL_CONFIG[detail];
  const minBucketSize = Math.max(
    1,
    Math.floor(oklabPixels.length * config.minBucketFraction)
  );

  function split(pixels, depth) {
    if (depth >= config.maxDepth || pixels.length <= minBucketSize) {
      return [computeLeaf(pixels)];
    }

    let maxRange = 0;
    let splitAxis = 0;
    for (let axis = 0; axis < 3; axis++) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const p of pixels) {
        if (p[axis] < lo) lo = p[axis];
        if (p[axis] > hi) hi = p[axis];
      }
      const range = hi - lo;
      if (range > maxRange) {
        maxRange = range;
        splitAxis = axis;
      }
    }

    if (maxRange === 0) return [computeLeaf(pixels)];

    pixels.sort((a, b) => a[splitAxis] - b[splitAxis]);
    const mid = Math.floor(pixels.length / 2);

    return [
      ...split(pixels.slice(0, mid), depth + 1),
      ...split(pixels.slice(mid), depth + 1),
    ];
  }

  return split([...oklabPixels], 0);
}
