import { db } from '../db';
import type { HandProfile } from '../types';
import { handStyle } from './styles';

export async function loadHandProfile(): Promise<HandProfile> {
  const saved = await db.profile.get('local');
  if (saved) return saved;
  const style = handStyle('neat');
  return {
    id: 'local',
    styleId: style.id,
    inkColor: style.ink,
    inkFromSample: false,
    updatedAt: 0,
  };
}

export async function saveHandProfile(profile: HandProfile) {
  const next = { ...profile, id: 'local' as const, updatedAt: Date.now() };
  await db.profile.put(next);
  return next;
}
