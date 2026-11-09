import { matchDeadline } from '../battle/matchClock.js';
import { createHash } from 'node:crypto';
import { AppError } from '../../utils/appError.js';
import { wrapExecutionSource } from '../problem/variants.js';

const RESERVE = `
local old = redis.call('GET', KEYS[1])
if old then return old end
local used = tonumber(redis.call('HGET', KEYS[2], ARGV[1]) or '0')
local allowed = 3 + tonumber(redis.call('HGET', KEYS[3], ARGV[1]) or '0')
if used >= allowed then return 'LIMIT' end
redis.call('HINCRBY', KEYS[2], ARGV[1], 1)
redis.call('EXPIRE', KEYS[2], 7200)
local pending = cjson.encode({state='PENDING', hash=ARGV[2]})
redis.call('SET', KEYS[1], pending, 'EX', 7200)
return 'RESERVED'
`;
const COMPLETE = `
local old = redis.call('GET', KEYS[1])
if not old then return 0 end
if cjson.decode(old).state ~= 'PENDING' then return 0 end
if ARGV[3] == 'refund' then redis.call('HINCRBY', KEYS[2], ARGV[1], -1) end
redis.call('SET', KEYS[1], ARGV[2], 'EX', 7200)
return 1
`;
const id = value => typeof value === 'string' && /^[\w-]{1,160}$/.test(value);
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
export function createExecutionService({ matches, redis, runner, now = Date.now }) {
  const pending = new Map();
  async function storage(action) {
    try { return await action(); }
    catch { throw new AppError(503, 'BUILD_STORAGE_UNAVAILABLE', '빌드 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'); }
  }
  async function counts(matchId, userId) {
    const [used, bonus] = await storage(() => Promise.all([
      redis.hGetAll(`battle:buildUsed:${matchId}:${userId}`), redis.hGetAll(`battle:buildBonus:${matchId}:${userId}`),
    ]));
    return { used, bonus };
  }
  return {
    counts,
    async execute(input, userId) {
      if (!input || typeof input !== 'object') throw new AppError(400, 'INVALID_BUILD_REQUEST', '빌드 요청을 확인해 주세요.');
      const language = String(input.language || '').toUpperCase().replace('C++', 'CPP');
      if (!['JAVA', 'PYTHON', 'CPP'].includes(language) || typeof input.code !== 'string' || !input.code.trim() || Buffer.byteLength(input.code) > 32000 || !id(input.requestId)) {
        throw new AppError(400, 'INVALID_BUILD_REQUEST', '언어, 소스 코드와 요청 ID를 확인해 주세요.');
      }
      let source = input.code;
      let match;
      const index = Number(input.problemIndex);
      if (input.matchId) {
        if (!id(input.matchId) || !Number.isInteger(index) || index < 0) throw new AppError(400, 'INVALID_BUILD_REQUEST', '경기와 문제 번호가 올바르지 않습니다.');
        match = await matches.findMatchById(input.matchId);
        if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', '경기를 찾을 수 없습니다.');
        if (!await matches.isMatchParticipant(match.id, userId)) throw new AppError(403, 'MATCH_PARTICIPANT_REQUIRED', '경기 참가자만 빌드할 수 있습니다.');
        const timePenalty = await matches.findPlayerTimePenalty?.(match.id, userId);
        if (match.status !== 'IN_PROGRESS' || now() >= matchDeadline(match, timePenalty)) throw new AppError(409, 'MATCH_NOT_IN_PROGRESS', '경기 시간이 종료되었습니다.');
        const finished = await matches.findMatchSubmissions(match.id);
        if (finished.some(row => String(row.userId) === String(userId))) throw new AppError(409, 'MATCH_ALREADY_SUBMITTED', '최종 제출 후에는 빌드할 수 없습니다.');
        const problems = await matches.findMatchProblems(match.id);
        const problem = problems[index];
        if (!problem || !problem.executionKind || String(match.language).replace('C++', 'CPP') !== language) throw new AppError(400, 'PROBLEM_BUILD_UNSUPPORTED', '이 문제와 언어에서는 코드 실행을 지원하지 않습니다.');
        source = wrapExecutionSource(source, language, problem.executionKind);
      }
      if (!await runner.ready()) throw new AppError(503, 'BUILD_UNAVAILABLE', '실행 환경이 준비되지 않았습니다.');
      const identity = `${match?.id || 'practice'}:${userId}:${match ? index : 0}`;
      const requestKey = `battle:buildRequest:${identity}:${input.requestId}`;
      const digest = createHash('sha256').update(`${language}\n${source}`).digest('hex');
      if (pending.has(requestKey)) {
        const existing = pending.get(requestKey);
        if (existing.digest !== digest) throw new AppError(409, 'BUILD_REQUEST_CONFLICT', '같은 요청 ID의 코드가 다릅니다.');
        return existing.promise;
      }
      const run = async () => {
        const usedKey = `battle:buildUsed:${match?.id}:${userId}`;
        let used = 0, allowed = 3;
        if (match) {
          const reserved = await storage(() => redis.eval(RESERVE, {
            keys: [requestKey, usedKey, `battle:buildBonus:${match.id}:${userId}`], arguments: [String(index), digest],
          }));
          if (reserved === 'LIMIT') throw new AppError(409, 'BUILD_LIMIT_REACHED', '이 문제의 빌드 횟수를 모두 사용했습니다.');
          if (reserved !== 'RESERVED') {
            const existing = parse(reserved);
            if (existing.hash !== digest) throw new AppError(409, 'BUILD_REQUEST_CONFLICT', '같은 요청 ID의 코드가 다릅니다.');
            if (existing.state === 'DONE') return existing.result;
            throw new AppError(409, 'BUILD_IN_PROGRESS', '같은 빌드 요청을 처리 중입니다.');
          }
        } else {
          const cache = await storage(() => redis.get(requestKey));
          if (cache) {
            const existing = parse(cache);
            if (existing.hash !== digest) throw new AppError(409, 'BUILD_REQUEST_CONFLICT', '같은 요청 ID의 코드가 다릅니다.');
            return existing.result;
          }
          const rateKey = `battle:practiceBuildRate:${userId}:${Math.floor(now() / 60000)}`;
          const rate = await storage(() => redis.incr(rateKey));
          await storage(() => redis.expire(rateKey, 120));
          if (rate > 6) throw new AppError(429, 'BUILD_RATE_LIMIT', '잠시 후 다시 빌드해 주세요.');
        }
        let result;
        try { result = await runner.run({ code: source, language }); }
        catch { result = { success: false, status: 'UNAVAILABLE', output: '', error: '실행 환경에 연결할 수 없습니다.', executionTime: 0 }; }
        const refund = ['UNAVAILABLE', 'BUSY'].includes(result.status);
        if (match) {
          const state = await counts(match.id, userId);
          used = Number(state.used[index] || 0) - (refund ? 1 : 0);
          allowed += Number(state.bonus[index] || 0);
        }
        const response = { ...result, requestId: input.requestId, buildsUsed: used, buildsAllowed: allowed };
        const cached = JSON.stringify({ state: 'DONE', hash: digest, result: response });
        if (match) await storage(() => redis.eval(COMPLETE, { keys: [requestKey, usedKey], arguments: [String(index), cached, refund ? 'refund' : 'keep'] }));
        else await storage(() => redis.set(requestKey, cached, { EX: 120 }));
        return response;
      };
      const promise = run();
      pending.set(requestKey, { digest, promise });
      try { return await promise; } finally { pending.delete(requestKey); }
    },
  };
}
