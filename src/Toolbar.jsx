import Select from "./Select";

const DETAIL_OPTIONS = ["essential", "balanced", "rich"];

const MODE_OPTIONS = [
  { value: "faithful", label: "Faithful" },
  { value: "design", label: "Design" },
  { value: "complete", label: "Complete" },
];

const FORMAT_OPTIONS = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

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
        <Select
          label="Mode"
          value={mode}
          onValueChange={onModeChange}
          options={MODE_OPTIONS}
          disabled={!hasImage}
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Detail</span>
        {isMobile ? (
          <Select
            label="Detail"
            value={detail}
            onValueChange={onDetailChange}
            options={DETAIL_OPTIONS.map((opt) => ({
              value: opt,
              label: capitalize(opt),
            }))}
            disabled={!hasImage}
          />
        ) : (
          <div className="segment-group">
            {DETAIL_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`segment-btn${detail === opt ? " active" : ""}`}
                onClick={() => onDetailChange(opt)}
                disabled={!hasImage}
              >
                {capitalize(opt)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <span className="toolbar-label">Format</span>
        <Select
          label="Format"
          value={colorFormat}
          onValueChange={onColorFormatChange}
          options={FORMAT_OPTIONS}
          disabled={!hasImage}
        />
      </div>

      {!isMobile && (
        <>
          <div className="toolbar-divider" />
          <button className="btn-ghost" onClick={onChangeImage}>
            <UploadIcon />
            <span>Upload</span>
          </button>
        </>
      )}
    </div>
  );
};

export const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M8 2v5M8 7L5.5 4.5M8 7l2.5-2.5M3 10v2a1 1 0 001 1h8a1 1 0 001-1v-2"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Toolbar;
