import { CHARACTERS } from '../constants/roomConstants';
import type { CharacterOption } from '../types/room';

/** 예전 이모지 캐릭터 → id (세션/스냅샷 호환) */
const LEGACY_EMOJI_TO_ID: Record<string, string> = {
  '🤺': 'char1',
  '🧙': 'char2',
  '🥷': 'char3',
  '🤖': 'char4',
};

export function resolveCharacterId(raw?: string | null): string | null {
  const key = String(raw || '').trim();
  if (!key) return null;
  if (CHARACTERS.some((c) => c.id === key)) return key;
  return LEGACY_EMOJI_TO_ID[key] || null;
}

export function getCharacterOption(raw?: string | null): CharacterOption | undefined {
  const id = resolveCharacterId(raw);
  if (!id) return undefined;
  return CHARACTERS.find((c) => c.id === id);
}

export function getCharacterImageSrc(raw?: string | null): string | null {
  return getCharacterOption(raw)?.imageSrc || null;
}

export function getCharacterLabel(raw?: string | null): string {
  return getCharacterOption(raw)?.label || '캐릭터';
}

/** 이미지 없을 때 텍스트/폴백용 */
export function getCharacterFallbackIcon(raw?: string | null): string {
  const opt = getCharacterOption(raw);
  if (opt?.icon) return opt.icon;
  const key = String(raw || '').trim();
  if (key && key.length <= 4) return key;
  return '👤';
}
