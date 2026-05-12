export { extractPalette } from "./paletteEngine";
export { classifyTiers } from "./tierClassifier";
export { rgbToHex, rgbToHsl, formatColor } from "./colorUtils";

export const copyToClipboard = (str) => {
  navigator.clipboard.writeText(str);
};
