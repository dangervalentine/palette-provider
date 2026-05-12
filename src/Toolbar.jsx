const Toolbar = ({
  hasImage,
  paletteSize,
  onPaletteSizeChange,
  colorFormat,
  onColorFormatChange,
  onChangeImage,
  isMobile,
}) => {
  const pct = ((paletteSize - 3) / 17) * 100;

  return (
    <div className="toolbar">
      <div className="toolbar-group slider-group">
        <span className="toolbar-label">Colors</span>
        <div className="range-wrap">
          <input
            className="range-input"
            type="range"
            min="3"
            max="20"
            value={paletteSize}
            onChange={(e) => onPaletteSizeChange(Number(e.target.value))}
            disabled={!hasImage}
            style={{
              background: `linear-gradient(to right, var(--color-primary-main) 0%, var(--color-primary-main) ${pct}%, var(--color-border) ${pct}%, var(--color-border) 100%)`,
            }}
          />
          <span className="range-badge">{paletteSize}</span>
        </div>
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

      <div className="toolbar-divider" />

      <button className="btn-ghost" onClick={onChangeImage}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v5M8 7L5.5 4.5M8 7l2.5-2.5M3 10v2a1 1 0 001 1h8a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {!isMobile && <span>Upload</span>}
      </button>
    </div>
  );
};

export default Toolbar;
