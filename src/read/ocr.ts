import { createWorker, type Worker } from 'tesseract.js';
import { blocksFromLines, type OcrLine } from './suggest';
import type { DetectedBlock } from '../types';

let workerPromise: Promise<Worker> | null = null;
let progressListener: ((progress: number) => void) | null = null;
let chain: Promise<void> = Promise.resolve();

function reader() {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger(message) {
        if (message.status === 'recognizing text') progressListener?.(message.progress);
      },
    }).catch((error: unknown) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export function recognizeSlide(
  blob: Blob,
  slideWidth: number,
  slideHeight: number,
  onProgress: (progress: number) => void,
): Promise<DetectedBlock[]> {
  const task = chain.then(async () => {
    progressListener = onProgress;
    try {
      onProgress(0);
      const worker = await reader();
      const result = await worker.recognize(blob, {}, { blocks: true });
      const lines: OcrLine[] = (result.data.blocks ?? []).flatMap((block) =>
        (block.paragraphs ?? []).flatMap((paragraph) =>
          (paragraph.lines ?? []).map((line) => ({
            text: line.text,
            confidence: line.confidence,
            x0: line.bbox.x0,
            y0: line.bbox.y0,
            x1: line.bbox.x1,
            y1: line.bbox.y1,
          })),
        ),
      );
      return blocksFromLines(lines, slideWidth, slideHeight);
    } catch {
      throw new Error('Snapt could not read this slide. The reading model downloads once, then stays on this device.');
    } finally {
      progressListener = null;
    }
  });
  chain = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
