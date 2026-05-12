const DETAIL_OPTIONS = ["essential", "balanced", "rich"];

const Toolbar = ({
  hasImage,
  mode,
  onModeChange,
  detail,
  onDetailChange,
  colorFormat,
  onColorFormatChange,
  onChangeImage,
  isMobile,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <span className="toolbar-label">Mode</span>
        <select
          className="toolbar-select"
          value={mode}
          onChange={(e) => onModeChange(e.target.value)}
          disabled={!hasImage}
        >
          <option value="faithful">Faithful</option>
          <option value="design">Design</option>
          <option value="complete">Complete</option>
        </select>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Detail</span>
        <div className="segment-group">
          {DETAIL_OPTIONS.map((opt) => (
            <button
              key={opt}
              className={`segment-btn${detail === opt ? " active" : ""}`}
              onClick={() => onDetailChange(opt)}
              disabled={!hasImage}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
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
          <path
            d="M8 2v5M8 7L5.5 4.5M8 7l2.5-2.5M3 10v2a1 1 0 001 1h8a1 1 0 001-1v-2"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {!isMobile && <span>Upload</span>}
      </button>
    </div>
  );
};

export default Toolbar;
