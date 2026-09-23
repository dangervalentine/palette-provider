import { oklabToRgb } from "./oklab";
import { formatColor } from "./helpers";

const pct = (share) => {
  const p = share * 100;
  return `${p < 10 ? p.toFixed(1) : Math.round(p)}%`;
};

const rgbCss = (rgb) => `rgb(${rgb.join(",")})`;

// Every family, largest first, as a bar as long as its share of the image.
// The bar is split into the family's shades at the current Detail level, and
// the shades' values are listed under it.
const Breakdown = ({
  analysis,
  detail,
  format,
  selectedFamily,
  onSelectFamily,
  onCopy,
}) => {
  const { families } = analysis;
  const largest = families[0]?.share ?? 1;
  const shadeCount = families.reduce(
    (n, f) => n + f.shades[detail].length,
    0
  );

  return (
    <div className="breakdown">
      <p className="view-caption">
        {families.length} {families.length === 1 ? "family" : "families"} ·{" "}
        {shadeCount} shades at {detail[0].toUpperCase() + detail.slice(1)}.
        Bars show each family's share of the image.
      </p>
      <ol className="bd-list">
        {families.map((f, i) => {
          const shades = f.shades[detail].map((s) => ({
            ...s,
            rgb: oklabToRgb(...s.color),
          }));
          const selected = i === selectedFamily;
          return (
            <li
              key={i}
              className={`bd-row${selected ? " is-selected" : ""}`}
            >
              <button
                className="bd-select"
                onClick={() => onSelectFamily(selected ? null : i)}
                aria-pressed={selected}
                aria-label={`Family ${i + 1}, ${pct(f.share)} of the image`}
              >
                <span
                  className="bd-swatch"
                  style={{ backgroundColor: rgbCss(f.rgb) }}
                />
                <span className="bd-share">{pct(f.share)}</span>
                <span className="bd-track">
                  <span
                    className="bd-bar"
                    style={{ width: `${(f.share / largest) * 100}%` }}
                  >
                    {shades.map((s, k) => (
                      <span
                        key={k}
                        style={{
                          // Grow factors sum to 1, so the shades fill the bar
                          flexGrow: s.share / f.share,
                          backgroundColor: rgbCss(s.rgb),
                        }}
                      />
                    ))}
                  </span>
                </span>
              </button>
              <div className="bd-shades">
                {shades.map((s, k) => {
                  const value = formatColor(s.rgb, format);
                  return (
                    <button
                      key={k}
                      className="bd-shade"
                      onClick={() => onCopy(value)}
                      aria-label={`Copy ${value}`}
                    >
                      <span
                        className="bd-shade-dot"
                        style={{ backgroundColor: rgbCss(s.rgb) }}
                      />
                      <span className="bd-shade-value">{value}</span>
                      <span className="bd-shade-share">{pct(s.share)}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default Breakdown;
