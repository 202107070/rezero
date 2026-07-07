import { getCurrentUserName } from '../services/authService';
import type { RoomPlayer, CharacterOption, LanguageOption } from '../types/room';
import { getKickedCount } from '../services/roomStore';
import { getTierByUserName } from '../utils/tierUtils';

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

export const DEMO_BOT_POOL: Array<{ name: string; rank: string; language: string; character: string }> = [
  { name: '알고리즘깎는노인', rank: '다이아', language: '☕', character: '🧙' },
  { name: '코딩마스터', rank: '플래티넘', language: '🐍', character: '🤖' },
  { name: '빈칸헌터', rank: '골드', language: '⚡', character: '🥷' },
  { name: '자바의달인', rank: '플래티넘', language: '☕', character: '🤺' },
  { name: '프론트요정', rank: '실버', language: '🌐', character: '🧙' },
  { name: '스타일리스트', rank: '브론즈', language: '🎨', character: '🤖' },
];

/** 봇 입장 후 READY 전환 대기 (ms) — 멀티 연동 전 로컬 봇용 */
export const BOT_READY_DELAY_MS = 3000;

export function pickDemoBot(existingBotCount: number): (typeof DEMO_BOT_POOL)[number] {
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
      rank: getTierByUserName(playerName),
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
  const playerName = getCurrentUserName();
  const msgs = [
    { type: 'sys' as const, text: `>> ${roomMode === '1/1' ? '1:1 진검승부' : `1/${parsedMaxPlayers} 배틀`} 방이 생성되었습니다.` },
    { type: 'sys' as const, text: `>> [${playerName}] 님이 입장하셨습니다.` },
  ];

  players.forEach((p) => {
    if (p && p.id !== 1) {
      msgs.push({ type: 'sys' as const, text: `>> [${p.name}] 님이 입장하셨습니다.` });
    }
  });

  return msgs;
}
