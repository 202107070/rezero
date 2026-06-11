import type { CharacterOption, LanguageOption, RoomPlayer } from '../types/room';
import { STORAGE_KEYS } from './storageKeys';

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

export const DEMO_BOT_POOL = [
  { name: '알고리즘노인', language: '🐍', character: '🧙' },
  { name: 'DP마스터', language: '☕', character: '🤖' },
  { name: '그리디왕', language: '🐍', character: '🦊' },
  { name: '자료구조봇', language: '☕', character: '🤖' },
  { name: '이분탐색요정', language: '🐍', character: '🧚' },
  { name: '큐러버', language: '☕', character: '🐼' },
  { name: '백트래커', language: '🐍', character: '🐉' },
  { name: '시뮬레이터', language: '☕', character: '🐱' },
];

export const LANG_MAP: Record<string, string> = {
  JAVA: 'java',
  PYTHON: 'python',
  'C++': 'cpp',
  HTML: 'html',
  CSS: 'css',
};
export const DIFF_MAP: Record<string, string> = { 쉬움: 'EASY', 보통: 'NORMAL', 어려움: 'HARD' };
export const DIFF_TO_KOREAN: Record<string, string> = { EASY: '쉬움', NORMAL: '보통', HARD: '어려움', EXTREME: '어려움' };

export function getKickedCount(roomId: string): number {
  try {
    return parseInt(localStorage.getItem(`${STORAGE_KEYS.ROOM_KICKED_PREFIX}${roomId}`) || '0', 10);
  } catch {
    return 0;
  }
}

export function buildInitialPlayers(): (RoomPlayer | null)[] {
  const base: (RoomPlayer | null)[] = [
    { id: 1, name: 'rocky_user', isHost: true, isReady: false, language: '☕', character: '🤺', status: 'HOST' },
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
  const msgs = [
    { type: 'sys' as const, text: `>> ${roomMode === '1/1' ? '1:1 진검승부' : `1/${parsedMaxPlayers} 배틀`} 방이 생성되었습니다.` },
    { type: 'sys' as const, text: '>> [rocky_user] 님이 입장하셨습니다.' },
  ];

  players.forEach((p) => {
    if (p && p.id !== 1) {
      msgs.push({ type: 'sys' as const, text: `>> [${p.name}] 님이 입장하셨습니다.` });
    }
  });

  return msgs;
}
