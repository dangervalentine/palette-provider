import { useEffect, useRef } from "react";

// Longest side of the overlay canvas; CSS stretches it over the image.
const MAX_SIDE = 900;

// Dims the image and marks the sample points that joined one family, so the
// user can see which parts of the photo a color came from.
const SampleOverlay = ({ analysis, family, width, height }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !family) return;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(1, 14, 24, 0.6)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const r = Math.max(1.2, Math.max(canvas.width, canvas.height) / 480);
    const fill = `rgb(${family.rgb.join(",")})`;
    for (const i of family.members) {
      const p = analysis.points[i];
      const x = (p.x + 0.5) * scale;
      const y = (p.y + 0.5) * scale;
      ctx.beginPath();
      ctx.arc(x, y, r + 0.8, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }, [analysis, family, width, height]);

  if (!family) return null;
  return <canvas ref={canvasRef} className="sample-overlay" aria-hidden="true" />;
};

export default SampleOverlay;
