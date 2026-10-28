import { ITEM_PANEL_EFFECT_MS } from '../../constants/itemTypes';

export type AttackPanelType = 'paint' | 'lightning' | 'scribble' | 'lock';

export const ATTACK_PANEL_TYPES: AttackPanelType[] = ['paint', 'lightning', 'scribble', 'lock'];

export interface ActivePanelEffects {
  active: Partial<Record<AttackPanelType, { expiresAt: number }>>;
  queue: Partial<Record<AttackPanelType, number>>;
}

export function createEmptyPanelEffects(): ActivePanelEffects {
  return { active: {}, queue: {} };
}

export function isPanelTypeActive(
  effects: ActivePanelEffects | undefined,
  type: AttackPanelType,
  now = Date.now(),
): boolean {
  const entry = effects?.active[type];
  return Boolean(entry && now < entry.expiresAt);
}

export function getActivePanelTypes(
  effects: ActivePanelEffects | undefined,
  now = Date.now(),
): AttackPanelType[] {
  if (!effects) return [];
  return ATTACK_PANEL_TYPES.filter((type) => isPanelTypeActive(effects, type, now));
}

/** 같은 타입은 큐에 쌓고, 다른 타입은 동시에 활성화 */
export function enqueuePanelEffect(
  prev: ActivePanelEffects | undefined,
  type: AttackPanelType,
  durationMs = ITEM_PANEL_EFFECT_MS,
  now = Date.now(),
): { next: ActivePanelEffects; started: boolean } {
  const base = prev || createEmptyPanelEffects();
  const active = { ...base.active };
  const queue = { ...base.queue };
  const current = active[type];

  if (current && now < current.expiresAt) {
    queue[type] = (queue[type] || 0) + 1;
    return { next: { active, queue }, started: false };
  }

  active[type] = { expiresAt: now + durationMs };
  return { next: { active, queue }, started: true };
}

export interface PrunePanelEffectsResult {
  next: ActivePanelEffects;
  changed: boolean;
  restarted: AttackPanelType[];
  cleared: AttackPanelType[];
}

/** 만료된 효과를 정리하고, 큐에 남은 같은 타입을 바로 재시작 */
export function prunePanelEffects(
  prev: ActivePanelEffects | undefined,
  durationMs = ITEM_PANEL_EFFECT_MS,
  now = Date.now(),
): PrunePanelEffectsResult {
  if (!prev) {
    return { next: createEmptyPanelEffects(), changed: false, restarted: [], cleared: [] };
  }

  const active = { ...prev.active };
  const queue = { ...prev.queue };
  let changed = false;
  const restarted: AttackPanelType[] = [];
  const cleared: AttackPanelType[] = [];

  for (const type of ATTACK_PANEL_TYPES) {
    const entry = active[type];
    if (!entry) continue;
    if (now < entry.expiresAt) continue;

    changed = true;
    const pending = queue[type] || 0;
    if (pending > 0) {
      queue[type] = pending - 1;
      if (queue[type] <= 0) delete queue[type];
      active[type] = { expiresAt: now + durationMs };
      restarted.push(type);
    } else {
      delete active[type];
      cleared.push(type);
    }
  }

  return { next: { active, queue }, changed, restarted, cleared };
}
