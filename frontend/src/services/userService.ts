import type { ItemInventory } from '../constants/itemTypes';
import { DEV_TEST_USER_LOADOUT } from '../constants/devTestConfig';
import type { TitleData, TitleStats } from '../constants/titleTypes';
import type { CodeHistoryEntry } from '../types/lobby';

const EMPTY_ITEM_INVENTORY: ItemInventory = {
  paint: 0,
  revealLength: 0,
  revealPrev: 0,
  lightning: 0,
  timeReduce: 0,
  scribble: 0,
  blankBreak: 0,
  buildCharge: 0,
};

const EMPTY_TITLE_STATS: TitleStats = {
  totalWins: 0,
  consecutiveWins: 0,
  totalGames: 0,
  perfectGame: false,
  avgSpeed: 0,
  langWins: {},
};

const defaultTitleData = (): TitleData => ({
  owned: [],
  equipped: null,
  stats: { ...EMPTY_TITLE_STATS },
});

let gold = 0;
let itemInventory: ItemInventory = { ...EMPTY_ITEM_INVENTORY };
let titleData: TitleData = defaultTitleData();
let ratingScore = 1000;
let newTitleIds: string[] = [];
let codeHistory: CodeHistoryEntry[] = [];

export function getGold(): number {
  return gold;
}

export function setGold(value: number): void {
  gold = Math.max(0, value);
}

export function addGold(delta: number): number {
  gold = Math.max(0, gold + delta);
  return gold;
}

export function getItemInventory(): ItemInventory {
  return { ...itemInventory };
}

export function setItemInventory(items: ItemInventory): void {
  itemInventory = { ...items };
}

export function updateItemInventory(updater: (prev: ItemInventory) => ItemInventory): ItemInventory {
  itemInventory = updater(getItemInventory());
  return itemInventory;
}

export function getTitles(): TitleData {
  return {
    ...titleData,
    owned: [...titleData.owned],
    stats: { ...titleData.stats, langWins: { ...titleData.stats.langWins } },
  };
}

export function saveTitles(data: TitleData): void {
  titleData = {
    ...data,
    owned: [...data.owned],
    stats: { ...data.stats, langWins: { ...data.stats.langWins } },
  };
}

export function getEquippedTitleId(): string | null {
  return titleData.equipped;
}

export function getRatingScore(): number {
  return ratingScore;
}

export function getNewTitleIds(): string[] {
  return [...newTitleIds];
}

export function setNewTitleIds(ids: string[]): void {
  newTitleIds = [...ids];
}

export function readUserCodeHistory(): CodeHistoryEntry[] {
  return [...codeHistory];
}

export function persistUserCodeHistory(nextHistory: CodeHistoryEntry[]): void {
  codeHistory = [...nextHistory];
}

/** 로그인·회원가입 직후 유저 골드/아이템 초기화 (DEV 테스트 세팅 포함) */
export function initializeUserSession(): void {
  if (DEV_TEST_USER_LOADOUT.enabled) {
    setGold(DEV_TEST_USER_LOADOUT.gold);
    setItemInventory({ ...DEV_TEST_USER_LOADOUT.items } as ItemInventory);
    return;
  }

  setGold(0);
  setItemInventory({ ...EMPTY_ITEM_INVENTORY });
}
