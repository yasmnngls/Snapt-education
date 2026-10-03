import { clamp, textSizeFor } from '../editor/tools';
import type { DetectedBlock, Rect, TextAnnotation } from '../types';

export type OcrLine = {
  text: string;
  confidence: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type NoteDraft = {
  id: string;
  blockId: string;
  text: string;
  x: number;
  y: number;
  reason: string;
  quote: string;
  anchor?: Rect;
  mark?: Rect;
};

function rectOf(block: DetectedBlock): Rect {
  return { x: block.x, y: block.y, w: block.w, h: block.h };
}

function spanRect(block: DetectedBlock, part: string): Rect | undefined {
  const start = block.text.toLowerCase().indexOf(part.toLowerCase());
  if (start < 0 || !part.trim()) return undefined;
  const perChar = block.w / Math.max(1, block.text.length);
  return { x: block.x + start * perChar, y: block.y, w: Math.max(perChar * 2, part.length * perChar), h: block.h };
}

const SKIP_TERMS = new Set([
  'slide',
  'slides',
  'figure',
  'table',
  'chapter',
  'page',
  'note',
  'notes',
  'lecture',
  'image',
  'photo',
]);

const SKIP_ACRONYMS = new Set(['PDF', 'PNG', 'JPEG', 'JPG', 'URL']);

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function clip(value: string, max: number) {
  const text = clean(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function blocksFromLines(lines: OcrLine[], slideWidth: number, slideHeight: number): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  for (const line of lines) {
    const text = clean(line.text);
    if (text.length < 2 || line.confidence < 55) continue;
    if (!/[A-Za-z]/.test(text)) continue;
    const x = clamp(line.x0, 0, slideWidth);
    const y = clamp(line.y0, 0, slideHeight);
    const w = clamp(line.x1, 0, slideWidth) - x;
    const h = clamp(line.y1, 0, slideHeight) - y;
    if (w < 8 || h < 8) continue;
    blocks.push({
      id: `line-${blocks.length}-${Math.round(x)}-${Math.round(y)}`,
      text,
      x,
      y,
      w,
      h,
      confidence: line.confidence,
    });
  }
  return blocks;
}

function overlaps(
  x: number,
  y: number,
  boxWidth: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
) {
  return x < rect.x + rect.w && x + boxWidth > rect.x && y < rect.y + rect.h && y + height > rect.y;
}

function placeBeside(
  block: DetectedBlock,
  slideWidth: number,
  slideHeight: number,
  boxWidth: number,
  size: number,
  taken: { x: number; y: number }[],
  avoid: { x: number; y: number; w: number; h: number }[] = [],
) {
  const height = size * 2.6;
  const margin = Math.max(14, size * 0.75);
  const spots = [
    { x: block.x + block.w + margin, y: block.y },
    { x: block.x - boxWidth - margin, y: block.y },
    { x: block.x, y: block.y + block.h + margin },
  ];
  const columnX = Math.max(margin, slideWidth - boxWidth - margin);
  for (let index = 0; index < 8; index += 1) {
    spots.push({ x: columnX, y: margin + index * (height + margin) });
  }
  for (const spot of spots) {
    const x = clamp(spot.x, margin, Math.max(margin, slideWidth - boxWidth - margin));
    const y = clamp(spot.y, margin, Math.max(margin, slideHeight - height - margin));
    const blocked = taken.some((other) => overlaps(x, y, boxWidth, height, { x: other.x, y: other.y, w: boxWidth, h: height }));
    const hitsSlide = avoid.some((rect) =>
      overlaps(x, y, boxWidth, height, {
        x: rect.x - margin,
        y: rect.y - margin * 0.35,
        w: rect.w + margin * 2,
        h: rect.h + margin * 0.7,
      }),
    );
    if (!blocked && !hitsSlide) return { x, y };
  }
  return {
    x: columnX,
    y: clamp(margin + taken.length * (height + margin), margin, Math.max(margin, slideHeight - height - margin)),
  };
}

export function suggestNotes(input: {
  blocks: DetectedBlock[];
  dismissedBlockIds: string[];
  placedBlockIds: string[];
  taken?: { x: number; y: number }[];
  slideWidth: number;
  slideHeight: number;
}): NoteDraft[] {
  const blocked = new Set([...input.dismissedBlockIds, ...input.placedBlockIds]);
  const available = input.blocks.filter((block) => !blocked.has(block.id));
  const limit = Math.max(0, 4 - input.placedBlockIds.length);
  const drafts: NoteDraft[] = [];
  const used = new Set<string>();
  const taken: { x: number; y: number }[] = [...(input.taken ?? [])];
  const boxWidth = Math.round(input.slideWidth * 0.32);
  const size = textSizeFor(input.slideWidth, 0);

  function add(block: DetectedBlock, text: string, reason: string, term?: string) {
    if (drafts.length >= limit || used.has(block.id)) return;
    const spot = placeBeside(
      block,
      input.slideWidth,
      input.slideHeight,
      boxWidth,
      size,
      taken,
      input.blocks.map((item) => ({ x: item.x, y: item.y, w: item.w, h: item.h })),
    );
    taken.push(spot);
    used.add(block.id);
    drafts.push({
      id: `suggest-${block.id}`,
      blockId: block.id,
      text,
      x: spot.x,
      y: spot.y,
      reason,
      quote: block.text,
      anchor: rectOf(block),
      mark: term ? spanRect(block, term) : undefined,
    });
  }

  for (const block of available) {
    const match = block.text.match(/^(.{2,40}?)\s*(?::|—|–)\s+(.{6,})$/);
    if (!match) continue;
    const term = clean(match[1]).replace(/[.:]+$/, '');
    if (!term || term.split(' ').length > 6) continue;
    add(block, `Remember ${term}`, 'Suggested from a definition on the slide', term);
  }

  for (const block of available) {
    const match = block.text.match(/^(.{2,36}?)\s+(?:→|->|=>|↔|vs\.?|versus)\s+(.{2,36})\.?$/i);
    if (!match) continue;
    add(block, `${clean(match[1])} connects to ${clean(match[2])}`, 'Suggested from a relationship on the slide');
  }

  for (const block of available) {
    const match = block.text.match(/^(.{2,32}?)\s+-\s+(.{2,48})\.?$/);
    if (!match) continue;
    const left = clean(match[1]);
    const right = clean(match[2]);
    const leftWords = left.split(' ').length;
    const rightWords = right.split(' ').length;
    if (leftWords <= 4 && rightWords <= 4) {
      add(block, `${left} connects to ${right}`, 'Suggested from a relationship on the slide');
      continue;
    }
    if (rightWords >= 4 && leftWords <= 6) {
      const term = left.replace(/[.:]+$/, '');
      add(block, `Remember ${term}`, 'Suggested from a definition on the slide', term);
    }
  }

  for (const block of available) {
    const words = block.text.match(/\b[A-Z][a-z]{4,}\b/g) ?? [];
    const term = words.find((word) => !SKIP_TERMS.has(word.toLowerCase()));
    const acronyms = block.text.match(/\b[A-Z]{2,6}\b/g) ?? [];
    const acronym = acronyms.find((word) => !SKIP_ACRONYMS.has(word));
    const label = term ?? acronym;
    if (!label) continue;
    add(block, `Term · ${label}`, 'Suggested from a term on the slide', label);
  }

  if (drafts.length >= Math.min(2, limit)) return drafts;

  const shortLines = available
    .filter((block) => {
      const words = block.text.split(' ').length;
      return block.text.length >= 8 && block.text.length <= 64 && words <= 8;
    })
    .sort((a, b) => a.y - b.y || a.text.length - b.text.length);

  for (const block of shortLines) {
    if (drafts.length >= Math.min(3, limit)) break;
    add(block, `Key idea · ${clip(block.text, 56)}`, 'Suggested from a short line on the slide');
  }

  return drafts;
}

export function draftToPreview(draft: NoteDraft, slideWidth: number, styleId: string, color: string): TextAnnotation {
  return {
    id: draft.id,
    type: 'text',
    x: draft.x,
    y: draft.y,
    text: draft.text,
    color,
    size: textSizeFor(slideWidth, 0),
    boxWidth: Math.round(slideWidth * 0.32),
    origin: 'suggested',
    styleId,
    sourceBlockId: draft.blockId,
    anchor: draft.anchor,
    mark: draft.mark,
  };
}

const ANCHOR_SKIP = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'your',
  'note',
  'slide',
  'about',
  'make',
  'into',
]);

