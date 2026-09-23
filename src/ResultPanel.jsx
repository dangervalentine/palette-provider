import { useLayoutEffect, useRef, useState } from "react";
import { formatColor } from "./helpers";
import { ORDERS, orderColors } from "./paletteOrder";
import { pressHandlers } from "./press";
import { snapshot, playFrom } from "./flip";
import Breakdown from "./Breakdown";
import ColorSpace from "./ColorSpace";

const ORDER_LABELS = { prevalence: "Prevalence", family: "Family" };

const VIEWS = [
  { id: "breakdown", label: "Breakdown" },
  { id: "space", label: "Color space" },
];
const VIEW_STORAGE_KEY = "palette-provider-view";

// On mobile, scrolling the views shrinks the source image by the same amount,
// down to this share of the viewport height, to give the views more room.
// Scrolling back up grows it again. Must match the mobile image CSS.
const IMAGE_MAX_VH = 30;
const IMAGE_MIN_VH = 12;

const readStoredView = () => {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    return VIEWS.some((v) => v.id === stored) ? stored : "breakdown";
  } catch {
    return "breakdown";
  }
};

// The palette strip and, under it, tabs that show how the engine found it.
// Everything here reads the engine's result; nothing adds or removes colors.
const ResultPanel = ({
  analysis,
  colors,
  detail,
  format,
  order,
  onOrderChange,
  selection,
  onSelect,
  onCopy,
  onDownload,
  isMobile,
}) => {
  const [view, setView] = useState(readStoredView);
  const tabRefs = useRef([]);
  const stripRef = useRef(null);
  const breakdownRef = useRef(null);
  // Where the strip's swatches and the Breakdown's rows sat before an Order
  // change, so both can slide to their new places
  const beforeReorder = useRef(null);

  const changeOrder = (next) => {
    if (next === order) return;
    beforeReorder.current = {
      strip: snapshot(stripRef.current),
      breakdown: snapshot(breakdownRef.current),
    };
    onOrderChange(next);
  };

  useLayoutEffect(() => {
    const before = beforeReorder.current;
    if (!before) return;
    beforeReorder.current = null;
    playFrom(stripRef.current, before.strip);
    playFrom(breakdownRef.current, before.breakdown);
  }, [order]);

  const changeView = (next) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Storage unavailable; the tab just won't be remembered
    }
  };

  // Arrow keys move between tabs, as in the WAI-ARIA tabs pattern
  const onTabKeyDown = (e) => {
    const i = VIEWS.findIndex((v) => v.id === view);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + VIEWS.length) % VIEWS.length;
    changeView(VIEWS[next].id);
    tabRefs.current[next]?.focus();
  };

  const ordered = orderColors(colors, order);

  // Desktop renders both views: side by side when the pane is wide enough,
  // behind the tabs otherwise (see .views-both in App.css). Mobile renders
  // only the active one.
  const panels = isMobile ? VIEWS.filter((v) => v.id === view) : VIEWS;

  // Writes the shrink straight to a CSS variable rather than React state, so
  // scrolling never re-renders the panel.
  const onViewScroll = (e) => {
    const panel = e.currentTarget;
    const range = ((IMAGE_MAX_VH - IMAGE_MIN_VH) / 100) * window.innerHeight;
    panel
      .closest(".split-view")
      ?.style.setProperty("--image-shrink", `${Math.min(panel.scrollTop, range)}px`);
  };

  return (
    <div className={`palette-panel${isMobile ? "" : " views-both"}`}>
      <div className="palette-top">
        <div className="palette-header">
          <div style={{ display: "flex", alignItems: "center" }}>
            <h3>Palette</h3>
            <span className="palette-count">{colors.length} colors</span>
          </div>
        </div>

        <div className="palette-controls">
          <div className="palette-order" role="group" aria-label="Strip order">
            <span className="palette-order-label">Order</span>
            <div className="segment-group">
              {ORDERS.map((opt) => (
                <button
                  key={opt}
                  className={`segment-btn${order === opt ? " active" : ""}`}
                  onClick={() => changeOrder(opt)}
                  aria-pressed={order === opt}
                >
                  {ORDER_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary palette-download" onClick={onDownload}>
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

        {/* Tapping a color copies it and selects just that color in the
            views; tapping it again clears the selection. With a whole family
            selected, all of its shades are marked */}
        <div className="palette-strip" ref={stripRef}>
          {ordered.map((c) => {
            const value = formatColor(c.color, format);
            const selected =
              c.family === selection?.family &&
              (selection.shade == null || selection.shade === c.shade);
            return (
              <button
                key={c.key}
                data-flip-key={c.key}
                className={`palette-strip-segment${selected ? " is-selected" : ""}`}
                style={{
                  backgroundColor: `rgb(${c.color.join(",")})`,
                  "--swatch-ink": c.okL > 0.5 ? "#000000" : "#FFFFFF",
                  // Hover widens a segment just enough to fit its value
                  "--value-length": value.length,
                }}
                onClick={() => {
                  onCopy(value);
                  onSelect(c.family, c.shade);
                }}
                aria-label={`Copy ${value}`}
                aria-pressed={selected}
                title={value}
                {...pressHandlers}
              >
                <span className="palette-strip-value">{value}</span>
              </button>
            );
          })}
        </div>

        <div
          className="view-tabs segment-group"
          role="tablist"
          aria-label="Palette views"
          onKeyDown={onTabKeyDown}
        >
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              ref={(node) => (tabRefs.current[i] = node)}
              id={`view-tab-${v.id}`}
              role="tab"
              aria-selected={view === v.id}
              aria-controls={`view-panel-${v.id}`}
              tabIndex={view === v.id ? 0 : -1}
              className={`segment-btn${view === v.id ? " active" : ""}`}
              onClick={() => changeView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="view-panels">
        {panels.map((v) => (
          <div
            key={v.id}
            className={`view-panel${view === v.id ? " is-active" : ""}`}
            role="tabpanel"
            id={`view-panel-${v.id}`}
            aria-labelledby={`view-tab-${v.id}`}
            onScroll={isMobile ? onViewScroll : undefined}
          >
            <h4 className="view-heading">{v.label}</h4>
            {v.id === "breakdown" ? (
              <Breakdown
                analysis={analysis}
                detail={detail}
                format={format}
                order={order}
                listRef={breakdownRef}
                selection={selection}
                onSelect={onSelect}
                onCopy={onCopy}
              />
            ) : (
              <ColorSpace
                analysis={analysis}
                detail={detail}
                selection={selection}
                onSelect={onSelect}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ResultPanel;
