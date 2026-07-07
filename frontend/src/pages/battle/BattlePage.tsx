import { getCurrentUserName } from '../../services/authService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BattleChatPanel, { type ChatMessage } from '../../components/battle/BattleChatPanel';
import BattleBuildPanel from '../../components/battle/BattleBuildPanel';
import FillBlankRenderer from '../../components/battle/FillBlankRenderer';
import ProblemVisualPreview from '../../components/battle/ProblemVisualPreview';
import ItemSelectModal from '../../components/battle/ItemSelectModal';
import OpponentPanels, { type BotView } from '../../components/battle/OpponentPanels';
import { RoomAlertModal } from '../../components/room/RoomAlertModal/RoomAlertModal';
import {
ATTACK_ITEM_KEYS,
BATTLE_BUILD_ITEM_BONUS,
BATTLE_BUILD_LIMIT,
ITEM_PANEL_EFFECT_MS,
SELF_ITEM_KEYS,
type ItemKey,
} from '../../constants/itemTypes';
import { BATTLE_CORRECT_SCORE } from '../../constants/battleConstants';
import { ROUTES } from '../../constants/routes';
import { getBattleProblems, getBattleSettings } from '../../services/sessionStore';
import {
  clearBattleAndLeave,
  getSessionId,
  markProblemSubmitted,
  persistBattleSession,
  persistBattleSubmission,
  restoreBattleSession,
  saveFinalRankingSnapshot,
  saveRoomUsers,
  syncBattleDemoState,
} from '../../services/battleSessionService';
import { getItemInventory, getRatingScore, setItemInventory as persistItemInventory } from '../../services/userService';
import type { BattleProblem, ItemInventory, RoomUser } from '../../types/battle';
import { loadAudioSettings } from '../../utils/audio/audioSettings';
import { applyAudioSettings, BattleBGM, LobbyBGM, SFX } from '../../utils/audio/gameAudio';
import {
  computeBotRankScore,
  buildRankingSnapshotFromRoomUsers,
  getBotRankMetrics,
  getUserRankMetrics,
} from '../../utils/battle/rankUtils';
import {
  clearPaintCanvas,
  clearScribbleCanvas,
  startPaintCanvas,
  startScribbleCanvas,
} from '../../utils/battle/canvasEffects';
import { assembleCode, DEFAULT_TEMPLATE, getLangKey, getLangLabel, getTotalBattleSeconds } from '../../utils/battle/codeUtils';
import { canUseItem, resolveProblemCapabilities } from '../../utils/problemCapabilities';
import {
  areAllBotsSolvedOnPlayerProblem,
  createDemoBattleRoster,
  getBotSchedule,
  getBotSolvedProblemsFromElapsed,
  getBotWorkingProblemIndexFromElapsed,
  isBotProblemSolvedByElapsed,
  resolveSpectatorViewProblemIndex,
  type DemoBot,
} from '../../utils/battle/demoBots';
import { formatTime } from '../../utils/battle/formatTime';
import {
  buildBotProblemResults,
  finalizeProblemResults,
  isProblemAnswerCorrect,
  hasProblemAnswerAttempted,
  normalizeBattleProblem,
  normalizeBattleProblems,
  type ProblemResultsMap,
} from '../../utils/battle/problemResultUtils';
import { runBuildSimulation, type BuildLogLine } from '../../utils/build/buildSimulator';
import { getProblemAnswersForLang, isCodeBlankBuildProblem } from '../../utils/problemTypeUtils';
import problemsBank from '../../data/problems.js';
import './battle.css';

const SELF_ITEM_META: Record<string, { icon: string; name: string }> = {
  revealLength: { icon: '📏', name: '글자수' },
  revealPrev: { icon: '🔍', name: '앞글자' },
  blankBreak: { icon: '🔨', name: '깨기' },
  buildCharge: { icon: '🔧', name: '빌드+' },
};

function resolveProblemAnswersWithFallback(problem: BattleProblem, langKey: string): string[] {
  const fromProblem = getProblemAnswersForLang(problem.answer, langKey);
  if (fromProblem.length > 0) return fromProblem;

  const bank = problemsBank as BattleProblem[];
  const match =
    (problem.id ? bank.find((entry) => entry.id === problem.id) : undefined) ||
    bank.find(
      (entry) =>
        entry.title === problem.title &&
        String(entry.question || '').trim() === String(problem.question || '').trim(),
    ) ||
    bank.find((entry) => entry.title === problem.title);

  if (!match) return [];
  return getProblemAnswersForLang(match.answer, langKey);
}

