import type { NormCrop, Rotation } from '../types';

const WORK_MAX = 4096;
const OUTPUT_MAX = 2400;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that image. Use a PNG or JPEG.'));
    image.src = src;
  });
}

export async function fileToImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not save the slide image.'));
      },
      type,
      quality,
    );
  });
}

function rotatedSize(width: number, height: number, rotation: Rotation) {
  if (rotation % 180 === 0) return { width, height };
  return { width: height, height: width };
}

function paintRotated(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  rotation: Rotation,
  destWidth: number,
  destHeight: number,
) {
  ctx.save();
  ctx.translate(destWidth / 2, destHeight / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  const drawWidth = rotation % 180 === 0 ? destWidth : destHeight;
  const drawHeight = rotation % 180 === 0 ? destHeight : destWidth;
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function scaleSource(image: HTMLImageElement) {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > WORK_MAX ? WORK_MAX / longest : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the slide.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return { canvas, width, height };
}

export async function renderRotatedPreview(image: HTMLImageElement, rotation: Rotation) {
  const fitted = scaleSource(image);
  const rotated = rotatedSize(fitted.width, fitted.height, rotation);
  const scale = Math.min(1, 1600 / Math.max(rotated.width, rotated.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rotated.width * scale));
  canvas.height = Math.max(1, Math.round(rotated.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not preview that image.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  paintRotated(ctx, fitted.canvas, rotation, canvas.width, canvas.height);
  return canvasToBlob(canvas, 'image/jpeg', 0.86);
}

export function clampCrop(crop: NormCrop): NormCrop {
  const min = 0.08;
  const w = Math.min(1, Math.max(min, crop.w));
  const h = Math.min(1, Math.max(min, crop.h));
  return {
    x: Math.min(Math.max(0, crop.x), 1 - w),
    y: Math.min(Math.max(0, crop.y), 1 - h),
    w,
    h,
  };
}

export async function prepareSlideImage(image: HTMLImageElement, rotation: Rotation, crop: NormCrop) {
  const fitted = scaleSource(image);
  const rotated = rotatedSize(fitted.width, fitted.height, rotation);
  const framed = clampCrop(crop);
  const cropX = Math.round(framed.x * rotated.width);
  const cropY = Math.round(framed.y * rotated.height);
  const cropW = Math.max(1, Math.round(framed.w * rotated.width));
  const cropH = Math.max(1, Math.round(framed.h * rotated.height));

  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = rotated.width;
  rotatedCanvas.height = rotated.height;
  const rotatedCtx = rotatedCanvas.getContext('2d');
  if (!rotatedCtx) throw new Error('Could not prepare the slide.');
  rotatedCtx.imageSmoothingEnabled = true;
  rotatedCtx.imageSmoothingQuality = 'high';
  paintRotated(rotatedCtx, fitted.canvas, rotation, rotated.width, rotated.height);

  const longest = Math.max(cropW, cropH);
  const outputScale = longest > OUTPUT_MAX ? OUTPUT_MAX / longest : 1;
  const width = Math.max(1, Math.round(cropW * outputScale));
  const height = Math.max(1, Math.round(cropH * outputScale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare the slide.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rotatedCanvas, cropX, cropY, cropW, cropH, 0, 0, width, height);
  const blob = await canvasToBlob(canvas);
  return { blob, width, height };
}
