import { useState } from "react";
import { formatColor, copyToClipboard } from "./helpers";

const Swatch = ({ color, format, onRemove }) => {
  const [copied, setCopied] = useState(false);
  const formatted = formatColor(color, format);
  const bgColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

  const onClick = () => {
    copyToClipboard(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 600);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onRemove(color);
  };

  return (
    <div className="swatch-card" onClick={onClick}>
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
