import { anchorNote } from '../read/suggest';
import type { DetectedBlock, Rect } from '../types';

export type ChatDraft = {
  text: string;
  x: number;
  y: number;
  blockId?: string;
  quote?: string;
  anchor?: Rect;
};

export type AssistResult = {
  say: string;
  draft: ChatDraft | null;
  confirm: boolean;
};

type AssistInput = {
  message: string;
  draft: ChatDraft | null;
  blocks: DetectedBlock[];
  taken: { x: number; y: number }[];
  slideWidth: number;
  slideHeight: number;
};

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function shorten(text: string) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  if (words.length <= 6) return words.join(' ');
  return words.slice(0, 6).join(' ');
}

function clearer(text: string) {
  const next = text
    .replace(/\b(very|really|just|basically|actually|literally)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!next) return text.trim();
  return next.charAt(0).toUpperCase() + next.slice(1);
}

function summarizeBlocks(blocks: DetectedBlock[]) {
  const bits = blocks
    .map((block) => block.text.replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 2)
    .slice(0, 3)
    .map((text) => clip(text.split(/[:—–]/)[0] ?? text, 32));
  return clip(bits.join(' · '), 84);
}

function splitNear(message: string) {
  const match = message.match(/^(.*?)(?:\s+\b(?:near|next to|beside|by)\s+)(.+)$/i);
  if (!match) return { body: message.trim(), hint: undefined as string | undefined };
  return { body: match[1].trim(), hint: match[2].trim() };
}

function draftAt(text: string, input: AssistInput, hint?: string): ChatDraft {
  const anchor = anchorNote({
    text,
    blocks: input.blocks,
    taken: input.taken,
    slideWidth: input.slideWidth,
    slideHeight: input.slideHeight,
    hint,
  });
  return { text, x: anchor.x, y: anchor.y, blockId: anchor.blockId, quote: anchor.quote, anchor: anchor.anchor };
}

function where(draft: ChatDraft) {
  return draft.quote ? `next to “${clip(draft.quote, 48)}”` : 'in the margin';
}

export function assist(input: AssistInput): AssistResult {
  const message = input.message.trim();
  const lower = message.toLowerCase();

  if (/^(ok|okay|place it|add it)$/i.test(lower)) {
    if (!input.draft?.text.trim()) {
      return {
        say: 'There isn’t a note to place yet. Tell me what to write, or ask me to summarize the slide.',
        draft: input.draft,
        confirm: false,
      };
    }
    return {
      say: 'Placed on the slide. You can still move it, or tell me another note.',
      draft: null,
      confirm: true,
    };
  }

  if (/^(cancel|never mind|nevermind|discard)$/i.test(lower)) {
    return { say: 'Cleared. Tell me the next note when you’re ready.', draft: null, confirm: false };
  }

  if (/\b(shorter|briefer|tighten|fewer words)\b/i.test(lower)) {
    if (!input.draft?.text.trim()) {
      return { say: 'Write a note first, then I can shorten it.', draft: input.draft, confirm: false };
    }
    const text = shorten(input.draft.text);
    if (text === input.draft.text) {
      return {
        say: 'That’s already short. Click OK, or tell me the wording you want.',
        draft: input.draft,
        confirm: false,
      };
    }
    return {
      say: 'Shortened it on the slide. Click OK, or refine it again.',
      draft: { ...input.draft, text },
      confirm: false,
    };
  }

  if (/\b(clearer|simpler|refine|clean it up)\b/i.test(lower)) {
    if (!input.draft?.text.trim()) {
      return { say: 'Write a note first, then I can refine it.', draft: input.draft, confirm: false };
    }
    const text = clearer(shorten(input.draft.text));
    return {
      say: 'Refined the wording on the slide. Click OK when it sounds right.',
      draft: { ...input.draft, text },
      confirm: false,
    };
  }

  if (/\bsummar/i.test(lower) && (!input.draft || /\bslide\b/i.test(lower))) {
    if (input.blocks.length === 0) {
      return {
        say: 'I couldn’t read text on this slide. Type the note you want and I’ll place it.',
        draft: input.draft,
        confirm: false,
      };
    }
    const text = summarizeBlocks(input.blocks);
    const draft = draftAt(text, input, input.blocks[0]?.text);
    return {
      say: `Here’s a short summary, ${where(draft)}. Edit it, ask me to make it shorter, then click OK.`,
      draft,
      confirm: false,
    };
  }

  if (/\bsummar/i.test(lower) && input.draft) {
    const text = shorten(input.draft.text);
    return {
      say: 'Summarized that note on the slide. Click OK, or tell me what to change.',
      draft: { ...input.draft, text },
      confirm: false,
    };
  }

  const { body, hint } = splitNear(message);
  if (hint && input.draft && /^(put|move|place)?\s*(it|this|that)?$/i.test(body)) {
    const draft = draftAt(input.draft.text, input, hint);
    return { say: `Moved it ${where(draft)}. Click OK, or keep refining.`, draft, confirm: false };
  }

  const noteText = (body || message)
    .replace(/^(please\s+)?(add|write|put|note|make)\s+(a\s+)?(note\s+)?(that\s+|saying\s+)?/i, '')
    .trim();
  if (noteText.length < 2) {
    return { say: 'Say a little more about the note you want.', draft: input.draft, confirm: false };
  }
  const draft = draftAt(noteText, input, hint);
  return {
    say: `It’s on the slide ${where(draft)}. Summarize or refine it, then click OK.`,
    draft,
    confirm: false,
  };
}
