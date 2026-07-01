import { getItemInventory } from '../services/userService';
import { DEV_TEST_USER_LOADOUT } from './devTestConfig';

export interface ItemInventory {
  paint: number;
  revealLength: number;
  revealPrev: number;
  lightning: number;
  timeReduce: number;
  scribble: number;
  blankBreak: number;
  buildCharge: number;
}

export const DEFAULT_ITEM_INVENTORY: ItemInventory = {
  paint: 0,
  revealLength: 0,
  revealPrev: 0,
  lightning: 0,
  timeReduce: 0,
  scribble: 0,
  blankBreak: 0,
  buildCharge: 0,
};

export const BATTLE_BUILD_LIMIT = 3;
export const BATTLE_BUILD_ITEM_BONUS = 3;

export interface RouletteItem {
  type: keyof ItemInventory | 'miss';
  icon: string;
  name: string;
  rare: boolean;
}

export const ROULETTE_ITEMS: RouletteItem[] = [
  { type: 'paint', icon: '🎨', name: '페인트', rare: false },
  { type: 'lightning', icon: '⚡', name: '번개', rare: false },
  { type: 'timeReduce', icon: '⏱️', name: '시간감소', rare: false },
  { type: 'revealLength', icon: '📏', name: '글자수', rare: false },
  { type: 'revealPrev', icon: '🔍', name: '앞글자', rare: false },
  { type: 'miss', icon: '💀', name: '꽝', rare: false },
  { type: 'scribble', icon: '✏️', name: '낙서', rare: true },
  { type: 'blankBreak', icon: '🔨', name: '빈칸깨기', rare: true },
  { type: 'buildCharge', icon: '🔧', name: '빌드+', rare: true },
];

export const ROULETTE_COST = 1000;
export const ROULETTE_SEG_COLORS = ['#2d1f3d', '#1a2d3d', '#2d3d1f', '#3d1a1a', '#1a3d3d', '#3d2d1a', '#2d1a3d', '#1a3d2d'];

export type ItemKey = keyof ItemInventory;

export const BATTLE_ITEM_DEFS: Array<{ key: ItemKey; icon: string; name: string; rare?: boolean }> = [
  { key: 'paint', icon: '🎨', name: '페인트' },
  { key: 'lightning', icon: '⚡', name: '번개' },
  { key: 'timeReduce', icon: '⏱️', name: '시간감소' },
  { key: 'revealLength', icon: '📏', name: '글자수' },
  { key: 'revealPrev', icon: '🔍', name: '앞글자' },
  { key: 'scribble', icon: '✏️', name: '낙서', rare: true },
  { key: 'blankBreak', icon: '🔨', name: '빈칸깨기', rare: true },
  { key: 'buildCharge', icon: '🔧', name: '빌드+', rare: true },
];

export const ATTACK_ITEM_KEYS: ItemKey[] = ['paint', 'lightning', 'timeReduce', 'scribble'];
export const ITEM_PANEL_EFFECT_MS = 7000;
export const SELF_ITEM_KEYS: ItemKey[] = ['revealLength', 'revealPrev', 'blankBreak', 'buildCharge'];

export function loadItemInventory(): ItemInventory {
  return getItemInventory();
}

export function defaultSelectedItemKeys(): ItemKey[] {
  if (!DEV_TEST_USER_LOADOUT.enabled || !DEV_TEST_USER_LOADOUT.autoSelectAllItemsInRoom) {
    return [];
  }

  return BATTLE_ITEM_DEFS.map((def) => def.key).filter((key) => DEV_TEST_USER_LOADOUT.items[key] > 0);
}
