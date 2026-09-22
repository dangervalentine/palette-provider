import { useState } from "react";
import { formatColor, copyToClipboard } from "./helpers";

const Swatch = ({ swatchKey, color, okL, format, onRemove }) => {
  const [copied, setCopied] = useState(false);
  const formatted = formatColor(color, format);
  const bgColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  const ink = okL > 0.5 ? "#000000" : "#FFFFFF";

  const onClick = () => {
    copyToClipboard(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(swatchKey);
  };

  return (
    <div
      className="swatch-card"
      data-swatch-key={swatchKey}
      onClick={onClick}
      style={{ "--swatch-ink": ink }}
    >
      <div className="swatch-color" style={{ backgroundColor: bgColor }}>
        {onRemove && (
          <button className="swatch-remove" onClick={handleRemove}>
            &times;
          </button>
        )}
      </div>
      <div className="swatch-label">
        <span className="swatch-value">{copied ? "Copied!" : formatted}</span>
      </div>
    </div>
  );
};

export default Swatch;
