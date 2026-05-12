# Palette Extraction Redesign

## Problem

The current palette extraction pipeline produces low-quality results:
- Downsamples to only 500 pixels, losing rare accent colors
- Clusters in RGB space (not perceptually uniform)
- Requires the user to guess how many colors they want (k slider)
- Random initialization means the same image can produce different palettes

## Solution

Replace the extraction pipeline with a hybrid median-cut + k-means algorithm in OKLAB color space, add three extraction modes, and redesign the palette display as swatch cards with a downloadable palette image.

---

## Algorithm Pipeline

### 1. Sampling

Pull ~10,000 pixels using stratified grid sampling. Divide the image into a grid of cells and sample uniformly from each cell so small regions are represented.

### 2. OKLAB Conversion

Convert all sampled RGB pixels to OKLAB color space. All clustering and distance calculations happen in OKLAB. Convert back to RGB only for final display.

OKLAB is perceptually uniform — equal distances in OKLAB correspond to equal perceived color differences. This produces more meaningful clusters than RGB.

### 3. Median Cut

Recursively split the pixel set along its longest axis in OKLAB space. This produces a binary tree of color regions. The split threshold determines how many leaf nodes (clusters) are produced.

The detail preset controls the split threshold:
- **Essential**: Stop early, producing 4-6 bold colors
- **Balanced**: Moderate splitting, producing 8-12 colors
- **Rich**: Deep splitting, producing 14-20 colors

The actual count within each range is determined by the image content — the algorithm stops splitting when remaining variance within a leaf falls below the threshold.

### 4. K-Means Polish

Use the median cut leaf centroids as initial centers. Run 5-10 k-means iterations in OKLAB to refine centers from box midpoints to true cluster centroids.

### 5. Mode Post-Processing

Three modes control what happens after clustering:

**Faithful** — Keep natural distribution weights as-is. Colors reflect what's actually in the image and in what proportions. No merging or boosting.

**Design** — Enforce minimum perceptual distance (delta-E in OKLAB) between palette entries. Merge colors that are too similar. Snap remaining ones apart to ensure distinct, usable colors. Filter near-duplicates that wouldn't serve a design system.

**Complete** — After initial clustering, scan all sampled pixels for outliers whose distance to the nearest center exceeds a threshold. Promote those into their own clusters. Captures rare but distinct accent colors (the red flower in a green field).

### 6. Tier Classification

Classify resulting colors into dominant/supporting/accent tiers using the existing tier classifier logic (based on percentage distribution). This feeds the copyable list output.

---

## UI Controls (Toolbar)

Four control groups in the toolbar, left to right:

1. **Mode dropdown** — Faithful / Design / Complete
2. **Detail segmented control** — Essential | Balanced | Rich (radio-button style, active segment uses filled primary style, inactive uses `btn-ghost` style)
3. **Format dropdown** — HEX / RGB / HSL
4. **Upload ghost button** — SVG icon + label, same as current

The old "Colors" range slider is removed entirely.

---

## Swatch Card Display

Replaces the current circle-based tier display.

### Card Structure

Each extracted color is rendered as a card:

- **Card container**: Background `--color-bg-surface`, shadow `--shadow-medium`, border-radius `--radius-md` (8px).
- **Color area** (top ~70%): Filled with the extracted color. Border-radius on top corners matches the card, flat on bottom.
- **Hairline separator**: `--border-hairline` solid `--color-border` between color area and label area. Ensures even white/near-white swatches have a clear boundary.
- **Label area** (bottom ~30%): White background. Displays the formatted color value (e.g. `#C5BFA3`) in `--color-text-primary` — always the theme's text color, never the swatch color.
- **Click to copy**: Clicking a card copies the formatted color value. Brief "Copied" feedback on the card.

### Layout

- Flex grid with wrapping
- Cards ordered by dominance (largest cluster first, smallest last)
- No tier grouping headers in the card grid — ordering conveys importance
- Roughly 3-4 per row on desktop, 2 on mobile
- Uniform card size (no tier-based sizing)

---

## Download Feature

A download button in the palette pane generates a single PNG image:

- **Layout**: Equal-width vertical stripes, one per palette color, side by side (like a paint-chip strip)
- **Dimensions**: 1200px wide, 800px tall. Stripe width = 1200 / color count.
- **Text overlay**: Each stripe has the formatted color value centered in Outfit font (the project's typeface)
- **Contrast**: Text color is white or dark depending on the stripe's OKLAB lightness (L > 0.5 = dark text, L <= 0.5 = white text)
- **Generation**: Rendered on a hidden canvas, exported via `canvas.toDataURL("image/png")` and triggered as a download

---

## Copyable List Block

Stays below the swatch card grid in the palette pane.

- All colors listed, grouped by tier (dominant / supporting / accent) with CSS-comment-style headers
- Copy button copies the full list
- Format matches the selected format dropdown (HEX/RGB/HSL)
- Same concept as current implementation, fed by the new algorithm output

---

## Files Changed

### New Files
- `src/oklab.js` — RGB-to-OKLAB and OKLAB-to-RGB conversion functions
- `src/medianCut.js` — Median cut algorithm in OKLAB space
- `src/Swatch.jsx` — Individual swatch card component

### Modified Files
- `src/kmeans.js` — Adapt to work in OKLAB space, accept initial centers from median cut
- `src/tierClassifier.js` — No changes to logic, just receives new algorithm output
- `src/App.jsx` — New pipeline integration, detail presets, mode state, download handler
- `src/App.css` — Swatch card styles, segmented control styles, remove old circle/tier styles
- `src/Toolbar.jsx` — Mode dropdown, segmented control, remove range slider
- `src/Palette.jsx` — Replace circle display with swatch card grid, add download button
- `src/Color.jsx` — Remove (replaced by Swatch.jsx)
- `src/helpers.js` — Update exports for new modules
- `src/colorUtils.js` — No changes needed

### Removed Files
- `src/Color.jsx` — Replaced by `src/Swatch.jsx`
