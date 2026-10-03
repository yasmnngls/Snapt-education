import { MARK_FONT } from '../editor/tools';

export const HAND_STYLES = [
  {
    id: 'neat',
    name: 'Neat',
    description: 'Even, readable script',
    family: 'Caveat',
    ink: '#2447c6',
  },
  {
    id: 'quick',
    name: 'Quick',
    description: 'A faster everyday hand',
    family: 'Patrick Hand',
    ink: '#1f3a8f',
  },
  {
    id: 'loose',
    name: 'Loose',
    description: 'A rounder, looser hand',
    family: 'Kalam',
    ink: '#3157d8',
  },
] as const;

export type HandStyleId = (typeof HAND_STYLES)[number]['id'];

export function handStyle(styleId: string | undefined) {
  return HAND_STYLES.find((style) => style.id === styleId) ?? HAND_STYLES[0];
}

export function fontFamilyFor(styleId: string | undefined) {
  const style = HAND_STYLES.find((item) => item.id === styleId);
  return style ? `"${style.family}", cursive` : MARK_FONT;
}

export async function loadHandFonts(styleIds: (string | undefined)[]) {
  const families = new Set<string>(['Atkinson Hyperlegible']);
  for (const styleId of styleIds) {
    const style = HAND_STYLES.find((item) => item.id === styleId);
    if (style) families.add(style.family);
  }
  await Promise.all([...families].map((family) => document.fonts.load(`32px "${family}"`)));
}
