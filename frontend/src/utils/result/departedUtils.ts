export function isDepartedPlayer(
  playerId: string | null | undefined,
  departedUserIds: Set<string> | undefined | null,
): boolean {
  if (!playerId || !departedUserIds || departedUserIds.size === 0) return false;
  const raw = String(playerId);
  const pid = raw.replace(/^player-/, '');
  return (
    departedUserIds.has(raw) ||
    departedUserIds.has(pid) ||
    departedUserIds.has(`player-${pid}`)
  );
}

export function collectDepartedIdVariants(playerId: string): string[] {
  const raw = String(playerId || '');
  const pid = raw.replace(/^player-/, '');
  return Array.from(new Set([raw, pid, `player-${pid}`].filter(Boolean)));
}
