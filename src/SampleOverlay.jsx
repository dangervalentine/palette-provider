import { useEffect, useRef } from "react";

// Longest side of the overlay canvas; CSS stretches it over the image.
const MAX_SIDE = 900;

const DIM = 0.6;

// Dots appear over this long, each at a random moment, and take DOT_MS to
// grow in. The dim fades in over DIM_MS when the overlay first shows.
const SPREAD_MS = 120;
const DOT_MS = 260;
const DIM_MS = 250;

const easeOutBack = (t) => {
  const s = 1.7;
  const u = t - 1;
  return 1 + u * u * ((s + 1) * u + s);
};

// Dims the image and marks the sample points that joined one family, so the
// user can see which parts of the photo a color came from. It stays mounted
// with no family so it can fade out rather than vanish.
const SampleOverlay = ({ analysis, family, width, height }) => {
  const canvasRef = useRef(null);
  const shownRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !family) {
      shownRef.current = false;
      return;
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    const r = Math.max(1.2, Math.max(canvas.width, canvas.height) / 480);
    const fill = `rgb(${family.rgb.join(",")})`;
    const dots = family.members.map((i) => {
      const p = analysis.points[i];
      return {
        x: (p.x + 0.5) * scale,
        y: (p.y + 0.5) * scale,
        delay: Math.random() * SPREAD_MS,
      };
    });

    // Switching straight from one family to another keeps the dim as it is
    const fadeDim = !shownRef.current;
    shownRef.current = true;

    const draw = (elapsed) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dim = fadeDim ? Math.min(1, elapsed / DIM_MS) : 1;
      ctx.fillStyle = `rgba(1, 14, 24, ${DIM * dim})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        const t = Math.min(1, Math.max(0, (elapsed - d.delay) / DOT_MS));
        if (t <= 0) continue;
        const k = easeOutBack(t);
        ctx.beginPath();
        ctx.arc(d.x, d.y, (r + 0.8) * k, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x, d.y, r * k, 0, 2 * Math.PI);
        ctx.fillStyle = fill;
        ctx.fill();
      }
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      draw(Infinity);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      draw(elapsed);
      if (elapsed < SPREAD_MS + DOT_MS) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analysis, family, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={`sample-overlay${family ? " is-shown" : ""}`}
      aria-hidden="true"
    />
  );
};

export default SampleOverlay;
