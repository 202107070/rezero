import { STYLE_ITEM_POLICY } from '../constants/problemCapabilityPolicy';
import type { ItemKey } from '../constants/itemTypes';
import type { BattleProblem, ProblemCapabilities, ProblemStyle } from '../types/battle';
import { hasRenderableVisual, problemHasVisual } from './problemVisualUtils';

export type GameModeContext = 'item' | 'normal';

export function resolveProblemStyle(type: string | undefined): ProblemStyle {
  const normalized = String(type || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');

  if (normalized === 'multiple_choice' || normalized === 'multiplechoice') {
    return 'multiple_choice';
  }
  if (normalized === 'short_answer' || normalized === 'shortanswer') {
    return 'short_answer';
  }
  return 'code';
}

function mergeItemPolicy(
  style: ProblemStyle,
  overrides?: Partial<Record<ItemKey, boolean>>,
): Record<ItemKey, boolean> {
  const merged = { ...STYLE_ITEM_POLICY[style] };
  if (overrides) {
    for (const [key, allowed] of Object.entries(overrides)) {
      if (key in merged) {
        merged[key as ItemKey] = Boolean(allowed);
      }
    }
  }
  return merged;
}

function disableAllItems(items: Record<ItemKey, boolean>): Record<ItemKey, boolean> {
  const next = { ...items };
  (Object.keys(next) as ItemKey[]).forEach((key) => {
    next[key] = false;
  });
  return next;
}

export function resolveProblemCapabilities(
  problem: Pick<BattleProblem, 'type' | 'visual' | 'capabilityOverrides'>,
  ctx: { gameMode?: GameModeContext } = {},
): ProblemCapabilities {
  const style = resolveProblemStyle(problem.type);
  let items = mergeItemPolicy(style, problem.capabilityOverrides);

  if (ctx.gameMode !== 'item') {
    items = disableAllItems(items);
  }

  const hasVisual = problemHasVisual(problem);
  const hasImage = problem.visual?.kind === 'image' && hasRenderableVisual(problem.visual);

  return {
    style,
    hasVisual,
    hasImage,
    items,
    canUseHint: items.revealLength || items.revealPrev,
    canUseAutoSolve: items.blankBreak,
    canUseBuildBonus: items.buildCharge,
    showCodePanel: style === 'code',
    showMultipleChoicePanel: style === 'multiple_choice',
    showShortAnswerPanel: style === 'short_answer',
  };
}

export function canUseItem(caps: ProblemCapabilities, itemKey: ItemKey): boolean {
  return caps.items[itemKey] ?? false;
}
