import { useEffect, useId, useRef } from "react";
import { colorSpacePlot } from "./viz/colorSpace";

// Motion lives here rather than in viz/colorSpace.js, which also renders the
// README art and must stay static.
const reducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_POP = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// Where each peak sits, by family index, read back from the drawn plot.
const peakPositions = (svg) =>
  [...svg.querySelectorAll(".cs-peak")].map((node) => ({
    family: Number(node.parentNode.dataset.family),
    x: Number(node.getAttribute("cx")),
    y: Number(node.getAttribute("cy")),
  }));

// A fresh image: the samples ripple out from the center, then the peaks pop.
function animateEntrance(svg) {
  const c = svg.viewBox.baseVal.width / 2;
  const bins = svg.querySelectorAll("g[clip-path] > rect");
  for (const bin of bins) {
    const x = Number(bin.getAttribute("x")) - c;
    const y = Number(bin.getAttribute("y")) - c;
    bin.animate([{ opacity: 0 }, { opacity: bin.getAttribute("opacity") }], {
      duration: 350,
      delay: (Math.hypot(x, y) / c) * 350,
      easing: "ease-out",
      fill: "backwards",
    });
  }
  svg.querySelectorAll(".cs-peak").forEach((node, i) =>
    node.animate([{ transform: "scale(0)" }, { transform: "scale(1)" }], {
      duration: 420,
      delay: 300 + i * 40,
      easing: EASE_POP,
      fill: "backwards",
    })
  );
  svg.querySelectorAll(".cs-sep, .cs-tick").forEach((node) =>
    node.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: 400,
      delay: 450,
      fill: "backwards",
    })
  );
}

// The same image with its families merged or split: each peak glides in
// from the nearest peak of the plot it replaces, so merges read as peaks
// joining and splits as one peak coming apart.
function animateMorph(svg, before) {
  const after = peakPositions(svg);
  for (const { family, x, y } of after) {
    let from = before[0];
    for (const p of before) {
      if (Math.hypot(p.x - x, p.y - y) < Math.hypot(from.x - x, from.y - y)) from = p;
    }
    const dx = from.x - x;
    const dy = from.y - y;
    const nodes = svg.querySelectorAll(
      `[data-family="${family}"] .cs-peak, [data-family="${family}"] .cs-sep`
    );
    for (const node of nodes) {
      node.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
        { duration: 500, easing: EASE_OUT }
      );
    }
  }
  svg.querySelectorAll(".cs-tick").forEach((node) =>
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 250, fill: "backwards" })
  );
}

// The selected family's samples burst out from its peak.
function animateMembers(svg, family) {
  const peak = svg.querySelector(`[data-family="${family}"] .cs-peak`);
  const dots = svg.querySelectorAll(".cs-members circle");
  if (!peak || !dots.length) return;
  const px = Number(peak.getAttribute("cx"));
  const py = Number(peak.getAttribute("cy"));
  const dist = [...dots].map((d) =>
    Math.hypot(Number(d.getAttribute("cx")) - px, Number(d.getAttribute("cy")) - py)
  );
  const far = Math.max(1, ...dist);
  peak.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
    { duration: 380, easing: "ease-out" }
  );
  svg
    .querySelector(`[data-family="${family}"] .cs-sep`)
    ?.animate([{ transform: "scale(0.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], {
      duration: 450,
      easing: EASE_OUT,
    });
  dots.forEach((dot, i) => {
    dot.animate(
      [
        { transform: `translate(${px - dot.cx.baseVal.value}px, ${py - dot.cy.baseVal.value}px)`, opacity: 0 },
        { transform: "none", opacity: 0.55 },
      ],
      { duration: 450, delay: (dist[i] / far) * 60, easing: EASE_OUT, fill: "backwards" }
    );
  });
}

// The OKLAB a/b plot from src/viz/colorSpace.js, the same one the README art
// uses. It is built as plain SVG once per image; selection only toggles
// classes and redraws the selected family's samples, or one shade's.
const ColorSpace = ({ analysis, detail, selection, onSelect }) => {
  const selectedFamily = selection?.family ?? null;
  const family = analysis.families[selectedFamily];
  const shade = family?.shades[detail][selection.shade];

  const hostRef = useRef(null);
  const plotRef = useRef(null);
  const idPrefix = `cs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const previousRef = useRef(null);

  useEffect(() => {
    const plot = colorSpacePlot({
      oklab: analysis.oklab,
      families: analysis.families,
      idPrefix,
    });
    const previous = previousRef.current;
    hostRef.current.replaceChildren(plot.node);
    plotRef.current = plot;
    if (!reducedMotion()) {
      if (previous?.oklab === analysis.oklab && previous.peaks.length) {
        animateMorph(plot.node, previous.peaks);
      } else {
        animateEntrance(plot.node);
      }
    }
    return () => {
      previousRef.current = { oklab: analysis.oklab, peaks: peakPositions(plot.node) };
      plotRef.current = null;
    };
  }, [analysis, idPrefix]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    plot.select(selectedFamily, shade?.members);
    if (selectedFamily != null && !reducedMotion()) {
      animateMembers(plot.node, selectedFamily);
    }
  }, [analysis, selectedFamily, shade]);

  const onClick = (e) => {
    const node = e.target.closest("[data-family]");
    if (!node) return;
    onSelect(Number(node.dataset.family));
  };

  return (
    <div className="color-space">
      <div className="color-space-plot" ref={hostRef} onClick={onClick} />
      <p className="view-caption">
        {shade
          ? `Showing the ${shade.members.length.toLocaleString()} samples behind this color.`
          : family
          ? `Showing the ${family.members.length.toLocaleString()} samples that joined this family.`
          : "Select a peak or a color to see the samples that joined its family."}
      </p>
      <ul className="cs-legend">
        {LEGEND.map(({ glyph, label }) => (
          <li key={label}>
            <svg
              className="cs-legend-glyph"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              {glyph}
            </svg>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Each glyph uses the plot's own cs-* classes, so the key always matches it
const LEGEND = [
  {
    glyph: (
      <>
        <rect x="3" y="3" width="6" height="6" fill="#d9774f" />
        <rect x="11" y="3" width="6" height="6" fill="#d9774f" opacity="0.5" />
        <rect x="3" y="11" width="6" height="6" fill="#4f8fd9" opacity="0.7" />
        <rect x="11" y="11" width="6" height="6" fill="#4f8fd9" opacity="0.3" />
      </>
    ),
    label: "Image colors, stronger where more common",
  },
  {
    glyph: <circle className="cs-peak" cx="10" cy="10" r="5" fill="#9a6fd0" />,
    label: "A family's peak, its most common color",
  },
  {
    glyph: <circle className="cs-legend-sep" cx="10" cy="10" r="8" />,
    label: "Its reach: a peak outside it becomes a new family",
  },
  {
    glyph: <line className="cs-tick" x1="10" y1="2" x2="10" y2="18" />,
    label: "Ring ticks set the Family order",
  },
];

export default ColorSpace;
