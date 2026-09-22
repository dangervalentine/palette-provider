import { useLayoutEffect, useRef, useState } from "react";
import Swatch from "./Swatch";
import { formatColor, copyToClipboard } from "./helpers";
import { ORDERS, orderColors, orderWithinTier } from "./paletteOrder";
import { fitChips } from "./fitChips";

const ORDER_LABELS = { prevalence: "Prevalence", hue: "Hue" };

const Palette = ({
  colors,
  format,
  onDownload,
  onRemoveColor,
  isMobile,
  order,
  onOrderChange,
}) => {
  const [editing, setEditing] = useState(false);
  const panelRef = useRef(null);

  // Only refit when what's shown changes, not on every parent render
  const layoutKey = colors.map((c) => `${c.key}:${c.tier}`).join("|");

  // Desktop: size chips so the whole palette fits in the pane without scrolling
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (isMobile) {
      panel.style.removeProperty("--chip-min");
      return;
    }
    const pane = panel.closest(".palette-pane");
    if (!pane) return;

    const fit = () => fitChips(panel, pane);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [isMobile, layoutKey, format]);

  if (colors.length === 0) {
    return (
      <div className="palette-panel">
        <div className="palette-empty">Upload an image to extract colors</div>
      </div>
    );
  }

  // Each tier is ordered by family hue so shades of one color sit together
  const tiers = ["dominant", "supporting", "accent", "sampled"];
  const grouped = {};
  for (const tier of tiers) {
    const items = colors.filter((c) => c.tier === tier);
    if (items.length > 0) grouped[tier] = orderWithinTier(items);
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

  const ordered = orderColors(colors, order);

  const scrollToSwatch = (key) => {
    document
      .querySelector(`[data-swatch-key="${key}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const actions = (
    <div className="palette-actions">
      <button className="btn-ghost" onClick={copyAll}>
        Copy All
      </button>
      <button className="btn-primary" onClick={onDownload}>
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
  );

  return (
    <div
      ref={panelRef}
      className={`palette-panel${editing ? " editing" : ""}`}
    >
      {/* Header, actions (desktop) and strip stay pinned while the chips scroll */}
      <div className="palette-top">
        <div className="palette-header">
          <div style={{ display: "flex", alignItems: "center" }}>
            <h3>Palette</h3>
            <span className="palette-count">{colors.length} colors</span>
          </div>
          {isMobile ? (
            <button
              className={`btn-ghost palette-edit${editing ? " active" : ""}`}
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
            >
              {editing ? "Done" : "Edit"}
            </button>
          ) : (
            actions
          )}
        </div>

        <div className="palette-order" role="group" aria-label="Strip order">
          <span className="palette-order-label">Order</span>
          <div className="segment-group">
            {ORDERS.map((opt) => (
              <button
                key={opt}
                className={`segment-btn${order === opt ? " active" : ""}`}
                onClick={() => onOrderChange(opt)}
                aria-pressed={order === opt}
              >
                {ORDER_LABELS[opt]}
              </button>
            ))}
          </div>
        </div>

        <div className="palette-strip">
          {ordered.map((c) => (
            <button
              key={c.key}
              className="palette-strip-segment"
              style={{
                backgroundColor: `rgb(${c.color.join(",")})`,
                "--swatch-ink": c.okL > 0.5 ? "#000000" : "#FFFFFF",
              }}
              onClick={() => scrollToSwatch(c.key)}
              aria-label={formatColor(c.color, format)}
            >
              <span className="palette-strip-value">
                {formatColor(c.color, format)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="palette-tiers">
        {tiers.map(
          (tier) =>
            grouped[tier] && (
              <div key={tier} className="tier-group">
                <span className="tier-label">
                  {tier}
                  <span className="tier-count">{grouped[tier].length}</span>
                </span>
                <div className="swatch-grid">
                  {grouped[tier].map((c) => (
                    <Swatch
                      key={c.key}
                      swatchKey={c.key}
                      color={c.color}
                      okL={c.okL}
                      format={format}
                      onRemove={onRemoveColor}
                    />
                  ))}
                </div>
              </div>
            )
        )}
      </div>

      {isMobile && actions}
    </div>
  );
};

export default Palette;
