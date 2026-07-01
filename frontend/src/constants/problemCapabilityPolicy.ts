import type { ItemKey } from './itemTypes';
import type { ProblemStyle } from '../types/battle';

const ALL_ITEM_KEYS: ItemKey[] = [
  'paint',
  'revealLength',
  'revealPrev',
  'lightning',
  'timeReduce',
  'scribble',
  'blankBreak',
  'buildCharge',
];

const ATTACK_ITEMS: ItemKey[] = ['paint', 'lightning', 'timeReduce', 'scribble'];

function createItemPolicy(selfItems: Partial<Record<ItemKey, boolean>>): Record<ItemKey, boolean> {
  const policy = Object.fromEntries(ALL_ITEM_KEYS.map((key) => [key, false])) as Record<ItemKey, boolean>;

  for (const [key, allowed] of Object.entries(selfItems)) {
    if (key in policy) {
      policy[key as ItemKey] = Boolean(allowed);
    }
  }

  for (const key of ATTACK_ITEMS) {
    policy[key] = true;
  }

  return policy;
}

/** 문제 스타일별 아이템 허용 정책 (아이템 모드 기준) */
export const STYLE_ITEM_POLICY: Record<ProblemStyle, Record<ItemKey, boolean>> = {
  code: createItemPolicy({
    revealLength: true,
    revealPrev: true,
    blankBreak: true,
    buildCharge: true,
  }),
  short_answer: createItemPolicy({
    revealLength: true,
    revealPrev: true,
    blankBreak: false,
    buildCharge: false,
  }),
  multiple_choice: createItemPolicy({
    revealLength: false,
    revealPrev: false,
    blankBreak: false,
    buildCharge: false,
  }),
};
