export type View = { scale: number; x: number; y: number };

export function fitView(containerWidth: number, containerHeight: number, imageWidth: number, imageHeight: number): View {
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight) * 0.94;
  return {
    scale,
    x: (containerWidth - imageWidth * scale) / 2,
    y: (containerHeight - imageHeight * scale) / 2,
  };
}

export function zoomAt(view: View, pointerX: number, pointerY: number, nextScale: number): View {
  const imageX = (pointerX - view.x) / view.scale;
  const imageY = (pointerY - view.y) / view.scale;
  return {
    scale: nextScale,
    x: pointerX - imageX * nextScale,
    y: pointerY - imageY * nextScale,
  };
}
