import getStroke from 'perfect-freehand';
import { fontFamilyFor } from '../hand/styles';
import type { Annotation, Point, ShapeAnnotation, StrokeAnnotation, TextAnnotation } from '../types';
import { clamp, distance } from './tools';

export const MARK_COLOR = '#cfe0ff';

export function noteExtent(note: TextAnnotation) {
  const charWidth = note.size * 0.46;
  const natural = Math.max(note.size * 2, note.text.length * charWidth);
  if (!note.boxWidth) return { w: natural, h: note.size * 1.35 };
  const lines = Math.max(1, Math.ceil(natural / note.boxWidth));
  return { w: Math.min(note.boxWidth, natural), h: lines * note.size * 1.35 };
}

export type Connector = {
  start: Point;
  control: Point;
  end: Point;
  head: [Point, Point];
  width: number;
};

export function connectorFor(note: TextAnnotation): Connector | null {
  const target = note.anchor;
  if (!target || !note.text) return null;
  const { w, h } = noteExtent(note);
  const gap = note.size * 0.4;
  const targetMidX = target.x + target.w / 2;
  const targetMidY = target.y + target.h / 2;
  let start: Point;
  let end: Point;
  if (note.x >= target.x + target.w) {
    start = { x: note.x - gap, y: note.y + note.size * 0.65 };
    end = { x: target.x + target.w + gap * 0.6, y: targetMidY };
  } else if (note.x + w <= target.x) {
    start = { x: note.x + w + gap, y: note.y + note.size * 0.65 };
    end = { x: target.x - gap * 0.6, y: targetMidY };
  } else if (note.y >= target.y + target.h) {
    start = { x: clamp(targetMidX, note.x + note.size, note.x + w - note.size), y: note.y - gap * 0.5 };
    end = { x: targetMidX, y: target.y + target.h + gap * 0.5 };
  } else {
    start = { x: clamp(targetMidX, note.x + note.size, note.x + w - note.size), y: note.y + h + gap * 0.5 };
    end = { x: targetMidX, y: target.y - gap * 0.5 };
  }
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  if (len < note.size * 0.9) return null;
  const bow = len * 0.2;
  const control = {
    x: (start.x + end.x) / 2 - ((end.y - start.y) / len) * bow,
    y: (start.y + end.y) / 2 + ((end.x - start.x) / len) * bow,
  };
  const angle = Math.atan2(end.y - control.y, end.x - control.x);
  const headLen = Math.max(9, note.size * 0.42);
  return {
    start,
    control,
    end,
    head: [
      { x: end.x - headLen * Math.cos(angle - 0.5), y: end.y - headLen * Math.sin(angle - 0.5) },
      { x: end.x - headLen * Math.cos(angle + 0.5), y: end.y - headLen * Math.sin(angle + 0.5) },
    ],
    width: Math.max(2, note.size * 0.07),
  };
}

export function connectorPoints(connector: Connector, steps = 18) {
  const points: number[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const u = 1 - t;
    points.push(
      u * u * connector.start.x + 2 * u * t * connector.control.x + t * t * connector.end.x,
      u * u * connector.start.y + 2 * u * t * connector.control.y + t * t * connector.end.y,
    );
  }
  return points;
}

export function strokeOutline(points: Point[], width: number, highlight: boolean): number[] {
  if (points.length === 0) return [];
  const input =
    points.length === 1
      ? [points[0], { x: points[0].x + 0.01, y: points[0].y + 0.01 }]
      : points;
  const outline = getStroke(
    input.map((point) => [point.x, point.y]),
    {
      size: highlight ? width * 2.8 : width,
      thinning: highlight ? 0.1 : 0.55,
      smoothing: 0.6,
      streamline: 0.45,
      simulatePressure: !highlight,
      last: true,
    },
  );
  return outline.flatMap(([x, y]) => [x, y]);
}

export function arrowGeometry(x1: number, y1: number, x2: number, y2: number, width: number) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(16, width * 4.2);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const inset = Math.min(head * 0.72, len);
  return {
    endX: x2 - Math.cos(angle) * inset,
    endY: y2 - Math.sin(angle) * inset,
    headPoints: [
      [x2, y2],
      [x2 - head * Math.cos(angle - 0.42), y2 - head * Math.sin(angle - 0.42)],
      [x2 - head * Math.cos(angle + 0.42), y2 - head * Math.sin(angle + 0.42)],
    ] as [number, number][],
  };
}

