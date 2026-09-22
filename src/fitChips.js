// Chip width bounds on desktop. Below the minimum a hex value no longer fits
// on one line; above the maximum chips look oversized.
const MIN_CHIP = 60;
const MAX_CHIP = 160;

// Picks the largest chip size that lets every tier fit in the scroll pane
// without scrolling, and applies it as --chip-min on the panel. The grid stays
// `repeat(auto-fill, minmax(var(--chip-min), 1fr))`; this only chooses the
// minimum. If even the smallest chips overflow, the pane scrolls as usual.
export function fitChips(panel, pane) {
  const grid = panel.querySelector(".swatch-grid");
  if (!grid) return;

  const width = grid.clientWidth;
  const gap = parseFloat(getComputedStyle(grid).columnGap) || 0;

  // Chip width when the grid has `cols` columns. Rounded down so auto-fill
  // lands on exactly that many columns.
  const sizeFor = (cols) => Math.floor((width - gap * (cols - 1)) / cols);
  const minCols = Math.max(1, Math.ceil((width + gap) / (MAX_CHIP + gap)));
  const maxCols = Math.max(minCols, Math.floor((width + gap) / (MIN_CHIP + gap)));

  const apply = (cols) =>
    panel.style.setProperty("--chip-min", `${sizeFor(cols)}px`);
  const fits = () => pane.scrollHeight <= pane.clientHeight + 1;

  // More columns means smaller chips and a shorter palette, so find the
  // fewest columns (biggest chips) that fit.
  let lo = minCols;
  let hi = maxCols;
  let best = maxCols;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    apply(mid);
    if (fits()) {
      best = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  apply(best);
}
