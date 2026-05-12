import { useState, useCallback, useRef } from "react";
import { rgbToOklab } from "../oklab";

const LONG_PRESS_MS = 300;

export function mapToCanvasCoords(eventX, eventY, imgRect, canvas) {
  const relX = (eventX - imgRect.left) / imgRect.width;
  const relY = (eventY - imgRect.top) / imgRect.height;
  return {
    x: Math.max(0, Math.min(canvas.width - 1, Math.floor(relX * canvas.width))),
    y: Math.max(0, Math.min(canvas.height - 1, Math.floor(relY * canvas.height))),
  };
}

export function samplePixel(ctx, x, y) {
  const { data } = ctx.getImageData(x, y, 1, 1);
  return [data[0], data[1], data[2]];
}

export function useEyedropper(canvasRef, colorFormat, formatColorFn, onSample) {
  const [preview, setPreview] = useState(null); // { x, y, color, label }
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const imgRef = useRef(null);

  const getSample = useCallback(
    (eventX, eventY) => {
      const img = imgRef.current;
      const canvas = canvasRef.current;
      if (!img || !canvas) return null;
      const ctx = canvas.getContext("2d");
      const imgRect = img.getBoundingClientRect();
      const { x, y } = mapToCanvasCoords(eventX, eventY, imgRect, canvas);
      const rgb = samplePixel(ctx, x, y);
      return rgb;
    },
    [canvasRef]
  );

  const handlePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      isLongPress.current = false;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        const rgb = getSample(clientX, clientY);
        if (rgb) {
          setPreview({
            x: clientX,
            y: clientY,
            color: rgb,
            label: formatColorFn(rgb, colorFormat),
          });
        }
      }, LONG_PRESS_MS);
    },
    [getSample, colorFormat, formatColorFn]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isLongPress.current) return;
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const rgb = getSample(clientX, clientY);
      if (rgb) {
        setPreview({
          x: clientX,
          y: clientY,
          color: rgb,
          label: formatColorFn(rgb, colorFormat),
        });
      }
    },
    [getSample, colorFormat, formatColorFn]
  );

  const handlePointerUp = useCallback(
    (e) => {
      clearTimeout(longPressTimer.current);
      const clientX = e.changedTouches
        ? e.changedTouches[0].clientX
        : e.clientX;
      const clientY = e.changedTouches
        ? e.changedTouches[0].clientY
        : e.clientY;
      const rgb = getSample(clientX, clientY);
      setPreview(null);

      if (rgb && onSample) {
        const okL = rgbToOklab(rgb[0], rgb[1], rgb[2])[0];
        onSample({ color: rgb, tier: "sampled", okL });
      }
    },
    [getSample, onSample]
  );

  const bindImage = useCallback((imgEl) => {
    imgRef.current = imgEl;
  }, []);

  return {
    preview,
    bindImage,
    handlers: {
      onMouseDown: handlePointerDown,
      onMouseMove: handlePointerMove,
      onMouseUp: handlePointerUp,
      onTouchStart: handlePointerDown,
      onTouchMove: handlePointerMove,
      onTouchEnd: handlePointerUp,
    },
  };
}
