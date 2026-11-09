export const TIME_REDUCE_SECONDS = 60;

export function matchDeadline(match, timePenalty = 0) {
  return new Date(match.startedAt).getTime() + (Number(match.roundSeconds) - timePenalty) * 1000;
}

export function draftKey(matchId, userId) {
  return `battle:draft:${matchId}:${encodeURIComponent(userId)}`;
}

// A match's answer writes, timer, and final submissions share one order.
const operations = new Map();

export async function withMatchOperation(matchId, operation) {
  const previous = operations.get(matchId) || Promise.resolve();
  const current = previous.then(operation);
  const tail = current.then(() => undefined, () => undefined);
  operations.set(matchId, tail);
  try {
    return await current;
  } finally {
    if (operations.get(matchId) === tail) operations.delete(matchId);
  }
}
