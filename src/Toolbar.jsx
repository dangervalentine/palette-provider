const Toolbar = ({
  hasImage,
  paletteSize,
  onPaletteSizeChange,
  colorFormat,
  onColorFormatChange,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Colors</span>
        <input
          type="range"
          min="3"
          max="20"
          value={paletteSize}
          onChange={(e) => onPaletteSizeChange(Number(e.target.value))}
          disabled={!hasImage}
        />
        <span className="toolbar-value">{paletteSize}</span>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Format</span>
        <select
          className="toolbar-select"
          value={colorFormat}
          onChange={(e) => onColorFormatChange(e.target.value)}
          disabled={!hasImage}
        >
          <option value="hex">HEX</option>
          <option value="rgb">RGB</option>
          <option value="hsl">HSL</option>
        </select>
      </div>
    </div>
  );
};

export default Toolbar;