function noteTokens(value: string) {
  return value.toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((word) => !ANCHOR_SKIP.has(word)) ?? [];
}

export function anchorNote(input: {
  text: string;
  blocks: DetectedBlock[];
  taken: { x: number; y: number }[];
  slideWidth: number;
  slideHeight: number;
  hint?: string;
}): { x: number; y: number; blockId?: string; quote?: string; anchor?: Rect } {
  const wanted = noteTokens(input.hint?.trim() || input.text);
  let best: DetectedBlock | undefined;
  let bestScore = 0;
  for (const block of input.blocks) {
    const have = new Set(noteTokens(block.text));
    let score = 0;
    for (const word of wanted) {
      if (have.has(word) || block.text.toLowerCase().includes(word)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = block;
    }
  }
  const boxWidth = Math.round(input.slideWidth * 0.32);
  const size = textSizeFor(input.slideWidth, 0);
  const avoid = input.blocks.map((block) => ({ x: block.x, y: block.y, w: block.w, h: block.h }));
  if (!best || bestScore === 0) {
    const spot = placeBeside(
      { id: 'margin', text: '', x: 0, y: 0, w: 1, h: 1, confidence: 0 },
      input.slideWidth,
      input.slideHeight,
      boxWidth,
      size,
      input.taken,
      avoid,
    );
    return { x: spot.x, y: spot.y, blockId: undefined, quote: undefined };
  }
  const spot = placeBeside(best, input.slideWidth, input.slideHeight, boxWidth, size, input.taken, avoid);
  return { x: spot.x, y: spot.y, blockId: best.id, quote: best.text, anchor: rectOf(best) };
}

export function noteFromDraft(draft: NoteDraft, slideWidth: number, styleId: string, color: string): TextAnnotation {
  return {
    ...draftToPreview(draft, slideWidth, styleId, color),
    id: crypto.randomUUID(),
    text: draft.text.trim(),
  };
}
