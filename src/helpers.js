export { extractPalette } from "./paletteEngine";
export { rgbToHex, rgbToHsl, formatColor } from "./colorUtils";

export const copyToClipboard = (str) => {
  navigator.clipboard.writeText(str);
};
