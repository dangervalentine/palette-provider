# Palette Extraction Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the palette extraction pipeline with a hybrid median-cut + k-means algorithm in OKLAB color space, add three extraction modes, and redesign the display as swatch cards with a downloadable palette image.

**Architecture:** Stratified sampling (~10k pixels) → OKLAB conversion → median cut partitioning → k-means polish → mode-specific post-processing (Faithful/Design/Complete) → tier classification → swatch card display. Detail presets (Essential/Balanced/Rich) control median cut depth. A download button renders the palette as a vertical-stripe PNG.

**Tech Stack:** React 19, Vite, Vitest, CSS custom properties (Night Owl design tokens)

---

## File Map

### New Files
- `src/oklab.js` — RGB↔OKLAB conversion and distance function
- `src/oklab.test.js` — Tests for OKLAB conversion
- `src/medianCut.js` — Median cut algorithm in OKLAB space
- `src/medianCut.test.js` — Tests for median cut
- `src/paletteEngine.js` — Stratified sampling, mode post-processing, pipeline orchestration
- `src/paletteEngine.test.js` — Tests for engine
- `src/Swatch.jsx` — Swatch card component

### Modified Files
- `src/kmeans.js` — Add `initialCenters` option
- `src/kmeans.test.js` — Add test for `initialCenters`
- `src/Toolbar.jsx` — Mode dropdown, segmented control, remove range slider
- `src/Palette.jsx` — Swatch card grid, download button, remove circle display
- `src/App.jsx` — New pipeline, new state (mode, detail), simplified processImg
- `src/App.css` — Swatch card styles, segmented control, remove old circle/tier styles
- `src/helpers.js` — Update exports

### Removed Files
- `src/Color.jsx` — Replaced by `src/Swatch.jsx`

---

### Task 1: OKLAB Color Space Conversion

**Files:**
- Create: `src/oklab.js`
- Create: `src/oklab.test.js`

- [ ] **Step 1: Write the tests**

```javascript
// src/oklab.test.js
import { describe, it, expect } from "vitest";
import { rgbToOklab, oklabToRgb, oklabDistance } from "./oklab";

describe("rgbToOklab", () => {
  it("converts black to origin", () => {
    const [L, a, b] = rgbToOklab(0, 0, 0);
    expect(L).toBeCloseTo(0, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it("converts white to L=1", () => {
    const [L, a, b] = rgbToOklab(255, 255, 255);
    expect(L).toBeCloseTo(1, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it("converts pure red", () => {
    const [L, a, b] = rgbToOklab(255, 0, 0);
    expect(L).toBeCloseTo(0.628, 2);
    expect(a).toBeCloseTo(0.225, 2);
    expect(b).toBeCloseTo(0.126, 2);
  });

  it("converts pure green", () => {
    const [L] = rgbToOklab(0, 255, 0);
    expect(L).toBeGreaterThan(0.5);
  });

  it("converts pure blue", () => {
    const [L, a, b] = rgbToOklab(0, 0, 255);
    expect(L).toBeCloseTo(0.452, 2);
    expect(b).toBeLessThan(-0.2);
  });
});

describe("oklabToRgb", () => {
  it("converts origin to black", () => {
    expect(oklabToRgb(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("converts L=1 to white", () => {
    expect(oklabToRgb(1, 0, 0)).toEqual([255, 255, 255]);
  });

  it("round-trips pure red", () => {
    const oklab = rgbToOklab(255, 0, 0);
    const rgb = oklabToRgb(oklab[0], oklab[1], oklab[2]);
    expect(rgb[0]).toBeGreaterThanOrEqual(254);
    expect(rgb[1]).toBeLessThanOrEqual(1);
    expect(rgb[2]).toBeLessThanOrEqual(1);
  });

  it("round-trips a mid-range color", () => {
    const original = [45, 90, 123];
    const oklab = rgbToOklab(...original);
    const rgb = oklabToRgb(...oklab);
    expect(rgb[0]).toBeCloseTo(original[0], 0);
    expect(rgb[1]).toBeCloseTo(original[1], 0);
    expect(rgb[2]).toBeCloseTo(original[2], 0);
  });

  it("clamps out-of-range values to 0-255", () => {
    const rgb = oklabToRgb(1.5, 0.5, 0.5);
    rgb.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    });
  });
});

describe("oklabDistance", () => {
  it("returns 0 for identical colors", () => {
    expect(oklabDistance([0.5, 0.1, -0.1], [0.5, 0.1, -0.1])).toBe(0);
  });

  it("returns positive distance for different colors", () => {
    const d = oklabDistance([0, 0, 0], [1, 0, 0]);
    expect(d).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = [0.6, 0.2, 0.1];
    const b = [0.4, -0.1, -0.3];
    expect(oklabDistance(a, b)).toBeCloseTo(oklabDistance(b, a), 10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/oklab.test.js`
