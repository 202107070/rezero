const USER_TIER_MAP: Record<string, string> = {
  테스트유저1: '골드',
  테스트유저2: '실버',
  알고리즘깎는노인: '다이아',
  코딩마스터: '플래티넘',
  빈칸헌터: '골드',
  자바의달인: '플래티넘',
  프론트요정: '실버',
  스타일리스트: '브론즈',
};

const TIER_ICON_MAP: Record<string, string> = {
  브론즈: '🥉',
  실버: '🥈',
  골드: '🥇',
  플래티넘: '💠',
  다이아: '💎',
  마스터: '👑',
};

/** 레이팅 점수 → 티어 (밴드 기준) */
export function getTierByRating(rating: number): string {
  const score = Number(rating) || 0;
  if (score >= 2200) return '마스터';
  if (score >= 1900) return '다이아';
  if (score >= 1600) return '플래티넘';
  if (score >= 1300) return '골드';
  if (score >= 1000) return '실버';
  return '브론즈';
}

export function getTierByUserName(userName: string): string {
  return USER_TIER_MAP[userName] || '브론즈';
}

export function getTierIconByTier(tier: string): string {
  return TIER_ICON_MAP[tier] || '⭐';
}

export function getTierIconByUserName(userName: string): string {
  return getTierIconByTier(getTierByUserName(userName));
}

