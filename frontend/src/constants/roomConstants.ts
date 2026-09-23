import { getCurrentDisplayName, getCurrentUserId, getCurrentUserName } from '../services/authService';
import type { RoomPlayer, CharacterOption, LanguageOption } from '../types/room';
import { getKickedCount } from '../services/roomStore';
import { getRatingScore } from '../services/userService';
import { getTierByRating } from '../utils/tierUtils';

export const LANGUAGES: LanguageOption[] = [
  { id: 'java', icon: '☕', label: 'Java' },
  { id: 'python', icon: '🐍', label: 'Python' },
  { id: 'cpp', icon: '⚡', label: 'C++' },
  { id: 'html', icon: '🌐', label: 'HTML' },
  { id: 'css', icon: '🎨', label: 'CSS' },
];

export const CHARACTERS: CharacterOption[] = [
  { id: 'char1', icon: '🤺', label: '검사' },
  { id: 'char2', icon: '🧙', label: '마법사' },
  { id: 'char3', icon: '🥷', label: '닌자' },
  { id: 'char4', icon: '🤖', label: '로봇' },
];

/** 로컬 테스트용 봇 — 비활성화 (빈 풀) */
export const DEMO_BOT_POOL: Array<{ name: string; rank: string; language: string; character: string }> = [];

/** 봇 입장 후 READY 전환 대기 (ms) — 미사용 */
export const BOT_READY_DELAY_MS = 3000;

export function pickDemoBot(existingBotCount: number): (typeof DEMO_BOT_POOL)[number] {
  if (DEMO_BOT_POOL.length === 0) {
    return { name: '', rank: '브론즈', language: '☕', character: '🤺' };
  }
  return DEMO_BOT_POOL[existingBotCount % DEMO_BOT_POOL.length];
}

export const LANG_MAP: Record<string, string> = {
  JAVA: 'java',
  PYTHON: 'python',
  'C++': 'cpp',
  HTML: 'html',
  CSS: 'css',
};
export const DIFF_MAP: Record<string, string> = { 쉬움: 'EASY', 보통: 'NORMAL', 어려움: 'HARD' };
export const DIFF_TO_KOREAN: Record<string, string> = { EASY: '쉬움', NORMAL: '보통', HARD: '어려움', EXTREME: '어려움' };

export function getKickedCountForRoom(roomId: string): number {
  return getKickedCount(roomId);
}

export function buildInitialPlayers(): (RoomPlayer | null)[] {
  const playerName = getCurrentUserName();
  const base: (RoomPlayer | null)[] = [
    {
      id: 1,
      name: playerName,
      rank: getTierByRating(getRatingScore()),
      isHost: true,
      isReady: false,
      language: '☕',
      character: '🤺',
      status: 'HOST',
    },
  ];

  while (base.length < 8) {
    base.push(null);
  }

  return base;
}

export function buildInitialMessages(
  roomMode: string,
  parsedMaxPlayers: number,
  players: (RoomPlayer | null)[],
): Array<{ type: 'sys' | 'user'; text: string; name?: string }> {
  const myId = String(getCurrentUserId() || '');
  const myName = getCurrentDisplayName() || getCurrentUserName() || 'UNKNOWN';
  const msgs = [
    { type: 'sys' as const, text: `>> ${roomMode === '1/1' ? '1:1 진검승부' : `1/${parsedMaxPlayers} 배틀`} 방이 생성되었습니다.` },
  ];

  const seen = new Set<string>();
  const pushJoin = (name: string, userId?: string) => {
    const key = String(userId || name);
    if (!name || seen.has(key)) return;
    seen.add(key);
    msgs.push({ type: 'sys', text: `>> [${name}] 님이 입장하셨습니다.` });
  };

  pushJoin(myName, myId);
  players.forEach((p) => {
    if (!p) return;
    if (myId && String(p.userId) === myId) return;
    if (!myId && p.name === myName) return;
    pushJoin(p.name, p.userId);
  });

  return msgs;
}
