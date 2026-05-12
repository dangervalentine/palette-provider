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

  const handleFormClick = () => inputRef.current.click();

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

  // Debounced reprocess when palette size changes
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

  const imageEl =
    image === "" ? (
      <div>
        <img src={upload} alt="upload" />
        <div className="image-text">
          <span className="bold">Choose a file</span> &nbsp;
          {!isMobile && "or drag it here"}
          <div className="tagline">
            Extract color palettes from any image
          </div>
        </div>
      </div>
    ) : (
      <div className="image-wrapper">
        <img className="image-file" src={image} alt="uploaded file" />
      </div>
    );

  return (
    <div>
      <Header />
      <Toolbar
        hasImage={hasImage}
        paletteSize={paletteSize}
        onPaletteSizeChange={handlePaletteSizeChange}
        colorFormat={colorFormat}
        onColorFormatChange={setColorFormat}
      />
      <div className="container">
        <div
          ref={photoContainer}
          className="photo-container"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div
            className={`photo${image === "" ? " border" : ""}`}
            onClick={handleFormClick}
          >
            {imageEl}
            <canvas ref={canvasRef} className="main-canvas" />
          </div>
        </div>
        <Palette colors={colors} format={colorFormat} />
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