export function drawAnnotation(ctx: CanvasRenderingContext2D, annotation: Annotation) {
  if (annotation.type === 'stroke') {
    fillStroke(ctx, annotation);
    return;
  }
  if (annotation.type === 'text') {
    paintText(ctx, annotation);
    return;
  }
  ctx.save();
  ctx.strokeStyle = annotation.color;
  ctx.fillStyle = annotation.color;
  ctx.lineWidth = annotation.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (annotation.kind === 'underline') {
    ctx.beginPath();
    ctx.moveTo(annotation.x1, annotation.y1);
    ctx.lineTo(annotation.x2, annotation.y2);
    ctx.stroke();
  } else if (annotation.kind === 'circle') {
    const rx = Math.abs(annotation.x2 - annotation.x1) / 2;
    const ry = Math.abs(annotation.y2 - annotation.y1) / 2;
    if (rx >= 1 && ry >= 1) {
      ctx.beginPath();
      ctx.ellipse(
        (annotation.x1 + annotation.x2) / 2,
        (annotation.y1 + annotation.y2) / 2,
        rx,
        ry,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
  } else {
    const { endX, endY, headPoints } = arrowGeometry(
      annotation.x1,
      annotation.y1,
      annotation.x2,
      annotation.y2,
      annotation.width,
    );
    ctx.beginPath();
    ctx.moveTo(annotation.x1, annotation.y1);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headPoints[0][0], headPoints[0][1]);
    ctx.lineTo(headPoints[1][0], headPoints[1][1]);
    ctx.lineTo(headPoints[2][0], headPoints[2][1]);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function fillStroke(ctx: CanvasRenderingContext2D, annotation: StrokeAnnotation) {
  const flat = strokeOutline(annotation.points, annotation.width, annotation.tool === 'highlight');
  if (flat.length < 4) return;
  ctx.save();
  ctx.fillStyle = annotation.color;
  ctx.globalAlpha = annotation.tool === 'highlight' ? 0.45 : 1;
  ctx.beginPath();
  ctx.moveTo(flat[0], flat[1]);
  for (let i = 2; i < flat.length; i += 2) ctx.lineTo(flat[i], flat[i + 1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function hitTest(annotations: Annotation[], point: Point, threshold: number): Annotation | null {
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const annotation = annotations[index];
    if (hits(annotation, point, threshold)) return annotation;
  }
  return null;
}

function hits(annotation: Annotation, point: Point, threshold: number) {
  if (annotation.type === 'stroke') return hitStroke(annotation, point, threshold);
  if (annotation.type === 'text') return hitText(annotation, point, threshold);
  return hitShape(annotation, point, threshold);
}

function hitStroke(annotation: StrokeAnnotation, point: Point, threshold: number) {
  const pad = threshold + (annotation.tool === 'highlight' ? annotation.width * 1.4 : annotation.width / 2);
  let best = Infinity;
  for (let index = 0; index < annotation.points.length; index += 1) {
    best = Math.min(best, distance(annotation.points[index], point));
    if (index > 0) {
      best = Math.min(best, distanceToSegment(point, annotation.points[index - 1], annotation.points[index]));
    }
  }
  return best <= pad;
}

function hitText(annotation: TextAnnotation, point: Point, threshold: number) {
  const box = textBox(annotation);
  return (
    point.x >= annotation.x - threshold &&
    point.x <= annotation.x + box.width + threshold &&
    point.y >= annotation.y - threshold &&
    point.y <= annotation.y + box.height + threshold
  );
}

function textBox(annotation: TextAnnotation) {
  const charWidth = annotation.size * 0.52;
  const width = annotation.boxWidth ?? Math.max(annotation.size, annotation.text.length * charWidth);
  const lines = annotation.boxWidth ? Math.max(1, Math.ceil((annotation.text.length * charWidth) / annotation.boxWidth)) : 1;
  return { width, height: lines * annotation.size * 1.25 };
}

function paintText(ctx: CanvasRenderingContext2D, annotation: TextAnnotation) {
  if (!annotation.text) return;
  ctx.save();
  if (annotation.mark) {
    const { x, y, w, h } = annotation.mark;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = MARK_COLOR;
    ctx.beginPath();
    ctx.roundRect(x - h * 0.15, y + h * 0.08, w + h * 0.3, h * 0.92, h * 0.3);
    ctx.fill();
    ctx.restore();
  }
  const link = connectorFor(annotation);
  if (link) {
    ctx.strokeStyle = annotation.color;
    ctx.lineWidth = link.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(link.start.x, link.start.y);
    ctx.quadraticCurveTo(link.control.x, link.control.y, link.end.x, link.end.y);
    ctx.moveTo(link.head[0].x, link.head[0].y);
    ctx.lineTo(link.end.x, link.end.y);
    ctx.lineTo(link.head[1].x, link.head[1].y);
    ctx.stroke();
  }
  ctx.font = `${annotation.size}px ${fontFamilyFor(annotation.styleId)}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = annotation.color;
  if (!annotation.boxWidth) ctx.fillText(annotation.text, annotation.x, annotation.y);
  else wrapFill(ctx, annotation.text, annotation.x, annotation.y, annotation.boxWidth, annotation.size * 1.35);
  ctx.restore();
}

function wrapFill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line = '';
  let offset = 0;
  const paint = (value: string) => {
    ctx.fillText(value, x, y + offset);
    offset += lineHeight;
  };
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      line = trial;
      continue;
    }
    if (line) paint(line);
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      const next = chunk + char;
      if (ctx.measureText(next).width > maxWidth && chunk) {
        paint(chunk);
        chunk = char;
      } else chunk = next;
    }
    line = chunk;
  }
  if (line) paint(line);
}

function hitShape(annotation: ShapeAnnotation, point: Point, threshold: number) {
  if (annotation.kind === 'circle') {
    const rx = Math.abs(annotation.x2 - annotation.x1) / 2;
    const ry = Math.abs(annotation.y2 - annotation.y1) / 2;
    const cx = (annotation.x1 + annotation.x2) / 2;
    const cy = (annotation.y1 + annotation.y2) / 2;
    if (rx < 1 || ry < 1) return distance(point, { x: cx, y: cy }) <= threshold + annotation.width;
    const nx = (point.x - cx) / (rx + threshold);
    const ny = (point.y - cy) / (ry + threshold);
    return nx * nx + ny * ny <= 1;
  }
  const pad = threshold + annotation.width;
  return distanceToSegment(point, { x: annotation.x1, y: annotation.y1 }, { x: annotation.x2, y: annotation.y2 }) <= pad;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2));
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy });
}
