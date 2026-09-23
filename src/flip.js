// FLIP reordering: record where each keyed child of a container sits, let the
// DOM change, then play every child from its old spot to its new one. Children
// opt in with a data-flip-key attribute.

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";

const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const keyed = (container) =>
  container ? container.querySelectorAll(":scope > [data-flip-key]") : [];

// Positions by key, or null when there is nothing to measure.
export function snapshot(container) {
  if (!container) return null;
  const rects = new Map();
  for (const el of keyed(container)) {
    rects.set(el.dataset.flipKey, el.getBoundingClientRect());
  }
  return rects;
}

// Call after the reordered children are in the DOM, before paint.
export function playFrom(container, before, duration = 380) {
  if (!container || !before || reducedMotion()) return;
  for (const el of keyed(container)) {
    const from = before.get(el.dataset.flipKey);
    if (!from) continue;
    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.animate(
      [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
      { duration, easing: EASE_OUT }
    );
  }
}
