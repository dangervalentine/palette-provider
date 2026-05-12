# Eyedropper Color Sampler

## Overview

Add an eyedropper/color sampler tool to the source image pane. Users click or tap on any pixel in the image to sample its color and add it to the palette. A long-press (or mouse-hold) shows a floating preview of the color before committing.

## Interaction Model

- Always active on the source image when an image is loaded (no toggle)
- Cursor changes to `crosshair` when hovering the image
- **Click / quick tap:** Samples the pixel color at the event point and adds it to the "Sampled" section in the palette
- **Press and hold / long press:** A floating preview square appears above the cursor/finger showing the color and its formatted value. The preview follows the pointer and updates in real-time. On release, the color is added to the palette

## Floating Preview

- ~48px colored square with rounded corners
- Positioned ~60px above the event point (so a finger doesn't obscure it on mobile)
- Below the square: a label showing the color value in the active format (hex/rgb/hsl)
- Semi-transparent dark backdrop behind the label for readability
- Follows pointer/finger movement while held, updating the sampled color live
- Disappears on pointer/finger release (after adding the color)

## Pixel Sampling

- Uses the existing hidden `<canvas>` (`canvasRef`) which already contains the drawn image data
- Maps coordinates from the displayed `<img>` element's bounding rect to the canvas's native pixel space: `canvasX = (eventX - imgRect.left) / imgRect.width * canvas.width`
- Reads the pixel via `ctx.getImageData(canvasX, canvasY, 1, 1).data`

## Palette Integration

- Sampled colors appear as a new tier group labeled "sampled" below the existing tiers (dominant, supporting, accent)
- Uses the same swatch card component and styling as extracted colors
- Each sampled color can be individually removed via the existing remove mechanism

### Data Shape

Sampled colors use the same structure as extracted colors:

```js
{ color: [r, g, b], tier: "sampled", okL: <computed> }
```

- `okL` is computed from the sampled RGB for use in the download feature (dark/light text contrast)
- No `count` or `percentage` fields (not algorithmically derived)

### State Management

- Stored in a separate `sampledColors` state array in `App.jsx`
- Merged with the filtered `visibleColors` for display in `Palette`
- The `Palette` component already renders tier groups dynamically; adding `"sampled"` to the tiers array is sufficient

### Clearing Behavior

Sampled colors clear when:
- Extraction mode changes
- Detail level changes
- A new image is loaded
- The image is cleared

This is achieved by resetting `sampledColors` to `[]` in the same places `setColors` / `setHiddenKeys` are reset.

## Component Changes

### `App.jsx`
- Add `sampledColors` state and `setSampledColors`
- Add `handleSampleColor` callback: reads pixel from canvas, computes okL, appends to `sampledColors`
- Clear `sampledColors` in `reprocess`, `processImg`, and `clearImage`
- Pass `onSampleColor` and `canvasRef` (or a sampling function) to the image area
- Merge `sampledColors` into the colors passed to `Palette`
- Add refs/state for the floating preview (position, color, visible flag)
- Attach `onMouseDown`, `onMouseMove`, `onMouseUp`, `onTouchStart`, `onTouchMove`, `onTouchEnd` to the `<img>` element

### `Palette.jsx`
- Add `"sampled"` to the `tiers` array so sampled colors render in their own group

### `App.css`
- `crosshair` cursor on `.image-file` when image is present
- Floating preview styles: fixed/absolute positioned square, color label, backdrop
