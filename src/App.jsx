import { useCallback, useMemo, useState, useRef } from "react";
import Header from "./Header";
import Toolbar from "./Toolbar";
import { GithubAttribution } from "./GithubAttribution";
import ResultPanel from "./ResultPanel";
import SampleOverlay from "./SampleOverlay";
import { formatColor, copyToClipboard } from "./helpers";
import { analyzeImage, paletteFor } from "./paletteEngine";
import { useMediaQuery } from "./hooks/useMediaQuery";
import EyedropperPreview from "./EyedropperPreview";
import { useEyedropper } from "./hooks/useEyedropper";
import { ORDERS, orderColors } from "./paletteOrder";

import "./App.css";
import upload from "./upload.svg";

let imgSrc;

const ORDER_STORAGE_KEY = "palette-provider-order";

const readStoredOrder = () => {
  try {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY);
    // "hue" was the earlier name for grouping by family
    if (stored === "hue") return "family";
    return ORDERS.includes(stored) ? stored : "prevalence";
  } catch {
    return "prevalence";
  }
};

const App = () => {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const [fileName, setFileName] = useState("");
  const [image, setImage] = useState("");
  const [detail, setDetail] = useState("balanced");
  const [colorFormat, setColorFormat] = useState("hex");
  const [order, setOrder] = useState(readStoredOrder);
  // Everything the engine found in the current image; Detail only picks
  // which of its precomputed shades make up the palette.
  const [analysis, setAnalysis] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const photoContainer = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  const colors = useMemo(
    () =>
      analysis
        ? paletteFor(analysis, detail).map((c, i) => ({ ...c, key: `extracted-${i}` }))
        : [],
    [analysis, detail]
  );

  const copy = useCallback((value, message = `Copied ${value}`) => {
    copyToClipboard(value);
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 1400);
  }, []);

  // The eyedropper is read-only: it copies the pixel under the pointer and
  // leaves the palette as the engine found it.
  const handleSampleColor = useCallback(
    ({ color }) => copy(formatColor(color, colorFormat)),
    [copy, colorFormat]
  );

  const eyedropper = useEyedropper(canvasRef, handleSampleColor);

  const processImg = useCallback(
    (file) => {
      if (!file && !imgSrc) return;

      if (file) {
        imgSrc = URL.createObjectURL(file);
      }

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      setFileName(file?.name ?? fileName);
      setImage(imgSrc);

      img.onload = () => {
        const w = (canvas.width = img.width);
        const h = (canvas.height = img.height);
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        setImageSize({ width: w, height: h });
        setSelectedFamily(null);
        setAnalysis(analyzeImage(data, w, h));
      };
      img.src = imgSrc;
    },
    [fileName]
  );

  const onChange = (e) => {
    if (!e.target.files.length) return;
    processImg(e.target.files[0]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    if (!e.dataTransfer) return;
    processImg(e.dataTransfer.files[0]);
    photoContainer.current.classList.remove("drag-over");
  };

  const onDragOver = (e) => {
    e.preventDefault();
    photoContainer.current.classList.add("drag-over");
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    photoContainer.current.classList.remove("drag-over");
  };

  const handleOrderChange = useCallback((next) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, next);
    } catch {
      // Storage unavailable; the choice just won't be remembered
    }
  }, []);

  const downloadPalette = useCallback(() => {
    if (colors.length === 0) return;

    // The PNG matches the order shown in the palette strip
    const sorted = orderColors(colors, order);

    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    const stripeW = 1200 / sorted.length;

    sorted.forEach((c, i) => {
      ctx.fillStyle = `rgb(${c.color[0]}, ${c.color[1]}, ${c.color[2]})`;
      ctx.fillRect(i * stripeW, 0, stripeW, 800);

      ctx.fillStyle = c.okL > 0.5 ? "#000000" : "#FFFFFF";
      ctx.font = "bold 18px Outfit, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        formatColor(c.color, colorFormat),
        i * stripeW + stripeW / 2,
        400
      );
    });

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `palette-${fileName || "image"}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [colors, order, colorFormat, fileName]);

  const hasImage = fileName !== "";

  const clearImage = useCallback(() => {
    imgSrc = undefined;
    setFileName("");
    setImage("");
    setAnalysis(null);
    setSelectedFamily(null);
  }, []);

  const handleOriginalPaneClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const selected = analysis?.families[selectedFamily];

  const sourceImage = (
    <div className="image-wrapper">
      <button className="image-remove" onClick={clearImage}>
        &times;
      </button>
      <img
        ref={eyedropper.bindImage}
        className="image-file eyedropper-active"
        src={image}
        alt="uploaded file"
        {...eyedropper.handlers}
      />
      {selected && (
        <>
          <SampleOverlay
            analysis={analysis}
            family={selected}
            width={imageSize.width}
            height={imageSize.height}
          />
          <button
            className="overlay-chip"
            onClick={() => setSelectedFamily(null)}
            aria-label="Stop showing this family's samples"
          >
            <span
              className="overlay-chip-dot"
              style={{ backgroundColor: `rgb(${selected.rgb.join(",")})` }}
            />
            <span>Samples of this family</span>
            <span aria-hidden="true">&times;</span>
          </button>
        </>
      )}
    </div>
  );

  const resultPanel = analysis ? (
    <ResultPanel
      analysis={analysis}
      colors={colors}
      detail={detail}
      format={colorFormat}
      order={order}
      onOrderChange={handleOrderChange}
      selectedFamily={selectedFamily}
      onSelectFamily={setSelectedFamily}
      onCopy={copy}
      onDownload={downloadPalette}
      isMobile={isMobile}
    />
  ) : null;

  const helperContent = !hasImage ? (
    <span className="helper-step">
      Drop an image here or click to upload
    </span>
  ) : null;

  return (
    <div className="app-shell">
      <Header
        onUpload={isMobile ? () => inputRef.current?.click() : undefined}
      />
      <Toolbar
        hasImage={hasImage}
        detail={detail}
        onDetailChange={setDetail}
        colorFormat={colorFormat}
        onColorFormatChange={setColorFormat}
        onChangeImage={() => inputRef.current?.click()}
        isMobile={isMobile}
      />
      {helperContent && (
        <div className="helper-bar">
          <div className="helper-text">{helperContent}</div>
        </div>
      )}
      <div className="container">
        <div
          ref={photoContainer}
          className="photo-container"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {isMobile ? (
            hasImage ? (
              <div className="split-view">
                <div className="split-pane original-pane">
                  <div className="pane-label">Source</div>
                  {sourceImage}
                </div>
                <div className="split-pane palette-pane">
                  {resultPanel}
                </div>
              </div>
            ) : (
              <div
                className="photo border"
                onClick={() => inputRef.current?.click()}
              >
                <div className="empty-state">
                  <img src={upload} alt="upload" />
                  <div className="image-text">
                    <span className="bold">Choose a file</span>
                    <div className="tagline">or drag it here</div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="split-view">
              <div
                className="split-pane original-pane"
                onClick={hasImage ? undefined : handleOriginalPaneClick}
              >
                <div className="pane-label">
                  {hasImage ? "Source" : "Upload"}
                </div>
                {hasImage ? (
                  sourceImage
                ) : (
                  <div className="empty-state">
                    <img src={upload} alt="upload" />
                    <div className="image-text">
                      <span className="bold">Choose a file</span>
                      <div className="tagline">or drag it here</div>
                    </div>
                  </div>
                )}
              </div>
              <div className="split-pane palette-pane">
                {/* Once loaded, the palette's own header labels the pane */}
                {!hasImage && <div className="pane-label">Palette</div>}
                {hasImage ? (
                  resultPanel
                ) : (
                  <div className="empty-preview">
                    <svg
                      width="48"
                      height="48"
                      viewBox="0 0 48 48"
                      fill="none"
                    >
                      <circle
                        cx="15"
                        cy="15"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="33"
                        cy="15"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="15"
                        cy="33"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                      <circle
                        cx="33"
                        cy="33"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        fill="currentColor"
                        fillOpacity="0.15"
                      />
                    </svg>
                    <span>Your palette, and how it was found, will appear here</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <canvas ref={canvasRef} className="main-canvas" />
        </div>
        <input
          ref={inputRef}
          accept="image/*"
          type="file"
          onChange={onChange}
        />
      </div>
      <EyedropperPreview preview={eyedropper.preview} format={colorFormat} />
      <div className="toast" role="status" aria-live="polite">
        {toast && <span className="toast-message">{toast}</span>}
      </div>
      <GithubAttribution />
    </div>
  );
};

export default App;
