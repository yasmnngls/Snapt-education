import { PDFDocument } from 'pdf-lib';
import { canvasToBlob, loadImage } from '../capture/prepareSlide';
import { drawAnnotation } from '../editor/geometry';
import { loadHandFonts } from '../hand/styles';
import type { Annotation } from '../types';

type SlideImage = {
  imageBlob: Blob;
  width: number;
  height: number;
  annotations: Annotation[];
};

export async function renderSlidePng(slide: SlideImage) {
  await loadHandFonts(slide.annotations.map((annotation) => (annotation.type === 'text' ? annotation.styleId : undefined)));
  const url = URL.createObjectURL(slide.imageBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = slide.width;
    canvas.height = slide.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not export this slide.');
    ctx.drawImage(image, 0, 0, slide.width, slide.height);
    for (const annotation of slide.annotations) drawAnnotation(ctx, annotation);
    return canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function lectureToPdf(slides: SlideImage[]) {
  const pdf = await PDFDocument.create();
  for (const slide of slides) {
    const png = await renderSlidePng(slide);
    const embedded = await pdf.embedPng(new Uint8Array(await png.arrayBuffer()));
    const maxPt = 792;
    const scale = Math.min(maxPt / slide.width, maxPt / slide.height);
    const page = pdf.addPage([slide.width * scale, slide.height * scale]);
    page.drawImage(embedded, {
      x: 0,
      y: 0,
      width: slide.width * scale,
      height: slide.height * scale,
    });
  }
  const saved = await pdf.save();
  const copy = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
  return new Blob([copy], { type: 'application/pdf' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function safeName(name: string) {
  const cleaned = name
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-');
  return cleaned || 'snapt';
}
