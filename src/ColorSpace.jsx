import { useEffect, useId, useRef } from "react";
import { colorSpacePlot } from "./viz/colorSpace";

// The OKLAB a/b plot from src/viz/colorSpace.js, the same one the README art
// uses. It is built as plain SVG once per image; selection only toggles
// classes and redraws the selected family's samples.
const ColorSpace = ({ analysis, selectedFamily, onSelectFamily }) => {
  const hostRef = useRef(null);
  const plotRef = useRef(null);
  const idPrefix = `cs${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const plot = colorSpacePlot({
      oklab: analysis.oklab,
      families: analysis.families,
      idPrefix,
    });
    hostRef.current.replaceChildren(plot.node);
    plotRef.current = plot;
    return () => {
      plotRef.current = null;
    };
  }, [analysis, idPrefix]);

  useEffect(() => {
    plotRef.current?.select(selectedFamily);
  }, [analysis, selectedFamily]);

  const onClick = (e) => {
    const node = e.target.closest("[data-family]");
    if (!node) return;
    const i = Number(node.dataset.family);
    onSelectFamily(i === selectedFamily ? null : i);
  };

  const family = analysis.families[selectedFamily];

  return (
    <div className="color-space">
      <div className="color-space-plot" ref={hostRef} onClick={onClick} />
      <p className="view-caption">
        {family
          ? `Showing the ${family.members.length.toLocaleString()} samples that joined this family. `
          : "Tap a peak or a color to see the samples that joined its family. "}
        On the OKLAB a/b plane the angle is hue and the distance from the
        center is chroma; lightness is flattened. A dashed circle is how far
        another peak must be to form its own family (lightness counts less, so
        circles can overlap here). Ring ticks mark the hues Family order follows.
      </p>
    </div>
  );
};

export default ColorSpace;
