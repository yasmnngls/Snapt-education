import type { Point } from '../types';

export type Tool =
  | 'pen'
  | 'highlight'
  | 'underline'
  | 'circle'
  | 'arrow'
  | 'text'
  | 'eraser'
  | 'pan';

export const MARK_FONT = 'Atkinson Hyperlegible, sans-serif';

export const COLORS = [
  { id: 'blue', value: '#2447c6', label: 'Blue ink' },
  { id: 'ink', value: '#1b2335', label: 'Black ink' },
  { id: 'red', value: '#d64531', label: 'Red' },
  { id: 'green', value: '#1c8c4e', label: 'Green' },
  { id: 'gold', value: '#e6b325', label: 'Gold' },
] as const;

export const SIZE_OPTIONS = [
  { id: 's', label: 'S' },
  { id: 'm', label: 'M' },
  { id: 'l', label: 'L' },
] as const;

const STROKE_SCALE = [0.0045, 0.009, 0.018];
const TEXT_SCALE = [0.028, 0.046, 0.072];

export function strokeWidthFor(imageWidth: number, sizeIndex: number) {
  const scale = STROKE_SCALE[sizeIndex] ?? STROKE_SCALE[1];
  return Math.max(2, imageWidth * scale);
}

export function textSizeFor(imageWidth: number, sizeIndex: number) {
  const scale = TEXT_SCALE[sizeIndex] ?? TEXT_SCALE[1];
  return Math.max(16, imageWidth * scale);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
