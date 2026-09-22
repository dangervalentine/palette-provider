// A family only splits into shades when its lightness range (10th to 90th
// percentile) is at least this wide.
export const MIN_SHADE_SPREAD = 0.08;

// Every shade must hold at least this share of the whole image.
export const MIN_SHADE_SHARE = 0.01;

function percentile(sortedValues, p) {
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.round(p * (sortedValues.length - 1)))
  );
  return sortedValues[idx];
}

// One-dimensional k-means on lightness. Centers start at evenly spaced
// percentiles so the result is deterministic. Returns an assignment index
// per value.
function kMeans1d(values, k, iterations = 10) {
  const sorted = [...values].sort((a, b) => a - b);
  let centers = Array.from({ length: k }, (_, i) =>
    percentile(sorted, (i + 0.5) / k)
  );
  const assignment = new Array(values.length).fill(0);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < values.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = Math.abs(values[i] - centers[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignment[i] = best;
    }
    const sums = new Array(k).fill(0);
    const counts = new Array(k).fill(0);
    for (let i = 0; i < values.length; i++) {
      sums[assignment[i]] += values[i];
      counts[assignment[i]]++;
    }
    centers = centers.map((c, i) => (counts[i] === 0 ? c : sums[i] / counts[i]));
  }
  return assignment;
}

function meanOf(indices, oklabPixels) {
  const sum = [0, 0, 0];
  for (const i of indices) {
    sum[0] += oklabPixels[i][0];
    sum[1] += oklabPixels[i][1];
    sum[2] += oklabPixels[i][2];
  }
  return [sum[0] / indices.length, sum[1] / indices.length, sum[2] / indices.length];
}

// Splits a family into up to maxShades lightness shades. Returns
// [{ color, members, share }] ordered light to dark. With one shade the
// family's own color and members are returned unchanged.
export function splitShades(family, oklabPixels, maxShades, totalCount) {
  const single = [
    { color: family.color, members: family.members, share: family.share },
  ];
  if (maxShades <= 1 || family.members.length < 2) return single;

  const lightness = family.members.map((i) => oklabPixels[i][0]);
  const sorted = [...lightness].sort((a, b) => a - b);
  const spread = percentile(sorted, 0.9) - percentile(sorted, 0.1);
  if (spread < MIN_SHADE_SPREAD) return single;

  const minCount = totalCount * MIN_SHADE_SHARE;
  for (let k = maxShades; k >= 2; k--) {
    const assignment = kMeans1d(lightness, k);
    const groups = Array.from({ length: k }, () => []);
    family.members.forEach((pixelIndex, i) => {
      groups[assignment[i]].push(pixelIndex);
    });
    if (groups.some((g) => g.length < minCount)) continue;

    return groups
      .map((members) => ({
        color: meanOf(members, oklabPixels),
        members,
        share: members.length / totalCount,
      }))
      .sort((a, b) => b.color[0] - a.color[0]);
  }
  return single;
}
