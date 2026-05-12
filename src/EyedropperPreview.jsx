import { formatColor } from "./helpers";

const EyedropperPreview = ({ preview, format }) => {
  if (!preview) return null;

  const { x, y, color } = preview;
  const bgColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  const label = formatColor(color, format);

  return (
    <div
      className="eyedropper-preview"
      style={{ left: x, top: y }}
    >
      <div
        className="eyedropper-preview-swatch"
        style={{ backgroundColor: bgColor }}
      />
      <div className="eyedropper-preview-label">{label}</div>
    </div>
  );
};

export default EyedropperPreview;