export default function BattlePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const freshStart = params.get('fresh') === '1';
  const roomId = params.get('roomId') || '';
  const roomMode = params.get('mode') || '1/1';
  const battleMeta = useMemo(() => getBattleSettings(), []);
  const gameMode = params.get('gameMode') || battleMeta.gameMode || 'item';
  const isItemMode = gameMode === 'item';
  const selectedItemKeys = useMemo(() => {
    if (!isItemMode) return new Set<ItemKey>();
    const keys = battleMeta.selectedItems;
    return new Set(Array.isArray(keys) ? (keys as ItemKey[]) : []);
  }, [battleMeta, isItemMode]);
  const selectedAttackItems = useMemo(
    () => ATTACK_ITEM_KEYS.filter((key) => selectedItemKeys.has(key)),
    [selectedItemKeys],
  );
  const selectedSelfItems = useMemo(
    () => SELF_ITEM_KEYS.filter((key) => selectedItemKeys.has(key)),
    [selectedItemKeys],
  );
  const battleDiff = String(battleMeta.diff ?? 'NORMAL');
  const battleCount = String(battleMeta.count ?? '5');
  const roomRoster = Array.isArray(battleMeta.roomRoster) ? battleMeta.roomRoster : undefined;
  const maxPlayersParam = params.get('maxPlayers') || '2';
  const lang = params.get('lang') || 'JAVA';
  const langKey = getLangKey(lang);
  const langLabel = getLangLabel(langKey);
  const templateCode = DEFAULT_TEMPLATE[langKey] || DEFAULT_TEMPLATE.JAVA;
  const sessionId = getSessionId(roomId);
  const demoIsVersusMany = roomMode !== '1/1';

  const [problems, setProblems] = useState<BattleProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const totalBattleSeconds = useMemo(
    () => getTotalBattleSeconds(battleDiff, Math.max(1, problems.length || parseInt(battleCount, 10) || 5)),
    [battleDiff, problems.length, battleCount],
  );
  const [remaining, setRemaining] = useState(() =>
    getTotalBattleSeconds(battleDiff, Math.max(1, parseInt(battleCount, 10) || 5)),
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearFlash, setShowClearFlash] = useState(false);
  const [demoSpectating, setDemoSpectating] = useState(false);
  const [spectatorLocked, setSpectatorLocked] = useState(false);
  const [battleFinished, setBattleFinished] = useState(false);
  const [battleBots, setBattleBots] = useState<DemoBot[]>([]);
  const [expandedOpponentId, setExpandedOpponentId] = useState<string | null>(null);
  const [spectatorViewProblemByBot, setSpectatorViewProblemByBot] = useState<Record<string, number>>({});
  const [spectatorMyViewProblem, setSpectatorMyViewProblem] = useState<number | null>(null);
  const [selectedOptionByProblem, setSelectedOptionByProblem] = useState<Record<number, number>>({});
  const [localSolvedProblems, setLocalSolvedProblems] = useState<number[]>([]);
  const [blankAnswers, setBlankAnswers] = useState<string[][]>([]);
  const [ingameScore, setIngameScore] = useState(0);
  const [solveTimes, setSolveTimes] = useState<Record<number, number>>({});
  const [finishedAtElapsedSec, setFinishedAtElapsedSec] = useState(-1);
  const [problemResults, setProblemResults] = useState<ProblemResultsMap>({});
  const problemResultsRef = useRef<ProblemResultsMap>({});
  const [myRatingScore] = useState(() => getRatingScore());
  const [problemSolved, setProblemSolved] = useState(false);
  const [problemStartTime, setProblemStartTime] = useState(Date.now());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealHint, setRevealHint] = useState<string | null>(null);
  const [showAnswerRequiredModal, setShowAnswerRequiredModal] = useState(false);
  const [breakingBlanks, setBreakingBlanks] = useState<Record<string, boolean>>({});
  const [itemCastState, setItemCastState] = useState<{ type: string; ts: number } | null>(null);
  const [panelHit, setPanelHit] = useState<Record<string, boolean>>({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [opponentEffects, setOpponentEffects] = useState<
    Record<string, Record<number, { panelEffect?: { type: string; expiresAt: number } }>>
  >({});
  const [itemInventory, setItemInventory] = useState<ItemInventory>(() => getItemInventory());
  const [sessionSavedSnapshot, setSessionSavedSnapshot] = useState('');
  const [, setSaveStatus] = useState<'saving' | 'saved' | 'unsaved'>('saved');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: 'SYSTEM', text: '배틀 시작! 서로 화이팅 하세요.', time: '' },
  ]);
  const [chatMsg, setChatMsg] = useState('');
  const [buildCodeByProblem, setBuildCodeByProblem] = useState<Record<number, string>>({});
  const [buildLogsByProblem, setBuildLogsByProblem] = useState<Record<number, BuildLogLine[]>>({});
  const [buildsUsedByProblem, setBuildsUsedByProblem] = useState<Record<number, number>>({});
  const [buildBonusByProblem, setBuildBonusByProblem] = useState<Record<number, number>>({});
  const [buildPanelCollapsed, setBuildPanelCollapsed] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const assembledBuildCodeRef = useRef('');
  const buildCancelledRef = useRef(false);
  const advanceQueuedRef = useRef(false);
  const itemTargetBotIdRef = useRef<string | null>(null);
  const gameOverNavRef = useRef(false);
  const saveModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSessionLoadedRef = useRef(false);
  const initialSessionSaveQueuedRef = useRef(false);
  const lastTimedPersistRemainingRef = useRef(-1);
  const itemInventoryInitialized = useRef(false);

  const currentProblem = useMemo(
    () => normalizeBattleProblem(problems[currentIndex] || ({} as BattleProblem)),
    [problems, currentIndex],
  );
  const currentCaps = useMemo(
    () =>
      resolveProblemCapabilities(currentProblem, {
        gameMode: isItemMode ? 'item' : 'normal',
      }),
    [currentProblem, isItemMode],
  );
  const shouldRenderProblemVisual = currentCaps.hasVisual || currentCaps.hasImage;
  const allowedAttackItems = selectedAttackItems;
  const currentProblemLocked = localSolvedProblems.includes(currentIndex);
  const hasProblems = problems.length > 0;
  const totalProblems = hasProblems ? problems.length : 1;
  const currentProblemNumber = hasProblems ? currentIndex + 1 : 0;
  const problemProgressText = hasProblems ? `${currentProblemNumber}/${totalProblems}` : '0/1';
  const progressPercent = hasProblems ? (currentProblemNumber / totalProblems) * 100 : 0;

  const finalizedProblemResults = useMemo(() => {
    problemResultsRef.current = problemResults;
    return finalizeProblemResults(problemResults, totalProblems);
  }, [problemResults, totalProblems]);

  const markProblemWrong = useCallback((problemIndex: number) => {
    setProblemResults((prev) => (prev[problemIndex] !== undefined ? prev : { ...prev, [problemIndex]: false }));
    setProblemSolved(true);
  }, []);

  const isCurrentAnswerCorrect = useCallback(
    () =>
      isProblemAnswerCorrect({
        problem: currentProblem,
        problemIndex: currentIndex,
        langKey,
        blankAnswers,
        selectedOption,
      }),
    [currentProblem, currentIndex, langKey, blankAnswers, selectedOption],
  );

  const hasCurrentAnswerAttempted = useCallback(
    () =>
      hasProblemAnswerAttempted({
        problem: currentProblem,
        problemIndex: currentIndex,
        langKey,
        blankAnswers,
        selectedOption,
      }),
    [currentProblem, currentIndex, langKey, blankAnswers, selectedOption],
  );

  const showBuildPanel = currentCaps.showCodePanel && isCodeBlankBuildProblem(currentProblem);
  const buildsAllowed = BATTLE_BUILD_LIMIT + (buildBonusByProblem[currentIndex] || 0);
  const buildsUsed = buildsUsedByProblem[currentIndex] || 0;
  const currentBuildCode = buildCodeByProblem[currentIndex] ?? '';
  const currentBuildLogs = buildLogsByProblem[currentIndex] || [];

  useEffect(() => {
    if (!showBuildPanel) return;
    const assembled = assembleCode(currentProblem.question || '', blankAnswers[currentIndex] || []);
    setBuildCodeByProblem((prev) => {
      const current = prev[currentIndex];
      if (current === undefined || current === assembledBuildCodeRef.current) {
        assembledBuildCodeRef.current = assembled;
        return { ...prev, [currentIndex]: assembled };
      }
      return prev;
    });
  }, [showBuildPanel, currentIndex, currentProblem.question, blankAnswers]);

  useEffect(() => {
    assembledBuildCodeRef.current = '';
    buildCancelledRef.current = true;
    setIsBuilding(false);
  }, [currentIndex]);

  const handleBuildCodeChange = useCallback(
    (code: string) => {
      setBuildCodeByProblem((prev) => ({ ...prev, [currentIndex]: code }));
    },
    [currentIndex],
  );

  const handleBattleBuild = useCallback(async () => {
    if (!showBuildPanel || isBuilding) return;
    if (buildsUsed >= buildsAllowed) return;

    buildCancelledRef.current = false;
    setIsBuilding(true);
    setBuildsUsedByProblem((prev) => ({ ...prev, [currentIndex]: (prev[currentIndex] || 0) + 1 }));
    setBuildLogsByProblem((prev) => ({ ...prev, [currentIndex]: [] }));

    const code = buildCodeByProblem[currentIndex] ?? assembledBuildCodeRef.current;
    const appendLog = (line: BuildLogLine) => {
      if (buildCancelledRef.current) return;
      setBuildLogsByProblem((prev) => ({
        ...prev,
        [currentIndex]: [...(prev[currentIndex] || []), line],
      }));
    };

    try {
      await runBuildSimulation(code, langKey, appendLog, { cancelled: () => buildCancelledRef.current });
    } finally {
      if (!buildCancelledRef.current) setIsBuilding(false);
    }
  }, [
    showBuildPanel,
    isBuilding,
    buildsUsed,
    buildsAllowed,
    currentIndex,
    buildCodeByProblem,
    langKey,
  ]);

  const selectedDemoBot = battleBots[0] || null;
  const selectedDemoBotCode = selectedDemoBot?.codeByProblem?.[currentIndex] || '// 상대 코드가 아직 없습니다.';

  const currentBotViews: BotView[] = useMemo(() => {
    return battleBots.map((bot) => {
      const solvedProblems = getBotSolvedProblemsFromElapsed(
        bot,
        elapsedSec,
        totalBattleSeconds,
        totalProblems,
      );
      const botCurrentProblem = getBotWorkingProblemIndexFromElapsed(
        bot,
        elapsedSec,
        totalBattleSeconds,
        totalProblems,
      );
      const schedule = getBotSchedule(bot, botCurrentProblem);
      const currentProblemSolved = isBotProblemSolvedByElapsed(
        bot,
        botCurrentProblem,
        elapsedSec,
        totalBattleSeconds,
      );
      const allDone = solvedProblems.length >= totalProblems;
      return {
        ...bot,
        status: allDone
          ? 'solved'
          : currentProblemSolved
            ? 'solved'
            : demoSpectating
              ? 'observing'
              : 'thinking',
        solvedProblems,
        currentProblem: botCurrentProblem,
        currentProblemSolved,
        currentBlankAnswers: bot.blankAnswersByProblem?.[botCurrentProblem] || [],
        currentSchedule: schedule,
      };
    });
  }, [battleBots, elapsedSec, totalBattleSeconds, demoSpectating, totalProblems]);

  const roomUsers: RoomUser[] = useMemo(() => {
    const meMetrics = getUserRankMetrics(localSolvedProblems, solveTimes, finishedAtElapsedSec);
    return [
      {
        id: 'me',
        name: getCurrentUserName(),
        avatar: '😎',
        problem: currentProblemNumber,
        solvedCount: localSolvedProblems.length,
        solvedProblems: localSolvedProblems,
        ingameScore,
        totalSolveTime: meMetrics.totalSolveTime,
        completionTime: meMetrics.completionTime,
        finishedAtElapsed: finishedAtElapsedSec >= 0 ? finishedAtElapsedSec : undefined,
        problemResults: finalizedProblemResults,
      },
      ...currentBotViews.map((bot) => {
        const botMetrics = getBotRankMetrics(bot, totalBattleSeconds, bot.solvedProblems);
        const botScore = computeBotRankScore(bot.solvedProblems.length);
        return {
          id: bot.id,
          name: bot.name,
          avatar: bot.avatar,
          problem: bot.currentProblem + 1,
          solvedCount: bot.solvedProblems.length,
          solvedProblems: bot.solvedProblems,
          status: bot.status,
          ingameScore: botScore,
          totalSolveTime: botMetrics.totalSolveTime,
          completionTime: botMetrics.completionTime,
          problemResults: buildBotProblemResults(bot.solvedProblems, totalProblems),
        };
      }),
    ];
  }, [
    currentBotViews,
    currentProblemNumber,
    totalBattleSeconds,
    totalProblems,
    ingameScore,
    localSolvedProblems,
    solveTimes,
    finishedAtElapsedSec,
    finalizedProblemResults,
  ]);

  const doPersistSession = useCallback(
    async (nextAnswers: string[], shouldCommit = false) => {
      await persistBattleSession({
        sessionId,
        roomId,
        langKey,
        currentIndex,
        remaining,
        answers: nextAnswers,
        problems,
        sessionSavedSnapshot,
        shouldCommit,
        onStatus: setSaveStatus,
        onSnapshotUpdate: (snapshot) => {
          setSessionSavedSnapshot(snapshot);
          setSaveStatus('saved');
        },
      });
    },
    [sessionId, roomId, langKey, currentIndex, remaining, problems, sessionSavedSnapshot],
  );

  const doPersistSubmission = useCallback(
    (nextAnswers: string[], nextProblemIndex = currentIndex) => {
      persistBattleSubmission({
        roomId,
        sessionId,
        problems,
        answers: nextAnswers,
        langKey,
        battleMode: roomMode,
        maxPlayersParam,
        currentIndex: nextProblemIndex,
        ingameScore,
        solveTimes,
        myRatingScore,
        remaining,
        roundSeconds: totalBattleSeconds,
        localSolvedProblems,
        finishedAtElapsedSec,
        problemResults: finalizeProblemResults(problemResultsRef.current, totalProblems),
        demoSpectating,
        spectatorLocked,
        battleBots,
        selectedDemoBotCode,
        blankAnswers,
        selectedOptions: selectedOptionByProblem,
      });
    },
    [
      roomId,
      sessionId,
      problems,
      langKey,
      roomMode,
      maxPlayersParam,
      currentIndex,
      ingameScore,
      solveTimes,
      myRatingScore,
      remaining,
      totalBattleSeconds,
      localSolvedProblems,
      finishedAtElapsedSec,
      totalProblems,
      demoSpectating,
      spectatorLocked,
      battleBots,
      selectedDemoBotCode,
      blankAnswers,
      selectedOptionByProblem,
    ],
  );

  useEffect(() => {
    const fallback: BattleProblem = {
      id: 'FB_FALLBACK',
      type: 'fill_blank',
      difficulty: 'easy',
      title: params.get('problem') || '기본 출력',
      question: 'System.out._____(Hello, World!");',
      answer: { JAVA: ['println'], PYTHON: ['print'], CPP: ['cout <<'] },
      options: null,
      correctIndex: null,
      explanation: '각 언어의 표준 출력 함수/명령입니다.',
    };

    try {
      const parsed = getBattleProblems();
      const baseProblems = normalizeBattleProblems(
        Array.isArray(parsed) && parsed.length > 0 ? parsed : [fallback],
      );
      const baseAnswers = Array(baseProblems.length).fill(templateCode) as string[];
      const initialTotalSeconds = getTotalBattleSeconds(battleDiff, baseProblems.length);

      if (!freshStart) {
        const restored = restoreBattleSession({
          sessionId,
          defaultRemainingSeconds: initialTotalSeconds,
          baseProblems,
          baseAnswers,
        });
        if (restored.restored) {
          if (restored.problems) setProblems(normalizeBattleProblems(restored.problems));
          if (restored.answers) setAnswers(restored.answers);
          if (restored.currentIndex !== undefined) setCurrentIndex(restored.currentIndex);
          if (restored.remaining !== undefined) setRemaining(restored.remaining);
          if (restored.snapshot) setSessionSavedSnapshot(restored.snapshot);
          setIsEditedFalse();
          initialSessionLoadedRef.current = true;
          initialSessionSaveQueuedRef.current = true;
          lastTimedPersistRemainingRef.current = restored.remaining ?? initialTotalSeconds;
          return;
        }
      }

      setProblems(baseProblems);
      setAnswers(baseAnswers);
      setCurrentIndex(0);
      setRemaining(initialTotalSeconds);
      setSessionSavedSnapshot(baseAnswers.join('||'));
      setIsEditedFalse();
      initialSessionLoadedRef.current = true;
      initialSessionSaveQueuedRef.current = true;
      lastTimedPersistRemainingRef.current = initialTotalSeconds;
    } catch (e) {
      console.error('문제 로드 실패:', e);
      const fallbackTotalSeconds = getTotalBattleSeconds(battleDiff, 1);
      setProblems([fallback]);
      setAnswers([templateCode]);
      setCurrentIndex(0);
      setRemaining(fallbackTotalSeconds);
      setSessionSavedSnapshot(templateCode);
      setIsEditedFalse();
      initialSessionLoadedRef.current = true;
      initialSessionSaveQueuedRef.current = true;
      lastTimedPersistRemainingRef.current = fallbackTotalSeconds;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setIsEditedFalse() {
    setSaveStatus('saved');
  }

  useEffect(() => {
    if (problems.length > 0) {
      setBlankAnswers(Array(problems.length).fill(null).map(() => []));
    }
  }, [problems]);

  useEffect(() => {
    if (problems.length === 0) return;
    const nextAnswers = problems.map((p, i) => assembleCode(p.question || '', blankAnswers[i] || []));
    setAnswers(nextAnswers);
  }, [blankAnswers, problems]);

  useEffect(() => {
    if (problems.length === 0) return;
    const roster = createDemoBattleRoster({
      sessionId,
      roomMode,
      maxPlayers: maxPlayersParam,
      langKey,
      problems,
      roundSeconds: totalBattleSeconds,
      roomRoster,
    });
    setBattleBots(roster);
  }, [problems.length, sessionId, roomMode, maxPlayersParam, langKey, totalBattleSeconds, roomRoster]);

  useEffect(() => {
    if (!demoIsVersusMany && battleBots.length === 1) {
      setExpandedOpponentId(battleBots[0].id);
    }
  }, [battleBots.length, demoIsVersusMany]);

  useEffect(() => {
    if (clearFlashTimerRef.current) clearTimeout(clearFlashTimerRef.current);
    if (!showClearFlash) return;
    clearFlashTimerRef.current = setTimeout(() => setShowClearFlash(false), 650);
    return () => {
      if (clearFlashTimerRef.current) clearTimeout(clearFlashTimerRef.current);
    };
  }, [showClearFlash]);

  useEffect(() => {
    if (battleFinished) return;
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [battleFinished]);

  useEffect(() => {
    LobbyBGM.stop();
    const settings = loadAudioSettings();
    applyAudioSettings(settings);
    if (settings.battleMusic) {
      BattleBGM.start('normal');
    }
    return () => BattleBGM.stop();
  }, []);

  useEffect(() => {
    if (!loadAudioSettings().battleMusic) return;
    BattleBGM.setMode(remaining <= 30 && remaining > 0 ? 'urgent' : 'normal');
  }, [remaining]);

  useEffect(() => {
    if (battleFinished) BattleBGM.stop();
  }, [battleFinished]);

  useEffect(() => {
    setRevealHint(null);
  }, [currentIndex]);

  useEffect(() => {
    const pruneExpiredEffects = () => {
      const now = Date.now();
      setOpponentEffects((prev) => {
        let changed = false;
        const next: typeof prev = {};

        Object.entries(prev).forEach(([botId, problemEffects]) => {
          const kept: typeof problemEffects = {};
          Object.entries(problemEffects).forEach(([problemKey, effectEntry]) => {
            const panelEffect = effectEntry?.panelEffect;
            if (panelEffect && now >= panelEffect.expiresAt) {
              if (panelEffect.type === 'paint') clearPaintCanvas(botId);
              if (panelEffect.type === 'scribble') clearScribbleCanvas(botId);
              changed = true;
              return;
            }
            kept[Number(problemKey)] = effectEntry;
          });
          if (Object.keys(kept).length > 0) next[botId] = kept;
          else if (Object.keys(problemEffects).length > 0) changed = true;
        });

        return changed ? next : prev;
      });
    };

    pruneExpiredEffects();
    const timer = setInterval(pruneExpiredEffects, 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (battleFinished || problems.length === 0) return;
    if (advanceQueuedRef.current) return;

    const allBotsSolved = areAllBotsSolvedOnPlayerProblem(
      battleBots,
      currentIndex,
      elapsedSec,
      totalBattleSeconds,
    );
    const timeUp = remaining <= 0;
    const isLastProblem = currentIndex >= problems.length - 1;
    const shouldAdvance = timeUp || (allBotsSolved && currentProblemLocked);

    if (!shouldAdvance) return;

    if (isLastProblem) {
      if (timeUp && problemResultsRef.current[currentIndex] === undefined) {
        problemResultsRef.current = { ...problemResultsRef.current, [currentIndex]: false };
        setProblemResults(problemResultsRef.current);
      }
      const playerFinalSubmitted = demoSpectating || spectatorLocked;
      if (timeUp || (allBotsSolved && playerFinalSubmitted)) {
        setBattleFinished(true);
        setShowGameOver(true);
        doPersistSubmission(answers, currentIndex);
      }
      return;
    }

    const reason = timeUp ? 'time' : 'all-clear';
    queueAdvanceProblem(reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, currentIndex, problems.length, battleBots, elapsedSec, totalBattleSeconds, currentProblemLocked, battleFinished, demoSpectating, spectatorLocked]);

  useEffect(() => {
    if (!initialSessionLoadedRef.current || showGameOver) return;
    if (remaining <= 0 || remaining % 5 !== 0) return;
    if (lastTimedPersistRemainingRef.current === remaining) return;
    lastTimedPersistRemainingRef.current = remaining;
    doPersistSession(answers).catch(() => {});
  }, [remaining, showGameOver, answers, doPersistSession]);

  useEffect(() => {
    if (!showGameOver) {
      gameOverNavRef.current = false;
      return;
    }
    if (gameOverNavRef.current) return;
    gameOverNavRef.current = true;
    doPersistSession(answers).catch(() => {});

    const snapshotRoomUsers = roomUsers.map((u) =>
      u.id === 'me'
        ? { ...u, problemResults: finalizeProblemResults(problemResultsRef.current, totalProblems) }
        : u,
    );

    const rankingSnapshot = buildRankingSnapshotFromRoomUsers({
      sessionId,
      roomId,
      elapsedSec,
      roundSeconds: totalBattleSeconds,
      totalProblems,
      roomUsers: snapshotRoomUsers,
      myRatingScore,
    });
    saveFinalRankingSnapshot(rankingSnapshot);
    saveRoomUsers(snapshotRoomUsers);
    doPersistSubmission(answers, currentIndex);

    const t = setTimeout(() => {
      navigate(`${ROUTES.RESULT}?roomId=${roomId}`);
    }, 3000);
    return () => clearTimeout(t);
  }, [
    showGameOver,
    sessionId,
    roomId,
    elapsedSec,
    totalBattleSeconds,
    roomUsers,
    myRatingScore,
    answers,
    currentIndex,
    doPersistSession,
    doPersistSubmission,
    navigate,
  ]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      doPersistSession(answers).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, doPersistSession]);

  useEffect(() => {
    return () => {
      if (saveModalTimerRef.current) clearTimeout(saveModalTimerRef.current);
      if (clearFlashTimerRef.current) clearTimeout(clearFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!itemInventoryInitialized.current) {
      itemInventoryInitialized.current = true;
      return;
    }
    persistItemInventory(itemInventory);
  }, [itemInventory]);

  useEffect(() => {
    if (problems.length === 0 || answers.length === 0) return;

    if (initialSessionLoadedRef.current && initialSessionSaveQueuedRef.current) {
      initialSessionSaveQueuedRef.current = false;
      doPersistSession(answers).catch(() => {});
    }

    const currentSnapshot = answers.join('||');
    if (!initialSessionLoadedRef.current) {
      initialSessionLoadedRef.current = true;
      setSessionSavedSnapshot(currentSnapshot);
      setSaveStatus('saved');
      doPersistSession(answers).catch(() => {});
      return;
    }

    const dirty = currentSnapshot !== sessionSavedSnapshot;
    setSaveStatus(dirty ? 'unsaved' : 'saved');

    if (!dirty) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      doPersistSession(answers).catch(() => {});
    }, 800);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [answers, sessionSavedSnapshot, problems.length, doPersistSession]);

  useEffect(() => {
    if (!initialSessionLoadedRef.current) return;
    doPersistSession(answers).catch(() => {});
  }, [currentIndex, doPersistSession, answers]);

  const queueAdvanceProblem = (_reason = 'time') => {
    if (advanceQueuedRef.current || battleFinished) return;
    advanceQueuedRef.current = true;
    syncBattleDemoState(sessionId, { event: 'advance-queued', reason: _reason, currentIndex, remaining });

    setProblemResults((prev) =>
      prev[currentIndex] !== undefined ? prev : { ...prev, [currentIndex]: false },
    );
    if (currentIndex >= problems.length - 1) {
      setBattleFinished(true);
      setShowGameOver(true);
      doPersistSubmission(answers, currentIndex);
      advanceQueuedRef.current = false;
      return;
    }
    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setProblemSolved(false);
    setSelectedOption(null);
    setProblemStartTime(Date.now());
    setShowGameOver(false);
    setDemoSpectating(false);
    setSpectatorLocked(false);
    setExpandedOpponentId(battleBots[0]?.id || 'bot-1');
    setShowSaveModal(false);
    setShowClearFlash(false);
    syncBattleDemoState(sessionId, {
      event: 'advance-complete',
      currentIndex: nextIndex,
      remaining,
      demoSpectating: false,
      spectatorLocked: false,
    });
    advanceQueuedRef.current = false;
  };

  const lockAndSpectate = () => {
    if (showSaveModal || demoSpectating || spectatorLocked) return;
    setShowSaveModal(true);
  };

  const finalizeSaveAndSpectate = async () => {
    if (saveModalTimerRef.current) clearTimeout(saveModalTimerRef.current);
    setShowSaveModal(false);
    setLocalSolvedProblems((prev) => Array.from(new Set([...prev, currentIndex])).sort((a, b) => a - b));
    markProblemSubmitted(sessionId, Array.from(new Set([...localSolvedProblems, currentIndex])).sort((a, b) => a - b));
    setDemoSpectating(true);
    setSpectatorLocked(true);
    setRevealHint(null);
    setSpectatorMyViewProblem(currentIndex);
    if (selectedOption !== null) {
      setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: selectedOption }));
    }
    setSessionSavedSnapshot(answers.join('||'));
    setSaveStatus('saved');
    setShowClearFlash(true);
    syncBattleDemoState(sessionId, {
      event: 'submit-lock',
      lockedProblemIndex: currentIndex,
      demoSpectating: true,
      spectatorLocked: true,
      currentProblemLocked: true,
      answers,
    });
    try {
      await doPersistSession(answers, true);
    } catch {
      /* ignore */
    }
    doPersistSubmission(answers, currentIndex);
  };

  const updateBlankAnswer = (problemIndex: number, blankIndex: number, value: string) => {
    if (problemSolved) return;
    setBlankAnswers((prev) => {
      const next = prev.map((arr) => [...arr]);
      if (!next[problemIndex]) next[problemIndex] = [];
      next[problemIndex][blankIndex] = value;
      return next;
    });
  };

  const submitCurrentProblem = () => {
    if (demoSpectating || spectatorLocked || problemSolved) return;
    if (!hasCurrentAnswerAttempted()) return;

    const isCorrect = isCurrentAnswerCorrect();
    const elapsed = (Date.now() - problemStartTime) / 1000;
    const battleElapsed = Math.max(0, totalBattleSeconds - remaining);

    setProblemResults((prev) => ({ ...prev, [currentIndex]: isCorrect }));

    if (isCorrect) {
      setIngameScore((prev) => prev + BATTLE_CORRECT_SCORE);
      setSolveTimes((prev) => ({ ...prev, [currentIndex]: elapsed }));
      setLocalSolvedProblems((prev) => {
        const next = Array.from(new Set([...prev, currentIndex])).sort((a, b) => a - b);
        markProblemSubmitted(sessionId, next);
        return next;
      });
      setFinishedAtElapsedSec(battleElapsed);
    }

    setProblemSolved(true);
  };

  const handleSubmit = () => {
    if (demoSpectating || spectatorLocked || problemSolved) return;
    if (!hasCurrentAnswerAttempted()) {
      setShowAnswerRequiredModal(true);
      return;
    }
    submitCurrentProblem();

    if (currentIndex >= problems.length - 1) {
      lockAndSpectate();
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    setProblemSolved(false);
    setSelectedOption(null);
    setProblemStartTime(Date.now());
  };

  const handleAdvance = () => {
    if (problemResults[currentIndex] === undefined) {
      markProblemWrong(currentIndex);
    }
    if (currentIndex >= problems.length - 1) {
      lockAndSpectate();
      return;
    }
    setCurrentIndex(currentIndex + 1);
    setProblemSolved(false);
    setSelectedOption(null);
    setProblemStartTime(Date.now());
  };

  const selectChoice = (idx: number) => {
    if (problemSolved) return;
    setSelectedOption(idx);
    setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: idx }));
  };

  const handleUseSelfItem = (type: keyof ItemInventory) => {
    if (demoSpectating || spectatorLocked) return;
    if (!isItemMode || !selectedItemKeys.has(type)) return;
    if (itemInventory[type] <= 0) return;
    if (!canUseItem(currentCaps, type)) return;
    const correct = resolveProblemAnswersWithFallback(currentProblem, langKey);
    if (type === 'revealLength') {
      if (correct.length === 0) {
        setRevealHint('(정보 없음)');
        return;
      }
      const idx = Math.floor(Math.random() * correct.length);
      setRevealHint(correct[idx] ? `[${correct[idx].length}자]` : '(정보 없음)');
    } else if (type === 'revealPrev') {
      if (correct.length === 0) {
        setRevealHint('(정보 없음)');
        return;
      }
      const idx = Math.floor(Math.random() * correct.length);
      setRevealHint(correct[idx] ? `[앞글자: ${correct[idx][0] || '?'}]` : '(정보 없음)');
    } else if (type === 'blankBreak') {
      applyBlankBreak(correct);
      return;
    } else if (type === 'buildCharge') {
      if (!currentCaps.canUseBuildBonus || !isCodeBlankBuildProblem(currentProblem)) return;
      setBuildBonusByProblem((prev) => ({
        ...prev,
        [currentIndex]: (prev[currentIndex] || 0) + BATTLE_BUILD_ITEM_BONUS,
      }));
    } else {
      return;
    }
    setItemInventory((prev) => ({ ...prev, [type]: prev[type] - 1 }));
    SFX.play(type);
  };

  const applyBlankBreak = (correct: string[]) => {
    if (correct.length === 0) {
      setRevealHint('(정보 없음)');
      return;
    }
    const partial = currentProblem.question || '';
    if (currentCaps.showShortAnswerPanel) {
      setBreakingBlanks((prev) => ({ ...prev, [`${currentIndex}_0`]: true }));
      setTimeout(() => {
        setBlankAnswers((prev) => {
          const next = prev.map((a) => [...a]);
          if (!next[currentIndex]) next[currentIndex] = [];
          next[currentIndex][0] = correct[0] || '';
          return next;
        });
        setBreakingBlanks((prev) => {
          const n = { ...prev };
          delete n[`${currentIndex}_0`];
          return n;
        });
      }, 600);
      setItemInventory((prev) => ({ ...prev, blankBreak: prev.blankBreak - 1 }));
      SFX.play('blankBreak');
      return;
    }
    const blankCount = (partial.match(/_____/g) || []).length;
    if (blankCount === 0) return;
    const blanks = blankAnswers[currentIndex] || [];
    const unsolved: number[] = [];
    for (let i = 0; i < blankCount; i++) {
      if (!String(blanks[i] || '').trim()) unsolved.push(i);
    }
    if (unsolved.length === 0) return;
    const blankIdx = unsolved[Math.floor(Math.random() * unsolved.length)];
    setBreakingBlanks((prev) => ({ ...prev, [`${currentIndex}_${blankIdx}`]: true }));
    setTimeout(() => {
      setBlankAnswers((prev) => {
        const next = prev.map((a) => [...a]);
        if (!next[currentIndex]) next[currentIndex] = [];
        next[currentIndex][blankIdx] = correct[blankIdx] || '';
        return next;
      });
      setBreakingBlanks((prev) => {
        const n = { ...prev };
        delete n[`${currentIndex}_${blankIdx}`];
        return n;
      });
    }, 600);
    setItemInventory((prev) => ({ ...prev, blankBreak: prev.blankBreak - 1 }));
    SFX.play('blankBreak');
  };

  const canUseAttackItems = isItemMode && selectedAttackItems.length > 0 && !showGameOver;

  const applyAttackPanelEffect = (botId: string, type: 'paint' | 'lightning' | 'scribble') => {
    const bot = currentBotViews.find((entry) => entry.id === botId);
    const problemIndex = bot?.currentProblem ?? currentIndex;
    setOpponentEffects((prev) => ({
      ...prev,
      [botId]: {
        ...(prev[botId] || {}),
        [problemIndex]: {
          ...(prev[botId]?.[problemIndex] || {}),
          panelEffect: { type, expiresAt: Date.now() + ITEM_PANEL_EFFECT_MS },
        },
      },
    }));
  };

  const runPanelCanvasEffect = (botId: string, type: 'paint' | 'scribble') => {
    const tryRun = (attempts = 0) => {
      const panelEl = document.querySelector(
        `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] .mini-code-lines`,
      );
      if (panelEl) {
        if (type === 'paint') startPaintCanvas(panelEl as HTMLElement, botId);
        else startScribbleCanvas(panelEl as HTMLElement, botId, ITEM_PANEL_EFFECT_MS);
        return;
      }
      if (attempts < 24) requestAnimationFrame(() => tryRun(attempts + 1));
    };
    tryRun();
  };

  const handleOpenItemModal = (botId: string) => {
    if (!canUseAttackItems) return;
    itemTargetBotIdRef.current = botId;
    setExpandedOpponentId(botId);
    setShowItemModal(true);
  };

  const handleCloseItemModal = () => {
    setShowItemModal(false);
    itemTargetBotIdRef.current = null;
  };

  const handleSelectItemType = (type: keyof ItemInventory) => {
    if (!canUseAttackItems || !selectedItemKeys.has(type)) return;
    if (itemInventory[type] <= 0) return;
    if (!ATTACK_ITEM_KEYS.includes(type) && !canUseItem(currentCaps, type)) return;
    const botId = itemTargetBotIdRef.current || expandedOpponentId;
    if (!botId) return;

    itemTargetBotIdRef.current = botId;
    setExpandedOpponentId(botId);
    setShowItemModal(false);
    SFX.play(type);
    setItemCastState({ type, ts: Date.now() });
    setTimeout(() => setItemCastState(null), 1500);

    if (type === 'paint' || type === 'lightning' || type === 'scribble') {
      setPanelHit((p) => ({ ...p, [botId]: true }));
      setTimeout(() => setPanelHit((p) => {
        const n = { ...p };
        delete n[botId];
        return n;
      }), 600);
    }

    if (type === 'paint') {
      applyAttackPanelEffect(botId, 'paint');
      runPanelCanvasEffect(botId, 'paint');
      setItemInventory((prev) => ({ ...prev, paint: prev.paint - 1 }));
    } else if (type === 'lightning') {
      applyAttackPanelEffect(botId, 'lightning');
      setItemInventory((prev) => ({ ...prev, lightning: prev.lightning - 1 }));
    } else if (type === 'timeReduce') {
      setRemaining((prev) => Math.max(0, prev - 15));
      setItemInventory((prev) => ({ ...prev, timeReduce: prev.timeReduce - 1 }));
    } else if (type === 'scribble') {
      applyAttackPanelEffect(botId, 'scribble');
      runPanelCanvasEffect(botId, 'scribble');
      setItemInventory((prev) => ({ ...prev, scribble: prev.scribble - 1 }));
    }

    itemTargetBotIdRef.current = null;
  };

  const handleSendChat = () => {
    if (!demoSpectating || !chatMsg.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setChatMessages((prev) => [...prev, { sender: getCurrentUserName(), text: chatMsg, time: timeStr }]);
    setChatMsg('');
  };

  const leaveBattle = () => {
    clearBattleAndLeave(sessionId, roomId);
    navigate(ROUTES.LOBBY);
  };

  const renderMiniStatus = (bot: BotView) => {
    const solvedCount = Math.min(bot.solvedProblems?.length || 0, totalProblems);
    const viewProblemIndex = demoSpectating
      ? resolveSpectatorViewProblemIndex(bot.id, bot.currentProblem, spectatorViewProblemByBot)
      : bot.currentProblem;

    return (
      <div className="mini-status-row">
        <div className="mini-status-top">
          <span>
            {solvedCount}/{totalProblems}
          </span>
          <span>{Math.round((solvedCount / Math.max(1, totalProblems)) * 100)}%</span>
        </div>
        <div className="mini-status-checks">
          {Array.from({ length: totalProblems }).map((_, idx) => {
            const checked = bot.solvedProblems?.includes(idx);
            const isActive = demoSpectating && viewProblemIndex === idx;
            return (
              <span
                key={`${bot.id}-mini-${idx}`}
                role={demoSpectating ? 'button' : undefined}
                className={`mini-problem-check${checked ? ' filled' : ''}${isActive ? ' active' : ''}${demoSpectating ? ' clickable' : ''}`}
                title={`${idx + 1}번 문제`}
                onClick={
                  demoSpectating
                    ? (e) => {
                        e.stopPropagation();
                        setSpectatorViewProblemByBot((prev) => ({ ...prev, [bot.id]: idx }));
                      }
                    : undefined
                }
              >
                {checked ? '✓' : demoSpectating ? idx + 1 : ''}
              </span>
            );
          })}
        </div>
        <div className="mini-status-gauge">
          <div
            className="mini-status-gauge-fill"
            style={{ width: `${(solvedCount / Math.max(1, totalProblems)) * 100}%` }}
          />
        </div>
      </div>
    );
  };

  const isLocked = demoSpectating || spectatorLocked || problemSolved;

  const myViewProblemIndex = demoSpectating ? (spectatorMyViewProblem ?? currentIndex) : currentIndex;
  const displayedProblem = useMemo(
    () => normalizeBattleProblem(problems[myViewProblemIndex] || ({} as BattleProblem)),
    [problems, myViewProblemIndex],
  );
  const displayedCaps = useMemo(
    () =>
      resolveProblemCapabilities(displayedProblem, {
        gameMode: isItemMode ? 'item' : 'normal',
      }),
    [displayedProblem, isItemMode],
  );
  const displayedShouldRenderVisual = displayedCaps.hasVisual || displayedCaps.hasImage;
  const displayedSelectedOption = demoSpectating
    ? (selectedOptionByProblem[myViewProblemIndex] ?? (myViewProblemIndex === currentIndex ? selectedOption : null))
    : selectedOption;
  const renderMySpectatorProblemTabs = () => (
    <div className="battle-my-problem-tabs">
      {Array.from({ length: totalProblems }).map((_, idx) => {
        const checked = localSolvedProblems.includes(idx);
        const isActive = myViewProblemIndex === idx;
        return (
          <span
            key={`me-problem-${idx}`}
            role="button"
            className={`mini-problem-check${checked ? ' filled' : ''}${isActive ? ' active' : ''} clickable`}
            title={`${idx + 1}번 문제`}
            onClick={() => setSpectatorMyViewProblem(idx)}
          >
            {checked ? '✓' : idx + 1}
          </span>
        );
      })}
    </div>
  );

  const activeProblem = demoSpectating ? displayedProblem : currentProblem;
  const activeCaps = demoSpectating ? displayedCaps : currentCaps;
  const activeProblemIndex = demoSpectating ? myViewProblemIndex : currentIndex;
  const activeSelectedOption = demoSpectating ? displayedSelectedOption : selectedOption;
  const activeLocked = demoSpectating || isLocked;
  const activeShouldRenderVisual = demoSpectating ? displayedShouldRenderVisual : shouldRenderProblemVisual;

  const battleActionBar = (
    <div className="battle-action-bar">
      {!problemSolved ? (
        <button
          type="button"
          className="pixel-btn pixel-btn-success"
          onClick={handleSubmit}
          style={{ padding: '4px 10px', fontSize: '14px' }}
          disabled={demoSpectating || spectatorLocked}
        >
          {demoSpectating || spectatorLocked ? 'LOCKED' : '제출'}
        </button>
      ) : (
        <button
          type="button"
          className="pixel-btn pixel-btn-success"
          onClick={handleAdvance}
          style={{ padding: '4px 10px', fontSize: '14px' }}
          disabled={
            (demoSpectating || spectatorLocked) && currentIndex >= problems.length - 1
          }
        >
          {currentIndex >= problems.length - 1
            ? demoSpectating || spectatorLocked
              ? '제출 완료'
              : '최종 제출'
            : '다음 문제'}
        </button>
      )}
      <button type="button" className="pixel-btn pixel-btn-danger" onClick={leaveBattle} style={{ padding: '4px 10px', fontSize: '14px' }}>
        나가기
      </button>
    </div>
  );

  const mainColumn = (
    <div className={`battle-main-column${demoSpectating ? ' is-spectator-my' : ''}`}>
      <div className={`pixel-card code-card${itemCastState ? ' casting-item' : ''}`} style={{ position: 'relative' }}>
              <div className="pixel-card-header code-card-header-centered">
                <div className="code-card-header-center">
                  <span style={{ color: 'var(--px-primary)' }}>MY CODE</span>
                  <span className="code-card-lang-badge">{langLabel}</span>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="code-card-progress-text">
                    {demoSpectating ? `${myViewProblemIndex + 1}/${totalProblems}` : problemProgressText}
                  </span>
                </div>
              </div>
              {demoSpectating && renderMySpectatorProblemTabs()}
              {isItemMode && selectedSelfItems.length > 0 && !demoSpectating && (
              <div className="battle-status-bar">
                <div className="battle-self-items-row">
                    <span className="battle-self-items-label">내 아이템:</span>
                    {selectedSelfItems.map((type) => {
                      const meta = SELF_ITEM_META[type] || { icon: '?', name: type };
                      const disabled = !canUseItem(currentCaps, type) || itemInventory[type] <= 0;
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`battle-self-item-btn${itemInventory[type] <= 0 ? ' is-zero' : ''}`}
                          onClick={() => handleUseSelfItem(type)}
                          disabled={disabled}
                        >
                          {meta.icon} {meta.name} ({itemInventory[type]})
                        </button>
                      );
                    })}
                </div>
              </div>
              )}
              {revealHint && !demoSpectating && (
                <div className="battle-item-hint-banner">
                  💡 힌트: {revealHint}
                </div>
              )}
              <div key={`problem-summary-${activeProblemIndex}`} className="code-problem-summary">
                <div className="code-problem-copy">
                  <div className="code-problem-kicker">PROBLEM</div>
                  <div className="code-problem-title">{activeProblem.title || 'Loading...'}</div>
                  {!demoSpectating && !activeCaps.showCodePanel && (
                    <div className="code-problem-question">{activeProblem.question || ''}</div>
                  )}
                  {!demoSpectating && activeShouldRenderVisual && !activeCaps.showCodePanel && (
                    <ProblemVisualPreview visual={activeProblem.visual} compact />
                  )}
                </div>
              </div>
              {activeCaps.showCodePanel && (
                <>
                  <div className="fill-blank-area">
                    {activeShouldRenderVisual && (
                      <ProblemVisualPreview visual={activeProblem.visual} />
                    )}
                    <div className="fill-blank-code">
                      <FillBlankRenderer
                        code={activeProblem.question || ''}
                        answers={blankAnswers[activeProblemIndex] || []}
                        problemIndex={activeProblemIndex}
                        breakingBlanks={breakingBlanks}
                        isLocked={activeLocked}
                        onUpdate={demoSpectating ? undefined : (i, v) => updateBlankAnswer(activeProblemIndex, i, v)}
                      />
                    </div>
                  </div>
                  {!demoSpectating && showBuildPanel && (
                  <BattleBuildPanel
                    code={currentBuildCode}
                    lang={langKey}
                    langLabel={langLabel}
                    buildsUsed={buildsUsed}
                    buildsAllowed={buildsAllowed}
                    isBuilding={isBuilding}
                    logs={currentBuildLogs}
                    collapsed={buildPanelCollapsed}
                    disabled={demoSpectating || spectatorLocked || problemSolved}
                    onCodeChange={handleBuildCodeChange}
                    onBuild={handleBattleBuild}
                    onToggleCollapse={() => setBuildPanelCollapsed((v) => !v)}
                  />
                  )}
                </>
              )}
              {activeCaps.showMultipleChoicePanel && (
                <div className="fill-blank-area fill-blank-area-answers">
                  {demoSpectating && (
                    <>
                      <div className="code-problem-question">{activeProblem.question || ''}</div>
                      {activeShouldRenderVisual && (
                        <ProblemVisualPreview
                          visual={activeProblem.visual}
                          compact
                          suppressCaption={Boolean(activeProblem.question)}
                        />
                      )}
                    </>
                  )}
                  {(activeProblem.options || []).map((opt, i) => {
                    const isSelected = activeSelectedOption === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`pixel-btn battle-choice-btn${activeLocked ? ' is-locked' : ''}${isSelected ? ' is-selected' : ''}`}
                        onClick={() => selectChoice(i)}
                        disabled={activeLocked}
                        style={{
                          opacity: activeLocked && !isSelected ? 0.55 : 1,
                        }}
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {activeCaps.showShortAnswerPanel && (
                <div className="fill-blank-area fill-blank-area-answers">
                  {demoSpectating && (
                    <>
                      <div className="code-problem-question">{activeProblem.question || ''}</div>
                      {activeShouldRenderVisual && (
                        <ProblemVisualPreview
                          visual={activeProblem.visual}
                          compact
                          suppressCaption={Boolean(activeProblem.question)}
                        />
                      )}
                    </>
                  )}
                  <input
                    className="blank-input battle-short-input"
                    value={blankAnswers[activeProblemIndex]?.[0] || ''}
                    onChange={(e) => updateBlankAnswer(activeProblemIndex, 0, e.target.value)}
                    disabled={activeLocked}
                    readOnly={demoSpectating}
                  />
                </div>
              )}
            </div>
            {demoSpectating && !showSaveModal && !showClearFlash && !showGameOver && (
              <div className="battle-spectator-footer">
                <BattleChatPanel
                  messages={chatMessages}
                  chatMsg={chatMsg}
                  onMsgChange={setChatMsg}
                  onSend={handleSendChat}
                />
                {battleActionBar}
              </div>
            )}
    </div>
  );

  const opponentColumn = (
    <div className={`battle-opponent-column${demoSpectating ? ' is-spectator-side' : ''}`}>
            <div className="opponent-timer-strip" style={{ height: 119, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
                  <div className="opponent-timer-kicker">TIME LEFT</div>
                  <div className="opponent-timer-detail">전체 제한 {formatTime(totalBattleSeconds)}</div>
                </div>
                <div className="opponent-timer-clock" style={{ fontSize: 36 }}>
                  {formatTime(remaining)}
                </div>
              </div>
            </div>
            <div
              className={`opponent-panels-container ${!expandedOpponentId && battleBots.length >= 5 ? 'two-cols' : ''} count-${battleBots.length} ${expandedOpponentId ? 'expanded-mode' : ''}`}
            >
              <OpponentPanels
                battleBots={currentBotViews}
                expandedOpponentId={expandedOpponentId}
                setExpandedOpponentId={setExpandedOpponentId}
                demoIsVersusMany={demoIsVersusMany}
                demoSpectating={demoSpectating}
                currentIndex={currentIndex}
                problems={problems}
                currentProblem={currentProblem}
                isItemMode={isItemMode}
                langKey={langKey}
                spectatorViewProblemByBot={spectatorViewProblemByBot}
                opponentEffects={opponentEffects}
                panelHit={panelHit}
                onOpenItemModal={handleOpenItemModal}
                showItemButton={canUseAttackItems}
                renderMiniStatus={renderMiniStatus}
              />
            </div>
      {!demoSpectating && battleActionBar}
    </div>
  );

  return (
    <div className="page-container battle-page">
      <div className="battle-layout">
        <div className="battle-workspace">
          {demoSpectating ? (
            <>
              {opponentColumn}
              {mainColumn}
            </>
          ) : (
            <>
              {mainColumn}
              {opponentColumn}
            </>
          )}
        </div>
      </div>

      {showSaveModal && (
        <div className="game-over-overlay" style={{ zIndex: 3100 }}>
          <div className="game-over-box" style={{ maxWidth: '520px', borderColor: 'var(--px-warning)' }}>
            <div className="game-over-text" style={{ fontSize: '26px', color: 'var(--px-warning)' }}>
              저장할까요?
            </div>
            <div className="game-over-sub" style={{ marginBottom: '18px' }}>
              코드를 저장하고 관전모드로 전환합니다.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button type="button" className="pixel-btn pixel-btn-success" onClick={finalizeSaveAndSpectate}>
                저장 후 관전
              </button>
              <button type="button" className="pixel-btn pixel-btn-secondary" onClick={() => setShowSaveModal(false)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearFlash && (
        <div className="game-over-overlay clear-overlay">
          <div className="game-over-box">
            <div className="game-over-text">CLEAR</div>
            <div className="game-over-sub">관전모드에 진입했습니다</div>
          </div>
        </div>
      )}

      {showGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-box">
            <div className="game-over-text">GAME OVER</div>
            <div className="game-over-sub">잠시 후 결과 페이지로 이동합니다...</div>
          </div>
        </div>
      )}

      {showItemModal && isItemMode && (
        <ItemSelectModal
          inventory={itemInventory}
          allowedTypes={allowedAttackItems}
          onSelect={handleSelectItemType}
          onClose={handleCloseItemModal}
        />
      )}

      <RoomAlertModal
        open={showAnswerRequiredModal}
        message="문제를 풀어주세요."
        onClose={() => setShowAnswerRequiredModal(false)}
      />
    </div>
  );
}
