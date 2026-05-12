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