Expected: FAIL — module `./oklab` not found

- [ ] **Step 3: Implement oklab.js**

```javascript
// src/oklab.js

function linearize(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function delinearize(c) {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, s * 255)));
}

export function rgbToOklab(r, g, b) {
  const lr = linearize(r);
  const lg = linearize(g);
  const lb = linearize(b);

  const l_ = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m_ = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s_ = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l = Math.cbrt(l_);
  const m = Math.cbrt(m_);
  const s = Math.cbrt(s_);

  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToRgb(L, a, b) {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;

  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;

  return [
    delinearize(+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3),
    delinearize(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3),
    delinearize(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3),
  ];
}

export function oklabDistance(a, b) {
  const dL = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/oklab.test.js`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/oklab.js src/oklab.test.js
git commit -m "feat: add OKLAB color space conversion module"
```

---

### Task 2: Median Cut Algorithm

**Files:**
- Create: `src/medianCut.js`
- Create: `src/medianCut.test.js`

- [ ] **Step 1: Write the tests**

```javascript
// src/medianCut.test.js
import { describe, it, expect } from "vitest";
import { medianCut, DETAIL_CONFIG } from "./medianCut";

describe("medianCut", () => {
  it("returns a single bucket for identical pixels", () => {
    const pixels = Array.from({ length: 100 }, () => [0.5, 0.1, -0.1]);
    const result = medianCut(pixels, "essential");
    expect(result).toHaveLength(1);
    expect(result[0].center[0]).toBeCloseTo(0.5, 5);
    expect(result[0].count).toBe(100);
  });

  it("splits two distinct color groups", () => {
    const red = Array.from({ length: 50 }, () => [0.63, 0.22, 0.13]);
    const blue = Array.from({ length: 50 }, () => [0.45, -0.03, -0.31]);
    const result = medianCut([...red, ...blue], "essential");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("produces more buckets with higher detail", () => {
    const pixels = [];
    for (let i = 0; i < 1000; i++) {
      pixels.push([Math.random(), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6]);
    }
    const essential = medianCut(pixels, "essential");
    const rich = medianCut(pixels, "rich");
    expect(rich.length).toBeGreaterThanOrEqual(essential.length);
  });

  it("bucket counts sum to total pixel count", () => {
    const pixels = Array.from({ length: 200 }, () => [
      Math.random(),
      (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.4,
    ]);
    const result = medianCut(pixels, "balanced");
    const total = result.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(200);
  });

  it("each bucket has a center array of length 3", () => {
    const pixels = Array.from({ length: 100 }, () => [0.5, 0.0, 0.0]);
    const result = medianCut(pixels, "balanced");
    result.forEach((bucket) => {
      expect(bucket.center).toHaveLength(3);
      expect(typeof bucket.center[0]).toBe("number");
    });
  });

  it("returns empty array for empty input", () => {
    expect(medianCut([], "essential")).toEqual([]);
  });
});

describe("DETAIL_CONFIG", () => {
  it("has essential, balanced, and rich presets", () => {
    expect(DETAIL_CONFIG).toHaveProperty("essential");
    expect(DETAIL_CONFIG).toHaveProperty("balanced");
    expect(DETAIL_CONFIG).toHaveProperty("rich");
  });

  it("essential has lower maxDepth than rich", () => {
    expect(DETAIL_CONFIG.essential.maxDepth).toBeLessThan(DETAIL_CONFIG.rich.maxDepth);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/medianCut.test.js`
Expected: FAIL — module `./medianCut` not found

- [ ] **Step 3: Implement medianCut.js**

```javascript
// src/medianCut.js

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/medianCut.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/medianCut.js src/medianCut.test.js
git commit -m "feat: add median cut algorithm in OKLAB space"
```

---

### Task 3: K-Means Adaptation for Initial Centers

**Files:**
- Modify: `src/kmeans.js:42` (add `initialCenters` option)
- Modify: `src/kmeans.test.js` (add test)

- [ ] **Step 1: Add test for initialCenters**

Append to the `kMeansClustering` describe block in `src/kmeans.test.js`:

```javascript
  it("uses provided initial centers instead of random init", () => {
    const reds = Array.from({ length: 50 }, () => [250, 5, 5]);
    const blues = Array.from({ length: 50 }, () => [5, 5, 250]);
    const initialCenters = [[255, 0, 0], [0, 0, 255]];
    const result = kMeansClustering([...reds, ...blues], 2, { initialCenters });
    expect(result).toHaveLength(2);
    const sorted = result.sort((a, b) => b.color[0] - a.color[0]);
    expect(sorted[0].color[0]).toBeGreaterThan(200);
    expect(sorted[1].color[2]).toBeGreaterThan(200);
  });
```

- [ ] **Step 2: Run tests to verify new test fails**

Run: `npx vitest run src/kmeans.test.js`
Expected: New test may pass or fail depending on random init — but we want deterministic behavior.

- [ ] **Step 3: Add initialCenters option to kMeansClustering**

In `src/kmeans.js`, change line 42:

Replace:
```javascript
export function kMeansClustering(pixels, k, options = {}) {
  const { maxIterations = 20, tolerance = 1 } = options;
```

With:
```javascript
export function kMeansClustering(pixels, k, options = {}) {
  const { maxIterations = 20, tolerance = 1, initialCenters = null } = options;
```

Then change line 48:

Replace:
```javascript
  let centers = initCenters(pixels, effectiveK);
```

With:
```javascript
  let centers = initialCenters
    ? initialCenters.slice(0, effectiveK).map((c) => [...c])
    : initCenters(pixels, effectiveK);
```

- [ ] **Step 4: Run all k-means tests**

Run: `npx vitest run src/kmeans.test.js`
Expected: All 7 tests PASS (6 existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add src/kmeans.js src/kmeans.test.js
git commit -m "feat: add initialCenters option to k-means clustering"
```

---

### Task 4: Palette Extraction Engine

**Files:**
- Create: `src/paletteEngine.js`
- Create: `src/paletteEngine.test.js`

- [ ] **Step 1: Write the tests**

```javascript
// src/paletteEngine.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/paletteEngine.test.js`
Expected: FAIL — module `./paletteEngine` not found

- [ ] **Step 3: Implement paletteEngine.js**

```javascript
// src/paletteEngine.js
import { rgbToOklab, oklabToRgb, oklabDistance } from "./oklab";
import { medianCut } from "./medianCut";
import { kMeansClustering } from "./kmeans";
import { classifyTiers } from "./tierClassifier";

const TARGET_SAMPLES = 10000;
const KMEANS_POLISH_ITERATIONS = 8;
const DESIGN_MIN_DISTANCE = 0.05;
const COMPLETE_OUTLIER_THRESHOLD = 0.1;

export function stratifiedSample(imageData, width, height, targetCount) {
  const gridSize = Math.ceil(Math.sqrt(targetCount));
  const cellW = width / gridSize;
  const cellH = height / gridSize;
  const pixels = [];

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const x = Math.min(Math.floor(gx * cellW + cellW / 2), width - 1);
      const y = Math.min(Math.floor(gy * cellH + cellH / 2), height - 1);
      const idx = (y * width + x) * 4;
      pixels.push([imageData[idx], imageData[idx + 1], imageData[idx + 2]]);
    }
  }

  return pixels;
}

function designPostProcess(clusters) {
  const result = clusters.map((c) => ({ ...c }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < result.length && !merged; i++) {
      for (let j = i + 1; j < result.length && !merged; j++) {
        if (oklabDistance(result[i].color, result[j].color) < DESIGN_MIN_DISTANCE) {
          result[i].count += result[j].count;
          result.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  return result.sort((a, b) => b.count - a.count);
}

function completePostProcess(clusters, oklabPixels) {
  const outliers = oklabPixels.filter((p) => {
    const minDist = Math.min(
      ...clusters.map((c) => oklabDistance(p, c.color))
    );
    return minDist > COMPLETE_OUTLIER_THRESHOLD;
  });

  if (outliers.length < oklabPixels.length * 0.005) return clusters;

  const outlierK = Math.min(3, Math.max(1, Math.ceil(outliers.length / 20)));
  const outlierClusters = kMeansClustering(outliers, outlierK, {
    maxIterations: 10,
    tolerance: 0.001,
  });

  return [...clusters, ...outlierClusters].sort((a, b) => b.count - a.count);
}

export function extractPalette(
  imageData,
  width,
  height,
  { mode = "faithful", detail = "balanced" } = {}
) {
  const rgbPixels = stratifiedSample(imageData, width, height, TARGET_SAMPLES);
  const oklabPixels = rgbPixels.map(([r, g, b]) => rgbToOklab(r, g, b));

  const buckets = medianCut(oklabPixels, detail);
  if (buckets.length === 0) return [];

  const initialCenters = buckets.map((b) => b.center);
  const k = initialCenters.length;

  let clusters = kMeansClustering(oklabPixels, k, {
    maxIterations: KMEANS_POLISH_ITERATIONS,
    tolerance: 0.001,
    initialCenters,
  });

  if (mode === "design") {
    clusters = designPostProcess(clusters);
  } else if (mode === "complete") {
    clusters = completePostProcess(clusters, oklabPixels);
  }

  const rgbClusters = clusters.map((c) => ({
    color: oklabToRgb(c.color[0], c.color[1], c.color[2]),
    count: c.count,
    okL: c.color[0],
  }));

  return classifyTiers(rgbClusters);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/paletteEngine.test.js`
Expected: All 7 tests PASS

- [ ] **Step 5: Run all tests to verify nothing broke**

Run: `npx vitest run`
Expected: All tests PASS (oklab, medianCut, kmeans, colorUtils, tierClassifier, paletteEngine)

- [ ] **Step 6: Commit**

```bash
git add src/paletteEngine.js src/paletteEngine.test.js
git commit -m "feat: add palette extraction engine with mode post-processing"
```

---

### Task 5: Toolbar Redesign

**Files:**
- Modify: `src/Toolbar.jsx` (full rewrite)
- Modify: `src/App.css` (add segmented control styles)

- [ ] **Step 1: Rewrite Toolbar.jsx**

```jsx
// src/Toolbar.jsx
const DETAIL_OPTIONS = ["essential", "balanced", "rich"];

const Toolbar = ({
  hasImage,
  mode,
  onModeChange,
  detail,
  onDetailChange,
  colorFormat,
  onColorFormatChange,
  onChangeImage,
  isMobile,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Mode</span>
        <select
          className="toolbar-select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value)}
          disabled={!hasImage}
        >
          <option value="faithful">Faithful</option>
          <option value="design">Design</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Detail</span>
        <div className="segment-group">
          {DETAIL_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`segment-btn${detail === opt ? " active" : ""}`}
              onClick={() => onDetailChange(opt)}
              disabled={!hasImage}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Format</span>
        <select
          className="toolbar-select"
          value={colorFormat}
          onChange={(e) => onColorFormatChange(e.target.value)}
          disabled={!hasImage}
        >
          <option value="hex">HEX</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
      </div>

      <div className="toolbar-divider" />

      <button className="btn-ghost" onClick={onChangeImage}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2v5M8 7L5.5 4.5M8 7l2.5-2.5M3 10v2a1 1 0 001 1h8a1 1 0 001-1v-2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {!isMobile && <span>Upload</span>}
      </button>
    </div>
  );
};

export default Toolbar;
```

- [ ] **Step 2: Add segmented control CSS to App.css**

Add after the `.btn-ghost` section:

```css
/* ── Segmented Control ──────────────────────────────── */

.segment-group {
  display: flex;
  border: var(--border-thin) solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.segment-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: var(--font-size-tiny);
  font-family: var(--font-family-body);
  font-weight: var(--font-weight-semibold);
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.segment-btn:not(:last-child) {
  border-right: var(--border-thin) solid var(--color-border);
}

.segment-btn.active {
  background: var(--color-primary-main);
  color: var(--color-neutral-white);
}

.segment-btn:not(.active):not(:disabled):hover {
  background: var(--color-primary-tint-soft);
  color: var(--color-primary-main);
}

.segment-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx vite build`
Expected: Build succeeds (Toolbar props don't match App yet — that's Task 7)

- [ ] **Step 4: Commit**

```bash
git add src/Toolbar.jsx src/App.css
git commit -m "feat: toolbar with mode dropdown, detail segmented control"
```

---

### Task 6: Swatch Cards, Palette Display, and Download

**Files:**
- Create: `src/Swatch.jsx`
- Modify: `src/Palette.jsx` (full rewrite)
- Modify: `src/App.css` (add swatch styles, remove old circle/tier-swatch styles)

- [ ] **Step 1: Create Swatch.jsx**

```jsx
// src/Swatch.jsx
import { useState } from "react";
import { formatColor, copyToClipboard } from "./helpers";

const Swatch = ({ color, format }) => {
  const [copied, setCopied] = useState(false);
  const formatted = formatColor(color, format);
  const bgColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

  const onClick = () => {
    copyToClipboard(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
  };

  return (
    <div className="swatch-card" onClick={onClick}>
      <div className="swatch-color" style={{ backgroundColor: bgColor }} />
      <div className="swatch-label">
        <span className="swatch-value">{copied ? "Copied!" : formatted}</span>
      </div>
    </div>
  );
};

export default Swatch;
```

- [ ] **Step 2: Rewrite Palette.jsx**

```jsx
// src/Palette.jsx
import Swatch from "./Swatch";
import { formatColor, copyToClipboard } from "./helpers";

const Palette = ({ colors, format, onDownload }) => {
  if (colors.length === 0) {
    return (
      <div className="palette-panel">
        <div className="palette-empty">Upload an image to extract colors</div>
      </div>
    );
  }

  const tiers = ["dominant", "supporting", "accent"];
  const grouped = {};
  for (const tier of tiers) {
    const items = colors.filter((c) => c.tier === tier);
    if (items.length > 0) grouped[tier] = items;
  }

  const buildCopyText = () => {
    const lines = [];
    for (const tier of tiers) {
      if (!grouped[tier]) continue;
      const values = grouped[tier]
        .map((c) => formatColor(c.color, format))
        .join(", ");
      lines.push(`/* ${tier} */ ${values}`);
    }
    return lines.join("\n");
  };

  const copyAll = () => copyToClipboard(buildCopyText());

  return (
    <div className="palette-panel">
      <div className="palette-header">
        <div style={{ display: "flex", alignItems: "center" }}>
          <h3>Palette</h3>
          <span className="palette-count">{colors.length} colors</span>
        </div>
        <div className="palette-actions">
          <button className="btn-ghost" onClick={copyAll}>
            Copy All
          </button>
          <button className="btn-ghost" onClick={onDownload}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v8M8 10l-3-3M8 10l3-3M3 13h10"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="swatch-grid">
        {colors.map((c) => (
          <Swatch
            key={c.color.join(",")}
            color={c.color}
            format={format}
          />
        ))}
      </div>

      <div className="color-list-block">
        <div className="color-list-header">
          <span>All colors — click to copy</span>
          <button className="color-list-copy" onClick={copyAll}>
            Copy
          </button>
        </div>
        <div className="color-list-text">
          {tiers.map(
            (tier) =>
              grouped[tier] && (
                <div key={tier}>
                  <span className="tier-comment">/* {tier} */</span>{" "}
                  <span className={`${tier}-colors`}>
                    {grouped[tier]
                      .map((c) => formatColor(c.color, format))
                      .join(", ")}
                  </span>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );
};

export default Palette;
```

- [ ] **Step 3: Replace old circle/tier CSS with swatch card CSS in App.css**

Remove these CSS blocks entirely:
- `.tier-group` through `.tier-swatches`
- `.color-item` through `.color-percentage`

And remove from the mobile section:
- `.color-circle.dominant`, `.color-circle.supporting`, `.color-circle.accent` mobile overrides

Add in their place:

```css
/* ── Swatch Cards ───────────────────────────────────── */

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.swatch-card {
  border-radius: var(--radius-md);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-medium);
  cursor: pointer;
  overflow: hidden;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.swatch-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-large);
}

.swatch-color {
  aspect-ratio: 1 / 0.85;
  border-bottom: var(--border-hairline) solid var(--color-border);
}

.swatch-label {
  background: #ffffff;
  padding: var(--spacing-md);
  text-align: center;
}

.swatch-value {
  font-size: var(--font-size-tiny);
  font-family: var(--font-family-mono);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.palette-actions {
  display: flex;
  gap: var(--spacing-md);
}
```

Also update `.copy-all-button` references — the "Copy All" and "Download" buttons now use `.btn-ghost`, so remove the `.copy-all-button` and `.copy-all-button:hover` rules.

- [ ] **Step 4: Verify build compiles**

Run: `npx vite build`
Expected: Build succeeds (Palette `onDownload` prop not wired yet — that's Task 7)

- [ ] **Step 5: Commit**

```bash
git add src/Swatch.jsx src/Palette.jsx src/App.css
git commit -m "feat: swatch card display with download button"
```

---

### Task 7: App Integration and Cleanup

**Files:**
- Modify: `src/App.jsx` (new pipeline, new state, download handler)
- Modify: `src/helpers.js` (update exports)
- Delete: `src/Color.jsx`

- [ ] **Step 1: Update helpers.js exports**

```javascript
// src/helpers.js
export { extractPalette } from "./paletteEngine";
export { classifyTiers } from "./tierClassifier";
export { rgbToHex, rgbToHsl, formatColor } from "./colorUtils";

export const copyToClipboard = (str) => {
  navigator.clipboard.writeText(str);
};
```

Remove the `changeBackground` export and the `kMeansClustering`/`samplePixels` re-exports (no longer needed by App).

- [ ] **Step 2: Rewrite App.jsx**

```jsx
// src/App.jsx
import { useCallback, useState, useRef } from "react";
import Header from "./Header";
import Toolbar from "./Toolbar";
import Palette from "./Palette";
import { extractPalette, formatColor } from "./helpers";
import { useMediaQuery } from "./hooks/useMediaQuery";

import "./App.css";
import upload from "./upload.svg";

let imgSrc;
let lastImageData;
let lastWidth;
let lastHeight;

const App = () => {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const [fileName, setFileName] = useState("");
  const [image, setImage] = useState("");
  const [mode, setMode] = useState("faithful");
  const [detail, setDetail] = useState("balanced");
  const [colorFormat, setColorFormat] = useState("hex");
  const [colors, setColors] = useState([]);
  const photoContainer = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  const runExtraction = useCallback(
    (imageData, width, height, opts) => {
      const result = extractPalette(imageData, width, height, opts);
      setColors(result);
    },
    []
  );

  const processImg = useCallback(
    (file) => {
      if (!file && !imgSrc) return;

      if (file) {
        imgSrc = URL.createObjectURL(file);
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      setFileName(file?.name ?? fileName);
      setImage(imgSrc);

      img.onload = () => {
        const w = (canvas.width = img.width);
        const h = (canvas.height = img.height);
        ctx.drawImage(img, 0, 0, w, h);
        lastImageData = ctx.getImageData(0, 0, w, h).data;
        lastWidth = w;
        lastHeight = h;
        runExtraction(lastImageData, w, h, { mode, detail });
      };
      img.src = imgSrc;
    },
    [fileName, mode, detail, runExtraction]
  );

  const reprocess = useCallback(
    (newMode, newDetail) => {
      if (!lastImageData) return;
      runExtraction(lastImageData, lastWidth, lastHeight, {
        mode: newMode,
        detail: newDetail,
      });
    },
    [runExtraction]
  );

  const handleModeChange = useCallback(
    (newMode) => {
      setMode(newMode);
      reprocess(newMode, detail);
    },
    [detail, reprocess]
  );

  const handleDetailChange = useCallback(
    (newDetail) => {
      setDetail(newDetail);
      reprocess(mode, newDetail);
    },
    [mode, reprocess]
  );

  const onChange = (e) => {
    if (!e.target.files.length) return;
    processImg(e.target.files[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    processImg(e.dataTransfer.files[0]);
    photoContainer.current.classList.remove("drag-over");
  };

  const onDragOver = (e) => {
    e.preventDefault();
    photoContainer.current.classList.add("drag-over");
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    photoContainer.current.classList.remove("drag-over");
  };

  const downloadPalette = useCallback(() => {
    if (colors.length === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    const stripeW = 1200 / colors.length;

    colors.forEach((c, i) => {
      ctx.fillStyle = `rgb(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`;
      ctx.fillRect(i * stripeW, 0, stripeW, 800);

      ctx.fillStyle = c.okL > 0.5 ? "#000000" : "#FFFFFF";
      ctx.font = "bold 18px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        formatColor(c.color, colorFormat),
        i * stripeW + stripeW / 2,
        400
      );
    });

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `palette-${fileName || "image"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [colors, colorFormat, fileName]);

  const hasImage = fileName !== "";

  const handleOriginalPaneClick = useCallback(() => {
    if (!hasImage) {
      inputRef.current?.click();
    }
  }, [hasImage]);

  let helperContent;
  if (!hasImage) {
    helperContent = (
      <span className="helper-step">
        Drop an image here or click to upload
      </span>
    );
  } else {
    helperContent = isMobile ? (
      <span className="helper-step">Tap swatches to copy color values</span>
    ) : (
      <>
        <span className="helper-step">Click swatches to copy</span>
        <span className="helper-dot" />
        <span className="helper-step">Download palette as image</span>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Toolbar
        hasImage={hasImage}
        mode={mode}
        onModeChange={handleModeChange}
        detail={detail}
        onDetailChange={handleDetailChange}
        colorFormat={colorFormat}
        onColorFormatChange={setColorFormat}
        onChangeImage={() => inputRef.current?.click()}
        isMobile={isMobile}
      />
      <div className="helper-bar">
        <div className="helper-text">{helperContent}</div>
      </div>
      <div className="container">
        <div
          ref={photoContainer}
          className="photo-container"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {isMobile ? (
            hasImage ? (
              <div className="split-view">
                <div className="split-pane original-pane">
                  <div className="pane-label">Source</div>
                  <div className="image-wrapper">
                    <img
                      className="image-file"
                      src={image}
                      alt="uploaded file"
                    />
                  </div>
                </div>
                <div className="split-pane palette-pane">
                  <div className="pane-label">Palette</div>
                  <Palette
                    colors={colors}
                    format={colorFormat}
                    onDownload={downloadPalette}
                  />
                </div>
              </div>
            ) : (
              <div
                className="photo border"
                onClick={() => inputRef.current?.click()}
              >
                <div className="empty-state">
                  <img src={upload} alt="upload" />
                  <div className="image-text">
                    <span className="bold">Choose a file</span>
                    <div className="tagline">or drag it here</div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="split-view">
              <div
                className="split-pane original-pane"
                onClick={handleOriginalPaneClick}
              >
                <div className="pane-label">
                  {hasImage ? "Source" : "Upload"}
                </div>
                {hasImage ? (
                  <div className="image-wrapper">
                    <img
                      className="image-file"
                      src={image}
                      alt="uploaded file"
                    />
                  </div>
                ) : (
                  <div className="empty-state">
                    <img src={upload} alt="upload" />
                    <div className="image-text">
                      <span className="bold">Choose a file</span>
                      <div className="tagline">or drag it here</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="split-pane palette-pane">
                <div className="pane-label">Palette</div>
                {hasImage ? (
                  <Palette
                    colors={colors}
                    format={colorFormat}
                    onDownload={downloadPalette}
                  />
                ) : (
                  <div className="empty-preview">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                    >
                      <circle
                        cx="15"
                        cy="15"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="33"
                        cy="15"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="15"
                        cy="33"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="33"
                        cy="33"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                    </svg>
                    <span>Your color palette will appear here</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="main-canvas" />
        </div>
        <input
          ref={inputRef}
          accept="image/*"
          type="file"
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default App;
```

- [ ] **Step 3: Delete Color.jsx**

```bash
git rm src/Color.jsx
```

- [ ] **Step 4: Build and verify**

Run: `npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: All tests pass. (The old Color component had no tests.)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/helpers.js src/Palette.jsx
git commit -m "feat: integrate new palette engine, swatch cards, and download"
```
