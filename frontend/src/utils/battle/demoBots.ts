import { resolveProblemStyle } from '../problemCapabilities';
import { getProblemAnswersForLang } from '../problemTypeUtils';

export interface DemoBot {
  id: string;
  name: string;
  avatar: string;
  style: string;
  tag: string;
  skill: number;
  score: number;
  solvedProblems: number[];
  codeByProblem: string[];
  status: string;
  solveAtRemaining: Record<number, number>;
  solveScheduleByProblem?: number[];
  blankAnswersByProblem?: string[][];
  scoreBonusByProblem?: number[];
}

export const DEMO_BOT_POOL: Array<{ name: string; avatar: string; style: string; tag: string }> = [];

const GENERIC_OPPONENT_PROFILE = { style: 'player', tag: 'PVP' };

function hashString(value: string): number {
  let hash = 2166136261;
  const text = String(value || '');
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): () => number {
  let state = hashString(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1000000) / 1000000;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export interface BattleRoomPlayer {
  id: number;
  name: string;
  character: string;
  isHost: boolean;
}

function buildBotFromProfile(
  index: number,
  botCount: number,
  profile: { style: string; tag: string },
  name: string,
  avatar: string,
  id: string,
): Omit<DemoBot, 'solveScheduleByProblem' | 'blankAnswersByProblem' | 'scoreBonusByProblem'> {
  return {
    id,
    name,
    avatar,
    style: profile.style,
    tag: profile.tag,
    skill: clamp(0.55 + (botCount - index) * 0.06, 0.55, 0.95),
    score: 1000 - index * 35,
    solvedProblems: [],
    codeByProblem: [],
    status: 'waiting',
    solveAtRemaining: {},
  };
}

export function createDemoOpponentRoster(
  _roomMode: string,
  _maxPlayers: string,
  _roomId: string,
  roomRoster?: BattleRoomPlayer[],
): Omit<DemoBot, 'solveScheduleByProblem' | 'blankAnswersByProblem' | 'scoreBonusByProblem'>[] {
  const roomOpponents = (roomRoster || []).filter((player) => !player.isHost);
  if (roomOpponents.length > 0) {
    const botCount = roomOpponents.length;
    return roomOpponents.map((player, index) =>
      buildBotFromProfile(
        index,
        botCount,
        GENERIC_OPPONENT_PROFILE,
        player.name,
        player.character,
        `player-${player.id}`,
      ),
    );
  }

  return [];
}

type ProblemLike = {
  title?: string;
  question?: string;
  type?: string;
  answer?: Record<string, string[]>;
  options?: string[] | null;
  correctIndex?: number | null;
  difficulty?: string;
};

export function buildDemoCode(langKey: string, problem: ProblemLike, bot: { name: string; style: string; tag: string }, problemIndex: number): string {
  const title = problem?.title || `Problem ${problemIndex + 1}`;
  const header = `// ${bot.name} :: ${title}`;
  const hint = `// style: ${bot.style} / ${bot.tag}`;
  if (langKey === 'PYTHON') {
    return `${header}\n${hint}\n\ndef solution(*args):\n    # demo answer\n    values = list(args)\n    return values\n\nif __name__ == '__main__':\n    print(solution())\n`;
  }
  if (langKey === 'CPP' || langKey === 'C++') {
    return `${header}\n${hint}\n#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // demo answer\n    return 0;\n}\n`;
  }
  return `${header}\n${hint}\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // demo answer\n    }\n}\n`;
}

export function generateBotBlankAnswers(problem: ProblemLike, _bot: { skill?: number }, langKey: string): string[] {
  const partial = problem?.question || '';
  const allCorrect = getProblemAnswersForLang(problem?.answer, langKey);
  const blankCount = Math.max((partial.match(/_____/g) || []).length, allCorrect.length);
  const correctAnswers = allCorrect.slice(0, blankCount || allCorrect.length);
  if (!correctAnswers.length) return [];
  return [...correctAnswers];
}

export function generateBotProblemAnswers(
  problem: ProblemLike,
  _bot: { skill?: number },
  langKey: string,
  _rng: () => number = Math.random,
): string[] {
  const style = resolveProblemStyle(problem.type);

  if (style === 'multiple_choice') {
    const options = problem.options || [];
    if (!options.length) return [];
    const correct = problem.correctIndex ?? 0;
    return [String(correct)];
  }

  if (style === 'short_answer') {
    const answers = getProblemAnswersForLang(problem.answer, langKey);
    const ans = answers[0] || '';
    return ans ? [ans] : [''];
  }

  return generateBotBlankAnswers(problem, _bot, langKey);
}

export function buildDemoRoundPlan(params: {
  sessionId: string;
  problemIndex: number;
  problem: ProblemLike;
  roundSeconds: number;
  roster: Array<{ id: string; name: string; avatar: string; style: string; tag: string; skill?: number }>;
  langKey: string;
  roomMode: string;
}) {
  const rng = createSeededRandom(`${params.sessionId}:${params.problemIndex}:${params.roomMode}:${params.langKey}`);
  const maxSolveDelay = Math.max(8, Math.min(55, params.roundSeconds - 5));

  return {
    startedAt: Date.now(),
    problemIndex: params.problemIndex,
    roundSeconds: params.roundSeconds,
    completed: false,
    bots: params.roster.map((bot, index) => {
      const perProblemTime = clamp(20 + index * 3 + (rng() < 0.5 ? -1 : 1), 5, maxSolveDelay);
      const accumulatedTime = (params.problemIndex + 1) * perProblemTime;
      const solveAtRemaining = Math.max(0, params.roundSeconds - accumulatedTime);
      return {
        id: bot.id,
        name: bot.name,
        avatar: bot.avatar,
        style: bot.style,
        tag: bot.tag,
        solveAtRemaining,
        solved: false,
        solvedAt: null,
        code: buildDemoCode(params.langKey, params.problem, bot, params.problemIndex),
        blankAnswers: generateBotProblemAnswers(params.problem, bot, params.langKey, rng),
        scoreBonus: 60 + Math.floor((bot.skill || 0.6) * 100),
      };
    }),
  };
}

export function createDemoBattleRoster(params: {
  sessionId: string;
  roomMode: string;
  maxPlayers: string;
  langKey: string;
  problems: ProblemLike[];
  roundSeconds: number;
  roomRoster?: BattleRoomPlayer[];
}): DemoBot[] {
  const roomId = params.sessionId ? String(params.sessionId).replace('battle-', '') : '';
  const baseBots = createDemoOpponentRoster(params.roomMode, params.maxPlayers, roomId, params.roomRoster);
  const plansByProblem = params.problems.map((problem, problemIndex) =>
    buildDemoRoundPlan({
      sessionId: params.sessionId,
      problemIndex,
      problem,
      roundSeconds: params.roundSeconds,
      roster: baseBots,
      langKey: params.langKey,
      roomMode: params.roomMode,
    }),
  );

  return baseBots.map((bot, botIndex) => ({
    ...bot,
    solveScheduleByProblem: plansByProblem.map((plan) => plan.bots[botIndex].solveAtRemaining),
    codeByProblem: plansByProblem.map((plan) => plan.bots[botIndex].code),
    blankAnswersByProblem: plansByProblem.map((plan) => plan.bots[botIndex].blankAnswers),
    scoreBonusByProblem: plansByProblem.map((plan) => plan.bots[botIndex].scoreBonus),
  }));
}

export function computeDemoScore(baseScore: number, solvedCount: number, remaining: number, roundTime: number, solvedThisRound: boolean): number {
  const timeBonus = Math.max(0, Math.floor((remaining / Math.max(1, roundTime)) * 75));
  const clearBonus = solvedThisRound ? 50 : 0;
  return baseScore + solvedCount * 125 + timeBonus + clearBonus;
}

export function revealDemoCode(code: string): string {
  return String(code || '');
}

export function getBotSchedule(bot: Pick<DemoBot, 'solveScheduleByProblem'>, problemIndex: number): number {
  return bot.solveScheduleByProblem?.[problemIndex] ?? 0;
}

export function getBotSolveDelay(
  bot: Pick<DemoBot, 'solveScheduleByProblem'>,
  problemIndex: number,
  roundSeconds: number,
): number {
  const scheduleRemaining = getBotSchedule(bot, problemIndex);
  return Math.max(0, roundSeconds - scheduleRemaining);
}

/** elapsed 기준 — 아직 풀이 시간이 안 된 첫 문제가 봇의 현재 문제 */
export function getBotWorkingProblemIndexFromElapsed(
  bot: Pick<DemoBot, 'solveScheduleByProblem'>,
  elapsedSec: number,
  roundSeconds: number,
  totalProblems: number,
): number {
  for (let i = 0; i < totalProblems; i++) {
    if (elapsedSec < getBotSolveDelay(bot, i, roundSeconds)) {
      return i;
    }
  }
  return Math.max(0, totalProblems - 1);
}

export function isBotProblemSolvedByElapsed(
  bot: Pick<DemoBot, 'solveScheduleByProblem'>,
  problemIndex: number,
  elapsedSec: number,
  roundSeconds: number,
): boolean {
  return elapsedSec >= getBotSolveDelay(bot, problemIndex, roundSeconds);
}

export function collectBotSolvesFromElapsed(
  bots: Array<Pick<DemoBot, 'id' | 'solveScheduleByProblem'>>,
  totalProblems: number,
  elapsedSec: number,
  roundSeconds: number,
  prevSolves: Record<string, number[]>,
  recordedRef: Record<string, boolean>,
): Record<string, number[]> | null {
  if (bots.length === 0 || totalProblems === 0) return null;

  let changed = false;
  const nextSolves = { ...prevSolves };

  bots.forEach((bot) => {
    for (let problemIndex = 0; problemIndex < totalProblems; problemIndex++) {
      const solveDelay = getBotSolveDelay(bot, problemIndex, roundSeconds);
      const key = `${bot.id}-${problemIndex}`;
      if (elapsedSec < solveDelay || recordedRef[key]) continue;

      recordedRef[key] = true;
      const arr = Array.isArray(nextSolves[bot.id]) ? [...nextSolves[bot.id]] : [];
      if (!arr.includes(problemIndex)) {
        arr.push(problemIndex);
        arr.sort((a, b) => a - b);
        nextSolves[bot.id] = arr;
        changed = true;
      }
    }
  });

  return changed ? nextSolves : null;
}

export function getBotSolvedProblemsFromElapsed(
  bot: Pick<DemoBot, 'solveScheduleByProblem'>,
  elapsedSec: number,
  roundSeconds: number,
  totalProblems: number,
): number[] {
  const solved: number[] = [];
  for (let i = 0; i < totalProblems; i++) {
    if (isBotProblemSolvedByElapsed(bot, i, elapsedSec, roundSeconds)) {
      solved.push(i);
    }
  }
  return solved;
}

export function areAllBotsSolvedOnPlayerProblem(
  bots: Array<Pick<DemoBot, 'id' | 'solveScheduleByProblem'>>,
  problemIndex: number,
  elapsedSec: number,
  roundSeconds: number,
): boolean {
  return (
    bots.length > 0 &&
    bots.every((bot) => isBotProblemSolvedByElapsed(bot, problemIndex, elapsedSec, roundSeconds))
  );
}

export function getBotSpectatorAnswers(
  bot: Pick<DemoBot, 'blankAnswersByProblem'>,
  problemIndex: number,
  problem?: ProblemLike,
  langKey?: string,
): string[] {
  const stored = bot.blankAnswersByProblem?.[problemIndex] || [];
  const hasStored = stored.some((value) => String(value || '').trim() !== '');
  if (hasStored) return stored;
  if (problem && langKey) {
    return getProblemAnswersForLang(problem.answer, langKey);
  }
  return stored;
}

export function getBotSpectatorMcIndex(
  bot: Pick<DemoBot, 'blankAnswersByProblem'>,
  problem: { options?: string[] | null; correctIndex?: number | null },
  problemIndex: number,
): number | null {
  if (!problem.options?.length) return null;
  const raw = bot.blankAnswersByProblem?.[problemIndex]?.[0];
  if (raw !== undefined && raw !== '') {
    const idx = Number.parseInt(raw, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < problem.options.length) return idx;
  }
  const fallback = problem.correctIndex;
  if (fallback != null && fallback >= 0 && fallback < problem.options.length) return fallback;
  return null;
}

export function resolveSpectatorViewProblemIndex(
  botId: string,
  workingProblemIndex: number,
  spectatorViewByBot: Record<string, number>,
): number {
  const selected = spectatorViewByBot[botId];
  return selected === undefined ? workingProblemIndex : selected;
}

