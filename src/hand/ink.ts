import { loadImage } from '../capture/prepareSlide';

export async function inkColorFromSample(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    const size = 96;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read that handwriting sample.');
    ctx.drawImage(image, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 160) continue;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luminance > 196) continue;
      red += r;
      green += g;
      blue += b;
      count += 1;
    }
    if (count < 24) throw new Error('Could not find ink in that sample. Use a photo of writing on a light page.');
    return rgbToHex(red / count, green / count, blue / count);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function rgbToHex(red: number, green: number, blue: number) {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}
