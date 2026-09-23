import Select from "./Select";
import { COLOR_LIMITS } from "./paletteEngine";

const DETAIL_OPTIONS = ["essential", "balanced", "rich"];

// Radix Select values are strings; the engine takes "all" or a number.
const COLOR_OPTIONS = COLOR_LIMITS.map((limit) => ({
  value: String(limit),
  label: limit === "all" ? "All" : `Up to ${limit}`,
}));
const parseLimit = (value) => (value === "all" ? "all" : Number(value));

const FORMAT_OPTIONS = [
  { value: "hex", label: "HEX" },
  { value: "rgb", label: "RGB" },
  { value: "hsl", label: "HSL" },
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const Toolbar = ({
  hasImage,
  detail,
  onDetailChange,
  colorLimit,
  onColorLimitChange,
  colorFormat,
  onColorFormatChange,
  onChangeImage,
  isMobile,
}) => {
  return (
    <div className="toolbar">
      {/* Sits beside the options, next to the palette pane they change */}
      {!isMobile && (
        <>
          <button className="btn-ghost" onClick={onChangeImage}>
            <UploadIcon />
            <span>{hasImage ? "Replace" : "Upload"}</span>
          </button>
          <div className="toolbar-divider" />
        </>
      )}

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
        <span className="toolbar-label">Colors</span>
        <Select
          label="Colors"
          value={String(colorLimit)}
          onValueChange={(value) => onColorLimitChange(parseLimit(value))}
          options={COLOR_OPTIONS}
          disabled={!hasImage}
        />
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
