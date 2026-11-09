import { AppError } from '../../utils/appError.js';
import { createHash } from 'node:crypto';
import { draftKey, matchDeadline } from '../battle/matchClock.js';

const SAVE_DRAFT = `
local previous = redis.call('GET', KEYS[1])
if previous then
  local saved = cjson.decode(previous)
  if saved.version > tonumber(ARGV[2]) then return 0 end
  if saved.version == tonumber(ARGV[2]) then
    if saved.requestHash == ARGV[4] then return {2, saved.savedAt} end
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
return {1, tonumber(ARGV[5])}
`;

function identifier(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,160}$/.test(value)) {
    throw new AppError(400, 'INVALID_MATCH_ID', '올바른 경기 ID가 필요합니다.');
  }
  return value;
}

export function createSessionService({ matches, redis, now = Date.now }) {
  async function getMatch(matchId, userId) {
    identifier(matchId);
    const match = await matches.findMatchById(matchId);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', '경기를 찾을 수 없습니다.');
    if (!await matches.isMatchParticipant(matchId, userId)) {
      throw new AppError(403, 'MATCH_PARTICIPANT_REQUIRED', '경기 참가자만 요청할 수 있습니다.');
    }
    return match;
  }

  async function remaining(match, userId) {
    const penalty = await matches.findPlayerTimePenalty?.(match.id, userId);
    const seconds = (matchDeadline(match, penalty) - now()) / 1000;
    if (!Number.isFinite(seconds)) throw new AppError(503, 'MATCH_TIME_UNAVAILABLE', '경기 시간을 확인할 수 없습니다.');
    return Math.max(0, Math.ceil(seconds));
  }

  async function storage(action) {
    try { return await action(); }
    catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'DRAFT_STORAGE_UNAVAILABLE', '답안을 임시 보관 중입니다. 서버 저장을 다시 시도합니다.');
    }
  }

  return {
    async save(input, userId) {
      const match = await getMatch(input?.matchId, userId);
      const finalized = matches.findMatchSubmissions ? await matches.findMatchSubmissions(match.id) : [];
      const remainingSeconds = await remaining(match, userId);
      if (match.status !== 'IN_PROGRESS' || remainingSeconds <= 0 || finalized.some(row => String(row.userId) === String(userId))) {
        throw new AppError(409, 'MATCH_NOT_IN_PROGRESS', '종료된 경기에는 답안을 저장할 수 없습니다.');
      }
      const count = Number(match.problemCount);
      const { version, currentIndex, codes, blankAnswers, selectedOptions, selectedItemKeys } = input;
      const validStrings = values => Array.isArray(values) && values.every(v => typeof v === 'string' && v.length <= 32000);
      const validCounters = values => values && typeof values === 'object' && !Array.isArray(values) &&
        Object.entries(values).every(([k, v]) => /^\d+$/.test(k) && Number(k) < count && Number.isFinite(v) && v >= 0 && v <= Number(match.roundSeconds) + 100);
      if (!Number.isSafeInteger(version) || version < 1 ||
          !Number.isInteger(currentIndex) || currentIndex < 0 || currentIndex >= count ||
          !validStrings(codes) || codes.length !== count ||
          !Array.isArray(blankAnswers) || blankAnswers.length !== count || !blankAnswers.every(validStrings) ||
          !selectedOptions || typeof selectedOptions !== 'object' || Array.isArray(selectedOptions) ||
          !Object.entries(selectedOptions).every(([k, v]) => /^\d+$/.test(k) && Number(k) < count && Number.isInteger(v) && v >= 0 && v < 100) ||
          (selectedItemKeys !== undefined && (!Array.isArray(selectedItemKeys) || selectedItemKeys.length > 10 ||
            !selectedItemKeys.every(key => typeof key === 'string' && /^[A-Za-z]{1,20}$/.test(key)))) ||
          !validCounters(input.solveTimes || {}) || !validCounters(input.buildsUsed || {}) ||
          (input.problemStartedAtElapsed !== undefined && (!Number.isFinite(input.problemStartedAtElapsed) || input.problemStartedAtElapsed < 0 || input.problemStartedAtElapsed > Number(match.roundSeconds) + 100))) {
        throw new AppError(400, 'INVALID_DRAFT', '올바른 답안 저장 정보가 필요합니다.');
      }
      const draftRemaining = Number.isFinite(input.remaining) ? Math.max(0, Math.min(remainingSeconds, input.remaining)) : remainingSeconds;
      const requestHash = createHash('sha256').update(JSON.stringify([version, currentIndex, codes, blankAnswers, selectedOptions, input.solveTimes || {}, input.buildsUsed || {}, Number.isFinite(input.remaining) ? input.remaining : null, input.problemStartedAtElapsed ?? null, ...(selectedItemKeys === undefined ? [] : [selectedItemKeys])])).digest('hex');
      const problemStartedAtElapsed = Math.min(Number(match.roundSeconds) - remainingSeconds, input.problemStartedAtElapsed ?? Object.values(input.solveTimes || {}).reduce((sum, value) => sum + value, 0));
      const document = { problemStartedAtElapsed, matchId: match.id, version, currentIndex, codes, blankAnswers, selectedOptions, solveTimes: input.solveTimes || {}, buildsUsed: input.buildsUsed || {}, selectedItemKeys, remaining: draftRemaining, savedAt: now(), requestHash };
      const serialized = JSON.stringify(document);
      if (Buffer.byteLength(serialized, 'utf8') > 90000) throw new AppError(413, 'DRAFT_TOO_LARGE', '답안 크기 제한을 초과했습니다.');
      const updated = await storage(() => redis.eval(SAVE_DRAFT, {
        keys: [draftKey(match.id, userId)],
        arguments: [serialized, String(version), String(Math.max(3600, Number(match.roundSeconds) + 3600)), requestHash, String(document.savedAt)],
      }));
      const status = Number(Array.isArray(updated) ? updated[0] : updated);
      if (status !== 1 && status !== 2) throw new AppError(409, 'DRAFT_VERSION_CONFLICT', '더 최신의 답안이 이미 저장되어 있습니다.');
      return { saved: true, version, savedAt: Array.isArray(updated) ? Number(updated[1]) : document.savedAt };
    },

    async load(matchId, userId) {
      const match = await getMatch(matchId, userId);
      const raw = await storage(() => redis.get(draftKey(match.id, userId)));
      let draft = null;
      try { draft = raw ? JSON.parse(raw) : null; }
      catch { throw new AppError(503, 'DRAFT_UNREADABLE', '저장된 답안을 확인할 수 없습니다.'); }
      if (draft) delete draft.requestHash;
      const written = await storage(() => redis.hGetAll(`battle:written:${matchId}:${userId}`));
      const score = Number(await storage(() => redis.hGet(`battle:scores:${matchId}`, String(userId))) || 0);
      const submissions = Object.entries(written || {}).map(([index, value]) => ({ index: Number(index), ...JSON.parse(value) }));
      const finalized = matches.findMatchSubmissions ? await matches.findMatchSubmissions(matchId) : [];
      const players = matches.findMatchParticipantsForResult ? await matches.findMatchParticipantsForResult(matchId) : [];
      const buildsUsed = await storage(() => redis.hGetAll(`battle:buildUsed:${matchId}:${userId}`));
      const buildBonus = await storage(() => redis.hGetAll(`battle:buildBonus:${matchId}:${userId}`));
      const opponentProgress = await Promise.all(players.filter(player => String(player.userId) !== String(userId)).map(async player => {
        const [written, score] = await storage(() => Promise.all([
          redis.hGetAll(`battle:written:${matchId}:${player.userId}`), redis.hGet(`battle:scores:${matchId}`, String(player.userId)),
        ]));
        return { userId: player.userId, score: Number(score || 0), submittedProblems: Object.keys(written).map(Number).filter(Number.isInteger), finished: finalized.some(row => String(row.userId) === String(player.userId)) };
      }));
      const roomRoster = players.map(player => ({ id: Number(player.slotIndex), userId: player.userId, name: player.displayName || player.username, character: player.avatar, isHost: Number(player.isHost) === 1, ratingScore: Number(player.ratingScore) }));
      const remainingSeconds = await remaining(match, userId);
      const draftRemaining = draft && Number.isFinite(draft.remaining) ? Math.max(0, draft.remaining - Math.floor((now() - draft.savedAt) / 1000)) : remainingSeconds;
      return { match: { ...match, problems: await matches.findMatchProblems(matchId) }, draft, progress: { submissions, score, finished: finalized.some(row => String(row.userId) === String(userId)) },
        roomRoster, opponentProgress, buildState: { used: buildsUsed, bonus: buildBonus }, remainingSeconds: match.status === 'IN_PROGRESS' ? Math.min(remainingSeconds, draftRemaining) : 0, serverTime: now() };
    },
  };
}
