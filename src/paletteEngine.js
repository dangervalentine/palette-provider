import { rgbToOklab, oklabToRgb, oklabDistance } from "./oklab";
import { medianCut } from "./medianCut";
import { kMeansClustering } from "./kmeans";
import { classifyTiers } from "./tierClassifier";

const TARGET_SAMPLES = 10000;
const KMEANS_POLISH_ITERATIONS = 8;
const DEDUP_MIN_DISTANCE = 0.025;
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

function mergeClusters(clusters, minDistance) {
  const result = clusters.map((c) => ({ ...c }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < result.length && !merged; i++) {
      for (let j = i + 1; j < result.length && !merged; j++) {
        if (oklabDistance(result[i].color, result[j].color) < minDistance) {
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

  clusters = mergeClusters(clusters, DEDUP_MIN_DISTANCE);

  if (mode === "design") {
    clusters = mergeClusters(clusters, DESIGN_MIN_DISTANCE);
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
