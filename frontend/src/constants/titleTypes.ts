export type TitleRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface TitleStats {
  totalWins: number;
  consecutiveWins: number;
  totalGames: number;
  perfectGame: boolean;
  avgSpeed: number;
  langWins: Record<string, number>;
}

export interface TitleData {
  owned: string[];
  equipped: string | null;
  stats: TitleStats;
}

export interface TitleDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: TitleRarity;
  check: (s: TitleStats) => boolean;
}

export const TITLE_DEFS: TitleDef[] = [
  { id: 'rookie', name: '코딩 입문자', desc: '첫 승리 달성', icon: '🌱', rarity: 'common', check: (s) => s.totalWins >= 1 },
  { id: 'streak3', name: '코딩 박사', desc: '3연속 우승', icon: '🎓', rarity: 'uncommon', check: (s) => s.consecutiveWins >= 3 },
  { id: 'streak5', name: '알고리즘 마스터', desc: '5연속 우승', icon: '👑', rarity: 'rare', check: (s) => s.consecutiveWins >= 5 },
  { id: 'veteran', name: '베테랑 코더', desc: '누적 10승 달성', icon: '⚔️', rarity: 'rare', check: (s) => s.totalWins >= 10 },
  { id: 'perfect', name: '퍼펙트 솔버', desc: '한 판 전문제 정답', icon: '💎', rarity: 'legendary', check: (s) => s.perfectGame },
  { id: 'java_master', name: '자바 장인', desc: 'JAVA 5승', icon: '☕', rarity: 'uncommon', check: (s) => (s.langWins?.JAVA || 0) >= 5 },
  { id: 'python_master', name: '파이썬 고수', desc: 'PYTHON 5승', icon: '🐍', rarity: 'uncommon', check: (s) => (s.langWins?.PYTHON || 0) >= 5 },
  { id: 'cpp_master', name: 'C++ 달인', desc: 'CPP 5승', icon: '⚡', rarity: 'uncommon', check: (s) => (s.langWins?.CPP || 0) >= 5 },
  { id: 'speedster', name: '스피드스터', desc: '평균 30초 미만', icon: '🚀', rarity: 'rare', check: (s) => s.avgSpeed > 0 && s.avgSpeed < 30 },
  { id: 'all_rounder', name: '올라운더', desc: '모든 언어 1승', icon: '🌟', rarity: 'legendary', check: (s) => (s.langWins?.JAVA || 0) > 0 && (s.langWins?.PYTHON || 0) > 0 && (s.langWins?.CPP || 0) > 0 },
];

const DEFAULT_TITLE_DATA: TitleData = {
  owned: [],
  equipped: null,
  stats: { totalWins: 0, consecutiveWins: 0, totalGames: 0, perfectGame: false, avgSpeed: 0, langWins: {} },
};

export function loadTitles(): TitleData {
  try {
    const raw = localStorage.getItem('rocky_titles');
    return raw ? (JSON.parse(raw) as TitleData) : { ...DEFAULT_TITLE_DATA };
  } catch {
    return { ...DEFAULT_TITLE_DATA };
  }
}

export function saveTitles(data: TitleData): void {
  localStorage.setItem('rocky_titles', JSON.stringify(data));
}

export function getEquippedTitle(data: TitleData | null | undefined): TitleDef | null {
  if (!data?.equipped) return null;
  return TITLE_DEFS.find((t) => t.id === data.equipped) ?? null;
}

export function checkNewTitles(data: TitleData, matchStats: TitleStats): TitleDef[] {
  const newTitles: TitleDef[] = [];
  TITLE_DEFS.forEach((td) => {
    if (!data.owned.includes(td.id) && td.check(matchStats)) {
      data.owned.push(td.id);
      newTitles.push(td);
    }
  });
  return newTitles;
}
