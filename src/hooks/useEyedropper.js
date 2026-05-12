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
