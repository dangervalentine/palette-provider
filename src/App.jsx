import { useCallback, useState, useRef } from "react";
import Header from "./Header";
import Toolbar from "./Toolbar";
import Palette from "./Palette";
import { kMeansClustering, samplePixels, classifyTiers } from "./helpers";
import { useMediaQuery } from "./hooks/useMediaQuery";

import "./App.css";
import upload from "./upload.svg";

let imgSrc;

const App = () => {
  const isMobile = useMediaQuery("(max-width: 800px)");
  const [fileName, setFileName] = useState("");
  const [image, setImage] = useState("");
  const [paletteSize, setPaletteSize] = useState(8);
  const [colorFormat, setColorFormat] = useState("hex");
  const [colors, setColors] = useState([]);
  const photoContainer = useRef(null);
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

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
        const height = (canvas.height = img.height);
        const width = (canvas.width = img.width);

        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height).data;
        const pixelData = [];
        const step = Math.max(1, Math.floor((width * height) / 5000));
        for (let i = 0; i < imageData.length; i += 4 * step) {
          pixelData.push([imageData[i], imageData[i + 1], imageData[i + 2]]);
        }

        const sampled = samplePixels(pixelData, 500);
        const clusters = kMeansClustering(sampled, paletteSize);
        const tiered = classifyTiers(clusters);
        setColors(tiered);
      };
      img.src = imgSrc;
    },
    [canvasRef, fileName, paletteSize]
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

  const handlePaletteSizeChange = useCallback(
    (newSize) => {
      setPaletteSize(newSize);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (imgSrc) processImg();
      }, 150);
    },
    [processImg]
  );

  const hasImage = fileName !== "";

  const handleOriginalPaneClick = useCallback(() => {
    if (!hasImage) {
      inputRef.current?.click();
    }
  }, [hasImage]);

  let helperContent;
  if (!hasImage) {
    helperContent = (
      <span className="helper-step">Drop an image here or click to upload</span>
    );
  } else {
    helperContent = isMobile ? (
      <span className="helper-step">Tap swatches to copy color values</span>
    ) : (
      <>
        <span className="helper-step">Hover swatches to preview</span>
        <span className="helper-dot" />
        <span className="helper-step">Click to copy color value</span>
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header />
      <Toolbar
        hasImage={hasImage}
        paletteSize={paletteSize}
        onPaletteSizeChange={handlePaletteSizeChange}
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
                    <img className="image-file" src={image} alt="uploaded file" />
                  </div>
                </div>
                <div className="split-pane palette-pane">
                  <div className="pane-label">Palette</div>
                  <Palette colors={colors} format={colorFormat} />
                </div>
              </div>
            ) : (
              <div className="photo border" onClick={() => inputRef.current?.click()}>
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
              <div className="split-pane original-pane" onClick={handleOriginalPaneClick}>
                <div className="pane-label">{hasImage ? "Original" : "Upload"}</div>
                {hasImage ? (
                  <div className="image-wrapper">
                    <img className="image-file" src={image} alt="uploaded file" />
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
                  <Palette colors={colors} format={colorFormat} />
                ) : (
                  <div className="empty-preview">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                      <circle cx="15" cy="15" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" fill="currentColor" fillOpacity="0.15" />
                      <circle cx="33" cy="15" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" fill="currentColor" fillOpacity="0.15" />
                      <circle cx="15" cy="33" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" fill="currentColor" fillOpacity="0.15" />
                      <circle cx="33" cy="33" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" fill="currentColor" fillOpacity="0.15" />
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
