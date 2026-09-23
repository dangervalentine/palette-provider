// Histogram cell width on each OKLAB axis. Roughly one just-noticeable
// difference, so a bin never straddles two colors a person would separate.
export const BIN_SIZE = 0.02;

// Two colors at least this far apart in OKLAB, with lightness weighted down,
// read as different colors, not shades of one color. This is the main tuning
// knob for how many families an image yields.
export const FAMILY_SEPARATION = 0.1;

// Families holding less of the image than this are treated as noise.
export const MIN_FAMILY_SHARE = 0.005;

// Busy images can yield dozens of families that each barely clear the minimum
// share. Keep only the largest this many; the rest join their nearest neighbor.
export const MAX_FAMILIES = 12;

// Lightness counts half as much as hue and chroma when deciding whether two
// colors are the same family. A family is a color; its lightness variation
// becomes shades.
export const LIGHTNESS_WEIGHT = 0.5;

function familyDistance(a, b) {
  const dL = (a[0] - b[0]) * LIGHTNESS_WEIGHT;
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

const key = (ix, iy, iz) => `${ix},${iy},${iz}`;

// Sparse 3D histogram of the samples. Each bin's density is its own count
// plus the counts of its 26 neighbors, which smooths sampling noise.
export function buildDensityMap(oklabPixels, binSize = BIN_SIZE) {
  const bins = new Map();
  for (const p of oklabPixels) {
    const ix = Math.floor(p[0] / binSize);
    const iy = Math.floor(p[1] / binSize);
    const iz = Math.floor(p[2] / binSize);
    const k = key(ix, iy, iz);
    let bin = bins.get(k);
    if (!bin) {
      bin = { ix, iy, iz, count: 0, sum: [0, 0, 0] };
      bins.set(k, bin);
    }
    bin.count++;
    bin.sum[0] += p[0];
    bin.sum[1] += p[1];
    bin.sum[2] += p[2];
  }

  const result = [];
  for (const bin of bins.values()) {
    let density = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const n = bins.get(key(bin.ix + dx, bin.iy + dy, bin.iz + dz));
          if (n) density += n.count;
        }
      }
    }
    result.push({
      count: bin.count,
      density,
      center: [
        bin.sum[0] / bin.count,
        bin.sum[1] / bin.count,
        bin.sum[2] / bin.count,
      ],
    });
  }
  return result;
}

// Every pixel joins its nearest peak. Returns one { peak, members } per peak,
// where members are indices into oklabPixels.
function assignToPeaks(oklabPixels, peaks) {
  const families = peaks.map((peak) => ({ peak, members: [] }));
  for (let i = 0; i < oklabPixels.length; i++) {
    let best = 0;
    let bestDist = Infinity;
    for (let f = 0; f < peaks.length; f++) {
      const d = familyDistance(oklabPixels[i], peaks[f]);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    families[best].members.push(i);
  }
  return families;
}

// Mean of the members close to the peak. Members near the basin edge are
// transitional pixels; leaving them out keeps the color faithful.
function coreColor(family, oklabPixels, radius) {
  const sum = [0, 0, 0];
  let n = 0;
  for (const i of family.members) {
    const p = oklabPixels[i];
    if (familyDistance(p, family.peak) <= radius) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
      n++;
    }
  }
  if (n === 0) return [...family.peak];
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

// Finds the image's color families: density peaks in OKLAB that are at least
// `separation` apart, capped at `maxFamilies` by share. Returns families
// sorted by share, largest first, each as { peak, color, members, share }.
export function findFamilies(oklabPixels, options = {}) {
  const {
    separation = FAMILY_SEPARATION,
    minShare = MIN_FAMILY_SHARE,
    binSize = BIN_SIZE,
    maxFamilies = MAX_FAMILIES,
  } = options;
  if (oklabPixels.length === 0) return [];

  const bins = buildDensityMap(oklabPixels, binSize).sort(
    (a, b) => b.density - a.density
  );

  let peaks = [];
  for (const bin of bins) {
    const farFromAll = peaks.every(
      (peak) => familyDistance(peak, bin.center) >= separation
    );
    if (farFromAll) peaks.push(bin.center);
  }

  // Drop families under the minimum share and hand their pixels to the
  // nearest surviving peak, until every family is big enough.
  const minCount = oklabPixels.length * minShare;
  let families = assignToPeaks(oklabPixels, peaks);
  for (;;) {
    const kept = families.filter((f) => f.members.length >= minCount);
    if (kept.length === families.length) break;
    if (kept.length === 0) {
      // Every family is tiny; keep only the biggest one.
      const biggest = families.reduce((a, b) =>
        b.members.length > a.members.length ? b : a
      );
      families = assignToPeaks(oklabPixels, [biggest.peak]);
      break;
    }
    families = assignToPeaks(
      oklabPixels,
      kept.map((f) => f.peak)
    );
  }

  // Here and in the drop loop above, a removed family's pixels join their
  // nearest surviving peak even when it is far away, so a survivor's share can
  // grow beyond its own pixels. Its color stays faithful because the core
  // radius below ignores those far members.
  if (families.length > maxFamilies) {
    const largest = [...families]
      .sort((a, b) => b.members.length - a.members.length)
      .slice(0, maxFamilies);
    families = assignToPeaks(
      oklabPixels,
      largest.map((f) => f.peak)
    );
  }

  return families
    .map((f) => ({
      peak: f.peak,
      color: coreColor(f, oklabPixels, separation / 2),
      members: f.members,
      share: f.members.length / oklabPixels.length,
    }))
    .sort((a, b) => b.share - a.share);
}

// Lightness counts this much when deciding which families to merge for a
// shorter palette. Lower than LIGHTNESS_WEIGHT: families that differ mostly in
// lightness are the cheapest to merge, because Detail brings the lightness
// back as shades.
export const MERGE_LIGHTNESS_WEIGHT = 0.15;

// Merges families until at most maxFamilies remain, always merging the closest
// pair. Size plays no part, so a small accent that is far from everything
// outlasts large families that are shades of one color; findFamilies has
// already dropped anything too small to matter. The larger family absorbs the
// smaller one's members and keeps its own peak and color, so a merge never
// averages two colors into a muddy one. Returns families sorted by share, in
// the same shape findFamilies returns.
export function mergeFamilies(
  families,
  oklabPixels,
  maxFamilies,
  lightnessWeight = MERGE_LIGHTNESS_WEIGHT
) {
  if (families.length <= maxFamilies) return families;
  const total = oklabPixels.length;
  const groups = families.map((f) => ({ ...f, members: [...f.members] }));

  const distance = (a, b) => {
    const dL = (a[0] - b[0]) * lightnessWeight;
    const da = a[1] - b[1];
    const db = a[2] - b[2];
    return Math.sqrt(dL * dL + da * da + db * db);
  };

  while (groups.length > Math.max(1, maxFamilies)) {
    let closest = Infinity;
    let pair = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = distance(groups[i].color, groups[j].color);
        if (d < closest) {
          closest = d;
          pair = [i, j];
        }
      }
    }
    const [i, j] = pair;
    const [keep, drop] =
      groups[i].members.length >= groups[j].members.length ? [i, j] : [j, i];
    for (const m of groups[drop].members) groups[keep].members.push(m);
    groups.splice(drop, 1);
  }

  return groups
    .map((g) => ({ ...g, share: g.members.length / total }))
    .sort((a, b) => b.share - a.share);
}
