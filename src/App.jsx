import { useCallback, useState, useRef } from "react";
import Header from "./Header";
import Toolbar from "./Toolbar";
import { GithubAttribution } from "./GithubAttribution";
import Palette from "./Palette";
import { extractPalette, formatColor } from "./helpers";
import { useMediaQuery } from "./hooks/useMediaQuery";
import EyedropperPreview from "./EyedropperPreview";
import { useEyedropper } from "./hooks/useEyedropper";
import { ORDERS, orderColors } from "./paletteOrder";

import "./App.css";
import upload from "./upload.svg";

let imgSrc;
let lastImageData;
let lastWidth;
let lastHeight;

const ORDER_STORAGE_KEY = "palette-provider-order";

const readStoredOrder = () => {
  try {
    const stored = localStorage.getItem(ORDER_STORAGE_KEY);
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
  const [colors, setColors] = useState([]);
  const [hiddenKeys, setHiddenKeys] = useState(new Set());
  const photoContainer = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  const [sampledColors, setSampledColors] = useState([]);
  const sampleCounter = useRef(0);

  // Samples matching a color already shown are ignored. A hidden color can be
  // sampled back in, so the RGB string alone still isn't a unique key.
  const handleSampleColor = useCallback(
    (sampledColor) => {
      const rgb = sampledColor.color.join(",");
      const key = `sampled-${sampleCounter.current++}`;
      setSampledColors((prev) => {
        const alreadyShown = [...colors, ...prev].some(
          (c) => !hiddenKeys.has(c.key) && c.color.join(",") === rgb
        );
        return alreadyShown ? prev : [...prev, { ...sampledColor, key }];
      });
    },
    [colors, hiddenKeys]
  );

  const eyedropper = useEyedropper(canvasRef, handleSampleColor);

  const runExtraction = useCallback(
    (imageData, width, height, opts) => {
      const result = extractPalette(imageData, width, height, opts);
      setColors(result.map((c, i) => ({ ...c, key: `extracted-${i}` })));
      setHiddenKeys(new Set());
    },
    []
  );

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
        lastImageData = ctx.getImageData(0, 0, w, h).data;
        lastWidth = w;
        lastHeight = h;
        setSampledColors([]);
        runExtraction(lastImageData, w, h, { detail });
      };
      img.src = imgSrc;
    },
    [fileName, detail, runExtraction]
  );

  const handleDetailChange = useCallback(
    (newDetail) => {
      setDetail(newDetail);
      if (!lastImageData) return;
      setSampledColors([]);
      runExtraction(lastImageData, lastWidth, lastHeight, { detail: newDetail });
    },
    [runExtraction]
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

  const handleRemoveColor = useCallback((key) => {
    setHiddenKeys((prev) => new Set(prev).add(key));
  }, []);

  const visibleColors = [...colors, ...sampledColors].filter(
    (c) => !hiddenKeys.has(c.key)
  );

  const handleOrderChange = useCallback((next) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, next);
    } catch {
      // Storage unavailable; the choice just won't be remembered
    }
  }, []);

  const downloadPalette = useCallback(() => {
    if (visibleColors.length === 0) return;

    // The PNG matches the order shown in the palette strip
    const sorted = orderColors(visibleColors, order);

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
  }, [visibleColors, order, colorFormat, fileName]);

  const hasImage = fileName !== "";

  const clearImage = useCallback(() => {
    imgSrc = undefined;
    lastImageData = undefined;
    lastWidth = undefined;
    lastHeight = undefined;
    setFileName("");
    setImage("");
    setColors([]);
    setHiddenKeys(new Set());
    setSampledColors([]);
  }, []);

  const handleOriginalPaneClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

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
        onDetailChange={handleDetailChange}
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
                  </div>
                </div>
                <div className="split-pane palette-pane">
                  <div className="pane-label">Palette</div>
                  <Palette
                    colors={visibleColors}
                    format={colorFormat}
                    onDownload={downloadPalette}
                    onRemoveColor={handleRemoveColor}
                    isMobile={isMobile}
                    order={order}
                    onOrderChange={handleOrderChange}
                  />
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
                  </div>
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
                  <Palette
                    colors={visibleColors}
                    format={colorFormat}
                    onDownload={downloadPalette}
                    onRemoveColor={handleRemoveColor}
                    isMobile={isMobile}
                    order={order}
                    onOrderChange={handleOrderChange}
                  />
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
                    <span>Your color palette will appear here</span>
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
      <GithubAttribution />
    </div>
  );
};

export default App;
