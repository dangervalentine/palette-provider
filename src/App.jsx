import { useCallback, useState, useRef } from "react";
import Header from "./Header";
import Toolbar from "./Toolbar";
import Palette from "./Palette";
import { extractPalette, formatColor } from "./helpers";
import { useMediaQuery } from "./hooks/useMediaQuery";

import "./App.css";
import upload from "./upload.svg";

let imgSrc;
let lastImageData;
let lastWidth;
let lastHeight;

const App = () => {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const [fileName, setFileName] = useState("");
  const [image, setImage] = useState("");
  const [mode, setMode] = useState("faithful");
  const [detail, setDetail] = useState("balanced");
  const [colorFormat, setColorFormat] = useState("hex");
  const [colors, setColors] = useState([]);
  const photoContainer = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);

  const runExtraction = useCallback(
    (imageData, width, height, opts) => {
      const result = extractPalette(imageData, width, height, opts);
      setColors(result);
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
        runExtraction(lastImageData, w, h, { mode, detail });
      };
      img.src = imgSrc;
    },
    [fileName, mode, detail, runExtraction]
  );

  const reprocess = useCallback(
    (newMode, newDetail) => {
      if (!lastImageData) return;
      runExtraction(lastImageData, lastWidth, lastHeight, {
        mode: newMode,
        detail: newDetail,
      });
    },
    [runExtraction]
  );

  const handleModeChange = useCallback(
    (newMode) => {
      setMode(newMode);
      reprocess(newMode, detail);
    },
    [detail, reprocess]
  );

  const handleDetailChange = useCallback(
    (newDetail) => {
      setDetail(newDetail);
      reprocess(mode, newDetail);
    },
    [mode, reprocess]
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

  const downloadPalette = useCallback(() => {
    if (colors.length === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    const stripeW = 1200 / colors.length;

    colors.forEach((c, i) => {
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
  }, [colors, colorFormat, fileName]);

  const hasImage = fileName !== "";

  const handleOriginalPaneClick = useCallback(() => {
    if (!hasImage) {
      inputRef.current?.click();
    }
  }, [hasImage]);

  let helperContent;
  if (!hasImage) {
    helperContent = (
      <span className="helper-step">
        Drop an image here or click to upload
      </span>
    );
  } else {
    helperContent = isMobile ? (
      <span className="helper-step">Tap swatches to copy color values</span>
    ) : (
      <>
        <span className="helper-step">Click swatches to copy</span>
        <span className="helper-dot" />
        <span className="helper-step">Download palette as image</span>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Toolbar
        hasImage={hasImage}
        mode={mode}
        onModeChange={handleModeChange}
        detail={detail}
        onDetailChange={handleDetailChange}
        colorFormat={colorFormat}
        onColorFormatChange={setColorFormat}
        onChangeImage={() => inputRef.current?.click()}
        isMobile={isMobile}
      />
      <div className="helper-bar">
        <div className="helper-text">{helperContent}</div>
      </div>
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
                    <img
                      className="image-file"
                      src={image}
                      alt="uploaded file"
                    />
                  </div>
                </div>
                <div className="split-pane palette-pane">
                  <div className="pane-label">Palette</div>
                  <Palette
                    colors={colors}
                    format={colorFormat}
                    onDownload={downloadPalette}
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
                onClick={handleOriginalPaneClick}
              >
                <div className="pane-label">
                  {hasImage ? "Source" : "Upload"}
                </div>
                {hasImage ? (
                  <div className="image-wrapper">
                    <img
                      className="image-file"
                      src={image}
                      alt="uploaded file"
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
                <div className="pane-label">Palette</div>
                {hasImage ? (
                  <Palette
                    colors={colors}
                    format={colorFormat}
                    onDownload={downloadPalette}
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
    </div>
  );
};

export default App;
