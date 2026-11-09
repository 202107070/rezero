import { useServerDownChat } from '../../hooks/useServerDownChat';
import { watchMatchCompletion } from '../../services/matchCompletionWatcher';
import { getCurrentUserId, getCurrentUserName } from '../../services/authService';
import { ApiError } from '../../services/apiClient';
import { acknowledgeServerDraft, closeDraftWriter, loadServerDraft, preserveDraft, readLocalDraft, rememberDraft, saveDraftOnPageHide } from '../../services/battleDraftClient';
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
import { getBattleProblems, getBattleSettings, setBattleSettings } from '../../services/sessionStore';
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
import {
  isAlreadySubmittedError,
  getMatchErrorMessage,
  fetchActiveMatch,
  fetchMatchPending,
  activateMatchRevise,
  submitMatchAnswer,
  submitMatchResult,
  useMatchItem,
} from '../../services/matchService';
import {
  emitBattleItemUsed,
  joinRoomSocket,
  setActiveRoomId,
  onRoomEvent,
  createChatMessageId,
  sendRoomMessage,
  ROOM_SOCKET_EVENTS,
  type BattleGameEndedPayload,
  type BattleItemUsedPayload,
  type MatchResultPendingPayload,
  type ChatMessagePayload,
  type GameStateUpdatePayload,
  type UserReconnectedPayload,
} from '../../services/roomSocket';
import { blockAutoRejoin, clearAutoRejoinBlock, isAutoRejoinBlocked, leaveRoom, getRoomErrorMessage } from '../../services/roomService';
import { markLobbyChatReset } from '../../services/lobbyChatStore';
import { getItemInventory, getRatingScore, setItemInventory as persistItemInventory } from '../../services/userService';
import { emitUpdateLocation } from '../../services/roomSocket';
import { collectSolvedProblemKeys, isPreviouslySolvedProblem } from '../../utils/codeHistoryUtils';
import type { BattleProblem, ItemInventory, RoomUser } from '../../types/battle';
import { BattleBGM, LobbyBGM, SFX } from '../../utils/audio/gameAudio';
import {
  type ActivePanelEffects,
  type AttackPanelType,
  createEmptyPanelEffects,
  enqueuePanelEffect,
  isPanelTypeActive,
  prunePanelEffects,
} from '../../utils/battle/panelEffects';
import {
  computeBotRankScore,
  buildRankingSnapshotFromRoomUsers,
  getBotRankMetrics,
  getUserRankMetrics,
} from '../../utils/battle/rankUtils';
import {
  applyScribbleStroke,
  clearPaintCanvas,
  clearScribbleCanvas,
  getScribbleOnStroke,
  isScribbleInteractive,
  startPaintCanvas,
  startScribbleCanvas,
  type ScribbleStroke,
} from '../../utils/battle/canvasEffects';
import { ExitConfirmModal } from '../../components/lobby/ExitConfirmModal/ExitConfirmModal';
import { assembleCode, buildPreviewSource, DEFAULT_TEMPLATE, getLangKey, getLangLabel, getTotalBattleSeconds } from '../../utils/battle/codeUtils';
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
import { runCodeBuild, type BuildLogLine } from '../../services/buildExecutionClient';
import {
  getProblemAnswersForLang,
  isCodeBlankBuildProblem,
  isUserBlankFilled,
} from '../../utils/problemTypeUtils';
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
  const [battleMeta, setBattleMeta] = useState<Record<string, unknown>>(() => getBattleSettings());
  const matchId = params.get('matchId') || String(battleMeta.matchId || '');
  const isLiveMatch = Boolean(matchId);
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
  const lang = String(battleMeta.language || params.get('lang') || 'JAVA');
  const langKey = getLangKey(lang);
  const langLabel = getLangLabel(langKey);
  const templateCode = DEFAULT_TEMPLATE[langKey] || DEFAULT_TEMPLATE.JAVA;
  const sessionId = getSessionId(roomId, matchId);
  const demoIsVersusMany = roomMode !== '1/1';

  const [problems, setProblems] = useState<BattleProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const totalBattleSeconds = useMemo(() => {
    const fromMatch = Number(battleMeta.roundSeconds);
    if (Number.isInteger(fromMatch) && fromMatch > 0) return fromMatch;
    return getTotalBattleSeconds(battleDiff, Math.max(1, problems.length || parseInt(battleCount, 10) || 5));
  }, [battleMeta.roundSeconds, battleDiff, problems.length, battleCount]);
  const [remaining, setRemaining] = useState(() => {
    const fromMatch = Number(battleMeta.roundSeconds);
    if (Number.isInteger(fromMatch) && fromMatch > 0) return fromMatch;
    return getTotalBattleSeconds(battleDiff, Math.max(1, parseInt(battleCount, 10) || 5));
  });
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [finalSubmitKind, setFinalSubmitKind] = useState<'spectate' | 'result'>('spectate');
  const [showResultLeavingModal, setShowResultLeavingModal] = useState(false);
  const [pendingResultUserIds, setPendingResultUserIds] = useState<string[]>([]);
  const [showReviseAskModal, setShowReviseAskModal] = useState(false);
  const [showReviseSelectModal, setShowReviseSelectModal] = useState(false);
  const [showReviseHint, setShowReviseHint] = useState(false);
  const [revisionEditMode, setRevisionEditMode] = useState(false);
  const [selectedReviseProblems, setSelectedReviseProblems] = useState<number[]>([]);
  const [showClearFlash, setShowClearFlash] = useState(false);
  const [demoSpectating, setDemoSpectating] = useState(false);
  const [spectatorLocked, setSpectatorLocked] = useState(false);
  const [battleFinished, setBattleFinished] = useState(false);
  const [battleBots, setBattleBots] = useState<DemoBot[]>([]);
  const battleBotsRef = useRef<DemoBot[]>([]);
  const departedUserIdsRef = useRef<Set<string>>(new Set());
  const leavingToLobbyRef = useRef(false);
  useEffect(() => {
    battleBotsRef.current = battleBots;
  }, [battleBots]);
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
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealHint, setRevealHint] = useState<string | null>(null);
  const [showAnswerRequiredModal, setShowAnswerRequiredModal] = useState(false);
  const [leaveAlertMessage, setLeaveAlertMessage] = useState('');
  const [breakingBlanks, setBreakingBlanks] = useState<Record<string, boolean>>({});
  const [itemCastState, setItemCastState] = useState<{ type: string; ts: number } | null>(null);
  const [panelHit, setPanelHit] = useState<Record<string, boolean>>({});
  /** 번개 CSS 애니메이션 재시작용 (클래스 한 프레임 제거) */
  const [lightningAnimSuppress, setLightningAnimSuppress] = useState<Record<string, boolean>>({});
  const timeoutSpectateRef = useRef(false);
  const [timeoutSpectateRequest, setTimeoutSpectateRequest] = useState(false);

  const bumpLightningAnim = useCallback((targetId: string) => {
    setLightningAnimSuppress((prev) => ({ ...prev, [targetId]: true }));
    requestAnimationFrame(() => {
      setLightningAnimSuppress((prev) => {
        if (!prev[targetId]) return prev;
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
    });
  }, []);
  const [selfPanelEffects, setSelfPanelEffects] = useState<ActivePanelEffects>(() =>
    createEmptyPanelEffects(),
  );
  const [showItemModal, setShowItemModal] = useState(false);
  const [opponentEffects, setOpponentEffects] = useState<Record<string, ActivePanelEffects>>({});
  const problemStartedAtElapsedRef = useRef(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [itemInventory, setItemInventory] = useState<ItemInventory>(() => getItemInventory());
  const [sessionSavedSnapshot, setSessionSavedSnapshot] = useState('');
  const [, setSaveStatus] = useState<'saving' | 'saved' | 'unsaved'>('saved');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: 'SYSTEM', text: '배틀 시작! 서로 화이팅 하세요.', time: '' },
  ]);
  useServerDownChat((text) => {
    setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text, time: '' }]);
  });
  const [chatMsg, setChatMsg] = useState('');
  const [buildCodeByProblem, setBuildCodeByProblem] = useState<Record<number, string>>({});
  const [buildLogsByProblem, setBuildLogsByProblem] = useState<Record<number, BuildLogLine[]>>({});
  const [buildsUsedByProblem, setBuildsUsedByProblem] = useState<Record<number, number>>({});
  const [buildBonusByProblem, setBuildBonusByProblem] = useState<Record<number, number>>({});
  const [buildPanelCollapsed, setBuildPanelCollapsed] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const assembledBuildCodeRef = useRef('');
  const buildTokenRef = useRef(0);
  const advanceQueuedRef = useRef(false);
  const itemTargetBotIdRef = useRef<string | null>(null);
  const gameOverNavRef = useRef(false);
  const saveModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSessionLoadedRef = useRef(false);
  const [sessionReady, setSessionReady] = useState(!isLiveMatch);
  const liveDeadlineRef = useRef(0);
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;
  const initialSessionSaveQueuedRef = useRef(false);
  const lastTimedPersistRemainingRef = useRef(-1);
  const itemInventoryInitialized = useRef(false);
  const answerSubmittingRef = useRef(false);
  const matchResultSubmittedRef = useRef(false);
  const leavingToResultRef = useRef(false);
  const resultLeavingNavRef = useRef(false);

  const currentProblem = useMemo(
    () => normalizeBattleProblem(problems[currentIndex] || ({} as BattleProblem)),
    [problems, currentIndex],
  );
  const solvedProblemKeys = useMemo(() => collectSolvedProblemKeys(), []);
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
  const allProblemsSubmitted = spectatorLocked || demoSpectating || battleFinished;
  const problemProgressText = hasProblems
    ? `${allProblemsSubmitted ? totalProblems : currentProblemNumber}/${totalProblems}`
    : '0/1';
  const progressPercent = hasProblems
    ? ((allProblemsSubmitted ? totalProblems : currentProblemNumber) / totalProblems) * 100
    : 0;

  const finalizedProblemResults = useMemo(() => {
    problemResultsRef.current = problemResults;
    return finalizeProblemResults(problemResults, totalProblems);
  }, [problemResults, totalProblems]);

  const markProblemWrong = useCallback((problemIndex: number) => {
    setProblemResults((prev) => (prev[problemIndex] !== undefined ? prev : { ...prev, [problemIndex]: false }));
    setProblemSolved(true);
  }, []);

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

  const buildLangKey = getLangKey(langKey);
  const buildLangLabel = getLangLabel(buildLangKey);
  const showBuildPanel = currentCaps.showCodePanel && Boolean(currentProblem?.executionKind || (!isLiveMatch && isCodeBlankBuildProblem(currentProblem, buildLangKey)));
  const buildsAllowed = BATTLE_BUILD_LIMIT + (buildBonusByProblem[currentIndex] || 0);
  const buildsUsed = buildsUsedByProblem[currentIndex] || 0;
  const currentBuildCode = buildCodeByProblem[currentIndex] ?? '';
  const currentBuildLogs = buildLogsByProblem[currentIndex] || [];

  useEffect(() => {
    if (!showBuildPanel || !currentProblem) return;
    const assembled = buildPreviewSource(
      currentProblem.question || '',
      blankAnswers[currentIndex] || [],
      buildLangKey,
    );
    assembledBuildCodeRef.current = assembled;
    setBuildCodeByProblem((prev) => ({ ...prev, [currentIndex]: assembled }));
  }, [showBuildPanel, currentIndex, currentProblem, blankAnswers, buildLangKey]);

  useEffect(() => {
    assembledBuildCodeRef.current = '';
    buildTokenRef.current += 1;
    setIsBuilding(false);
    return () => { buildTokenRef.current += 1; };
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

    const token = ++buildTokenRef.current;
    const cancelled = () => token !== buildTokenRef.current;
    setIsBuilding(true);
    setBuildLogsByProblem((prev) => ({ ...prev, [currentIndex]: [] }));

    const code = buildCodeByProblem[currentIndex] ?? assembledBuildCodeRef.current;
    const appendLog = (line: BuildLogLine) => {
      if (cancelled()) return;
      setBuildLogsByProblem((prev) => ({
        ...prev,
        [currentIndex]: [...(prev[currentIndex] || []), line],
      }));
    };

    try {
      const result = await runCodeBuild(code, buildLangKey, appendLog, { cancelled }, isLiveMatch ? { matchId, problemIndex: currentIndex } : undefined);
      if (result && isLiveMatch) {
        setBuildsUsedByProblem(prev => ({ ...prev, [currentIndex]: Math.max(prev[currentIndex] || 0, result.buildsUsed) }));
        setBuildBonusByProblem(prev => ({ ...prev, [currentIndex]: Math.max(prev[currentIndex] || 0, result.buildsAllowed - BATTLE_BUILD_LIMIT) }));
      }
    } finally {
      if (!cancelled()) setIsBuilding(false);
    }
  }, [
    showBuildPanel,
    isLiveMatch,
    matchId,
    isBuilding,
    buildsUsed,
    buildsAllowed,
    currentIndex,
    buildCodeByProblem,
    buildLangKey,
  ]);

  const selectedDemoBot = battleBots[0] || null;
  const selectedDemoBotCode = selectedDemoBot?.codeByProblem?.[currentIndex] || '// 상대 코드가 아직 없습니다.';

  const currentBotViews: BotView[] = useMemo(() => {
    return battleBots.map((bot) => {
      const solvedProblems = isLiveMatch
        ? Array.isArray(bot.solvedProblems)
          ? bot.solvedProblems
          : []
        : getBotSolvedProblemsFromElapsed(bot, elapsedSec, totalBattleSeconds, totalProblems);
      const botCurrentProblem = isLiveMatch
        ? Math.min(solvedProblems.length, Math.max(0, totalProblems - 1))
        : getBotWorkingProblemIndexFromElapsed(bot, elapsedSec, totalBattleSeconds, totalProblems);
      const schedule = getBotSchedule(bot, botCurrentProblem);
      const currentProblemSolved = isLiveMatch
        ? solvedProblems.includes(botCurrentProblem) && solvedProblems.length > botCurrentProblem
        : isBotProblemSolvedByElapsed(bot, botCurrentProblem, elapsedSec, totalBattleSeconds);
      const allDone = totalProblems > 0 && solvedProblems.length >= totalProblems;
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
  }, [battleBots, elapsedSec, totalBattleSeconds, demoSpectating, totalProblems, isLiveMatch]);

  const roomUsers: RoomUser[] = useMemo(() => {
    const meMetrics = getUserRankMetrics(localSolvedProblems, solveTimes, finishedAtElapsedSec);
    const myId = String(getCurrentUserId() || '');
    const roster = Array.isArray(roomRoster)
      ? (roomRoster as Array<{ userId?: string; character?: string }>)
      : [];
    const myCharacter =
      roster.find((player) => String(player.userId || '') === myId)?.character || 'char1';
    return [
      {
        id: 'me',
        name: getCurrentUserName(),
        avatar: myCharacter,
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
    roomRoster,
  ]);

  const doPersistSession = useCallback(
    async (nextAnswers: string[], shouldCommit = false) => {
      if (!initialSessionLoadedRef.current || problems.length === 0 || battleFinished || leavingToLobbyRef.current || demoSpectating || spectatorLocked) return;
      await persistBattleSession({
        sessionId,
        matchId: matchId || undefined,
        roomId,
        langKey,
        currentIndex,
        remaining: remainingRef.current,
        answers: nextAnswers,
        blankAnswers,
        selectedOptions: selectedOptionByProblem,
        solveTimes,
        buildsUsed: buildsUsedByProblem,
        selectedItemKeys: Array.from(selectedItemKeys),
        problemStartedAtElapsed: problemStartedAtElapsedRef.current,
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
    [sessionId, matchId, roomId, langKey, currentIndex, problems, sessionSavedSnapshot, blankAnswers, selectedOptionByProblem, solveTimes, buildsUsedByProblem, selectedItemKeys, battleFinished, demoSpectating, spectatorLocked],
  );

  const doPersistSubmission = useCallback(
    (nextAnswers: string[], nextProblemIndex = currentIndex) => {
      persistBattleSubmission({
        roomId,
        sessionId,
        matchId,
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
      matchId,
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

  const returnFromAbandonedMatch = useCallback((canReturnToRoom: boolean) => {
    if (leavingToLobbyRef.current || resultLeavingNavRef.current || isAutoRejoinBlocked(roomId)) return;
    resultLeavingNavRef.current = true;
    clearBattleAndLeave(sessionId, roomId);
    if (canReturnToRoom && roomId) {
      navigate(`${ROUTES.ROOM}?id=${roomId}`, { replace: true });
    } else {
      setActiveRoomId(null);
      navigate(ROUTES.LOBBY, { replace: true });
    }
  }, [navigate, roomId, sessionId]);

  useEffect(() => {
    if (isLiveMatch) {
      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | undefined;
      const userId = getCurrentUserId();
      async function restoreLive(attempt = 0) {
        try {
          const result = await loadServerDraft(matchId);
          if (cancelled) return;
          if (result.match.status !== 'IN_PROGRESS') {
            navigate(`${ROUTES.RESULT}?roomId=${roomId}&matchId=${encodeURIComponent(matchId)}`, { replace: true });
            return;
          }
          const local = readLocalDraft(userId, matchId);
          if (result.draft) acknowledgeServerDraft(userId, matchId, result.draft.version);
          const draft = local && local.version > (result.draft?.version || 0) ? local : result.draft;
          if (draft && draft === result.draft) rememberDraft(userId, { ...draft, localSavedAt: Date.now(), remaining: result.remainingSeconds });
          const loadedProblems = normalizeBattleProblems(result.match.problems);
          if (loadedProblems.length === 0) throw new Error('경기 문제를 불러오지 못했습니다.');
          const index = Math.max(0, Math.min(draft?.currentIndex || 0, loadedProblems.length - 1));
          const blanks = loadedProblems.map((_, i) => draft?.blankAnswers?.[i] || []);
          const selections = { ...draft?.selectedOptions };
          const submitted: ProblemResultsMap = {};
          for (const row of result.progress.submissions) {
            submitted[row.index] = row.isCorrect;
            blanks[row.index] = row.answers;
            if (row.selectedOption !== null) selections[row.index] = row.selectedOption;
          }
          setProblems(loadedProblems);
          setAnswers(draft?.codes || loadedProblems.map(p => assembleCode(p.question || '', [])));
          setBlankAnswers(blanks);
          setSelectedOptionByProblem(selections);
          setSelectedOption(selections[index] ?? null);
          setCurrentIndex(index);
          setProblemResults(submitted);
          setLocalSolvedProblems(Object.entries(submitted).filter(([, correct]) => correct).map(([i]) => Number(i)));
          setProblemSolved(submitted[index] !== undefined);
          setIngameScore(result.progress.score);
          setSolveTimes(draft?.solveTimes || {});
          problemStartedAtElapsedRef.current = draft?.problemStartedAtElapsed ?? Object.values(draft?.solveTimes || {}).reduce((sum, value) => sum + value, 0);
          setBuildsUsedByProblem(Object.fromEntries(Object.entries(result.buildState.used).map(([key, value]) => [key, Number(value)])));
          setBuildBonusByProblem(Object.fromEntries(Object.entries(result.buildState.bonus).map(([key, value]) => [key, Number(value)])));
          if (result.progress.finished) {
            matchResultSubmittedRef.current = true;
            setDemoSpectating(true);
            setSpectatorLocked(true);
          }
          const localRemaining = local && draft === local ? Math.max(0, local.remaining - Math.floor((Date.now() - local.localSavedAt) / 1000)) : result.remainingSeconds;
          const restoredRemaining = Math.min(result.remainingSeconds, localRemaining);
          liveDeadlineRef.current = Date.now() + restoredRemaining * 1000;
          setRemaining(restoredRemaining);
          setElapsedSec(Math.max(0, result.match.roundSeconds - result.remainingSeconds));
          const previousSettings = getBattleSettings();
          const metadata = {
            ...previousSettings,
            ...result.match,
            diff: result.match.difficulty,
            count: String(result.match.problemCount),
            selectedItems: draft?.selectedItemKeys ?? (previousSettings.matchId === matchId ? previousSettings.selectedItems : []),
            roomRoster: result.roomRoster,
            opponentProgress: result.opponentProgress,
          };
          setBattleSettings(metadata);
          setBattleMeta(metadata);
          setSessionSavedSnapshot((draft?.codes || []).join('||'));
          initialSessionLoadedRef.current = true;
          initialSessionSaveQueuedRef.current = false;
          setSessionReady(true);
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && [403, 404].includes(error.status)) {
            const pending = await fetchMatchPending(matchId, { background: true }).catch(() => null);
            if (cancelled) return;
            if (pending?.resultReady) {
              navigate(`${ROUTES.RESULT}?roomId=${roomId}&matchId=${encodeURIComponent(matchId)}`, { replace: true });
            } else {
              returnFromAbandonedMatch(pending?.canReturnToRoom === true);
            }
          } else if (attempt < 2) {
            retryTimer = setTimeout(() => { void restoreLive(attempt + 1); }, 1500);
          } else {
            setLeaveAlertMessage('경기 정보를 복구하는 중입니다. 연결 상태를 확인한 뒤 새로고침해 주세요. 작성한 답안은 임시 보관됩니다.');
          }
        }
      }
      void restoreLive();
      return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
    }
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
  }, [isLiveMatch, matchId, roomId, returnFromAbandonedMatch]);

  function setIsEditedFalse() {
    setSaveStatus('saved');
  }

  useEffect(() => {
    if (problems.length === 0) return;
    setBlankAnswers((prev) => {
      if (prev.length === problems.length && prev.some((row) => (row || []).some((cell) => String(cell || '').trim()))) {
        return prev;
      }
      if (prev.length === problems.length) return prev;
      return Array.from({ length: problems.length }, (_, index) => prev[index] || []);
    });
  }, [problems.length]);

  useEffect(() => {
    if (problems.length === 0) return;
    const nextAnswers = problems.map((p, i) => assembleCode(p.question || '', blankAnswers[i] || []));
    setAnswers(nextAnswers);
  }, [blankAnswers, problems]);

  useEffect(() => {
    if (problems.length === 0) return;
    const myId = getCurrentUserId();
    const isDepartedBot = (botId: string) => {
      const raw = String(botId || '').replace(/^player-/, '');
      return departedUserIdsRef.current.has(raw) || departedUserIdsRef.current.has(String(botId));
    };
    const roster = createDemoBattleRoster({
      sessionId,
      roomMode,
      maxPlayers: maxPlayersParam,
      langKey,
      problems,
      roundSeconds: totalBattleSeconds,
      roomRoster: roomRoster as Array<{ id: number; name: string; character: string; isHost: boolean; userId?: string }>,
      myUserId: myId || undefined,
    }).filter((bot) => !isDepartedBot(bot.id));
    if (isLiveMatch) {
      const progress = battleMeta.opponentProgress as Array<{ userId: string; score: number; submittedProblems: number[]; finished: boolean }> | undefined;
      const restoreProgress = (bot: DemoBot): DemoBot => {
        const saved = progress?.find(player => bot.id === `player-${player.userId}` || bot.id === player.userId);
        return saved ? { ...bot, score: saved.score, solvedProblems: saved.submittedProblems, status: saved.finished ? 'solved' : 'playing' } : bot;
      };
      setBattleBots((prev) => {
        const alive = prev.filter((bot) => !isDepartedBot(bot.id));
        // 이미 구성된 상대 목록이 있으면 진행률을 유지한 채 이름/캐릭터만 갱신
        if (alive.length > 0) {
          return alive.map((existing) => {
            const bot = restoreProgress(existing);
            const next = roster.find((item) => item.id === bot.id);
            if (!next) return bot;
            return {
              ...bot,
              name: next.name || bot.name,
              avatar: next.avatar || bot.avatar,
              rank: next.rank || bot.rank,
              solveScheduleByProblem: problems.map(() => -1),
            };
          });
        }
        return roster.map((bot) => restoreProgress({
          ...bot,
          solvedProblems: [],
          solveScheduleByProblem: problems.map(() => -1),
          status: 'playing',
        }));
      });
      return;
    }
    setBattleBots(roster);
  }, [problems.length, sessionId, roomMode, maxPlayersParam, langKey, totalBattleSeconds, roomRoster, isLiveMatch, problems, battleMeta.opponentProgress]);

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
    if (battleFinished || !sessionReady) return;
    const timer = setInterval(() => {
      setRemaining((prev) => isLiveMatch
        ? Math.max(0, Math.ceil((liveDeadlineRef.current - Date.now()) / 1000))
        : Math.max(0, prev - 1));
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [battleFinished, sessionReady, isLiveMatch]);

  useEffect(() => {
    LobbyBGM.stop();
    BattleBGM.stop();
    return () => BattleBGM.stop();
  }, []);

  useEffect(() => {
    void emitUpdateLocation({
      location: 'battle',
      roomId: String(roomId || ''),
      roomTitle: roomId ? `${roomId}번 방` : '',
      ratingScore: getRatingScore(),
    }).catch(() => undefined);
  }, [roomId]);

  useEffect(() => {
    if (battleFinished) BattleBGM.stop();
  }, [battleFinished]);

  useEffect(() => {
    setRevealHint(null);
  }, [currentIndex]);

  useEffect(() => {
    const restartSelfCanvas = (type: AttackPanelType) => {
      if (type !== 'paint' && type !== 'scribble') return;
      const tryRun = (attempts = 0) => {
        const panelEl = document.querySelector(
          '.code-card .fill-blank-code, .code-card .fill-blank-area, .code-card',
        ) as HTMLElement | null;
        if (panelEl) {
          if (type === 'paint') {
            startPaintCanvas(panelEl, 'self');
            return;
          }
          if (
            startScribbleCanvas(panelEl, 'self', ITEM_PANEL_EFFECT_MS, {
              interactive: isScribbleInteractive('self'),
              onStroke: getScribbleOnStroke('self'),
              extendDuration: false,
            })
          ) {
            return;
          }
        }
        if (attempts < 40) requestAnimationFrame(() => tryRun(attempts + 1));
      };
      tryRun();
    };

    const restartOpponentCanvas = (botId: string, type: AttackPanelType) => {
      if (type !== 'paint' && type !== 'scribble') return;
      const tryRun = (attempts = 0) => {
        const panelEl = (document.querySelector(
          `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] [data-opponent-canvas="${botId}"]`,
        ) ||
          document.querySelector(`[data-opponent-canvas="${botId}"]`) ||
          document.querySelector(
            `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] .mini-code-area`,
          )) as HTMLElement | null;
        if (panelEl) {
          if (type === 'paint') {
            startPaintCanvas(panelEl, botId);
            return;
          }
          // 큐 재시작: 로컬 그리기 유지, 지속시간은 이미 중첩되어 있으므로 연장하지 않음
          if (
            startScribbleCanvas(panelEl, botId, ITEM_PANEL_EFFECT_MS, {
              interactive: isScribbleInteractive(botId),
              onStroke: getScribbleOnStroke(botId),
              extendDuration: false,
            })
          ) {
            return;
          }
        }
        if (attempts < 40) requestAnimationFrame(() => tryRun(attempts + 1));
      };
      tryRun();
    };

    const pruneExpiredEffects = () => {
      setSelfPanelEffects((prev) => {
        const result = prunePanelEffects(prev);
        if (!result.changed) return prev;
        result.cleared.forEach((type) => {
          if (type === 'paint') clearPaintCanvas('self');
          if (type === 'scribble') clearScribbleCanvas('self');
        });
        result.restarted.forEach((type) => {
          if (type === 'lightning') bumpLightningAnim('self');
          else restartSelfCanvas(type);
        });
        return result.next;
      });
      setOpponentEffects((prev) => {
        let changed = false;
        const next: typeof prev = {};
        Object.entries(prev).forEach(([botId, effects]) => {
          const result = prunePanelEffects(effects);
          if (!result.changed) {
            next[botId] = effects;
            return;
          }
          changed = true;
          result.cleared.forEach((type) => {
            if (type === 'paint') clearPaintCanvas(botId);
            if (type === 'scribble') clearScribbleCanvas(botId);
          });
          result.restarted.forEach((type) => {
            if (type === 'lightning') {
              queueMicrotask(() => bumpLightningAnim(botId));
              return;
            }
            queueMicrotask(() => restartOpponentCanvas(botId, type));
          });
          if (
            Object.keys(result.next.active).length > 0 ||
            Object.keys(result.next.queue).length > 0
          ) {
            next[botId] = result.next;
          }
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

    // 라이브 매치는 봇 올클리어로 문제를 넘기지 않음 (상대 진행은 서버 점수만)
    const allBotsSolved = isLiveMatch
      ? false
      : areAllBotsSolvedOnPlayerProblem(battleBots, currentIndex, elapsedSec, totalBattleSeconds);
    const timeUp = remaining <= 0;
    const playerFinalSubmitted = demoSpectating || spectatorLocked;

    // 제한시간 종료 → GAME OVER 고착 대신 관전 모드로 전환 (상대 대기)
    if (timeUp && !playerFinalSubmitted && !isLiveMatch) {
      setTimeoutSpectateRequest(true);
      return;
    }

    // 데모: 관전 중 봇까지 모두 끝나면 결과로
    if (!isLiveMatch && allBotsSolved && playerFinalSubmitted) {
      setBattleFinished(true);
      setShowGameOver(true);
      doPersistSubmission(answers, currentIndex);
      return;
    }

    if (allBotsSolved && currentProblemLocked && currentIndex < problems.length - 1) {
      queueAdvanceProblem('all-clear');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, currentIndex, problems.length, battleBots, elapsedSec, totalBattleSeconds, currentProblemLocked, battleFinished, demoSpectating, spectatorLocked, isLiveMatch]);

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

    if (isLiveMatch && !matchResultSubmittedRef.current) {
      matchResultSubmittedRef.current = true;
      const problemResultsList = finalizeProblemResults(problemResultsRef.current, totalProblems);
      const battleElapsedAtEnd = Math.max(0, totalBattleSeconds - remaining);
      const finishElapsed =
        finishedAtElapsedSec >= 0 ? finishedAtElapsedSec : battleElapsedAtEnd;
      const endMetrics = getUserRankMetrics(localSolvedProblems, solveTimes, finishElapsed);
      void submitMatchResult(matchId, {
        ingameScore,
        codes: answers,
        blankAnswers,
        selectedOptions: selectedOptionByProblem,
        solveTimes,
        problemResults: problemResultsList,
        localSolvedProblems,
        totalSolveTime: endMetrics.totalSolveTime,
        finishedAtElapsedSec: finishElapsed,
      })
        .then((result) => {
          setBattleSettings({
            ...getBattleSettings(),
            matchSubmitResult: {
              resultReady: result.resultReady,
              earnedGold: result.earnedGold,
              ratingDelta: result.ratingDelta,
              newTitleIds: result.newTitleIds,
              waitingForUserIds: result.waitingForUserIds,
            },
          });
          if (result.resultReady) {
            const resultParams = new URLSearchParams({ roomId });
            if (matchId) resultParams.set('matchId', matchId);
            navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
          } else {
            setChatMessages((prev) => [
              ...prev,
              {
                sender: 'SYSTEM',
                text: `다른 플레이어 제출 대기 중... (${(result.waitingForUserIds || []).length}명)`,
                time: '',
              },
            ]);
          }
        })
        .catch((error) => {
          console.error('매치 결과 제출 실패:', error);
          matchResultSubmittedRef.current = false;
        });
      return;
    }

    // 라이브에서 이미 제출했다면 GAME_ENDED / resultReady 폴링으로만 이동
    if (isLiveMatch) {
      const ready = Boolean((getBattleSettings().matchSubmitResult as { resultReady?: boolean } | undefined)?.resultReady);
      if (ready) {
        const resultParams = new URLSearchParams({ roomId });
        if (matchId) resultParams.set('matchId', matchId);
        navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
      }
      return;
    }

    const t = setTimeout(() => {
      const resultParams = new URLSearchParams({ roomId });
      if (matchId) resultParams.set('matchId', matchId);
      navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
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
    matchId,
    isLiveMatch,
    ingameScore,
    blankAnswers,
    selectedOptionByProblem,
    solveTimes,
    localSolvedProblems,
    finishedAtElapsedSec,
  ]);

  useEffect(() => {
    if (!isLiveMatch || !roomId) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      try {
        unsubs.push(onRoomEvent('connect', () => {
          if (!cancelled) void joinRoomSocket(roomId).catch(() => undefined);
        }));
        // A reconnect can lose the acknowledgement for the previous socket.
        // Bind game events immediately; the connect listener retries room entry.
        void joinRoomSocket(roomId).catch(() => undefined);

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.ITEM_USED, (payload: BattleItemUsedPayload) => {
            const myId = getCurrentUserId();
            const normId = (id: string | number | null | undefined) =>
              String(id || '').replace(/^player-/, '');
            // 본인이 보낸 아이템/낙서는 로컬에서 이미 재생·그림
            if (normId(payload.fromUserId) === normId(myId)) return;

            const targetId = String(payload.targetUserId || '');
            const isTargetMe =
              Boolean(targetId) && normId(targetId) === normId(myId);

            // 낙서 스트로크 동기화 (SFX 없음)
            if (payload.itemType === 'scribble' && payload.scribbleStroke) {
              const strokeTargetId = isTargetMe
                ? 'self'
                : (() => {
                    const roster = Array.isArray(battleMeta.roomRoster)
                      ? (battleMeta.roomRoster as Array<{ name?: string; userId?: string }>)
                      : [];
                    const targetName =
                      roster.find((player) => String(player.userId) === targetId)?.name ||
                      roster.find((player) => `player-${player.userId}` === targetId)?.name;
                    const bots = battleBotsRef.current;
                    const targetBot =
                      bots.find((bot) => bot.id === `player-${targetId}` || bot.id === targetId) ||
                      bots.find((bot) => bot.name === targetName);
                    return targetBot?.id || `player-${targetId}`;
                  })();
              const stroke = payload.scribbleStroke as ScribbleStroke;
              const tryStroke = (attempts = 0) => {
                if (applyScribbleStroke(strokeTargetId, stroke)) return;
                if (attempts < 40) requestAnimationFrame(() => tryStroke(attempts + 1));
              };
              tryStroke();
              return;
            }

            if (payload.itemType === 'timeReduce' && isTargetMe) {
              if (payload.matchId !== matchId || typeof payload.remainingSeconds !== 'number') return;
              SFX.play(payload.itemType);
              const seconds = Math.min(remainingRef.current, payload.remainingSeconds);
              liveDeadlineRef.current = Date.now() + seconds * 1000;
              setRemaining(seconds);
              return;
            }

            if (
              isTargetMe &&
              (payload.itemType === 'paint' ||
                payload.itemType === 'lightning' ||
                payload.itemType === 'scribble' ||
                payload.itemType === 'lock')
            ) {
              SFX.play(payload.itemType);
              const effectType = payload.itemType as AttackPanelType;
              setSelfPanelEffects((prev) => enqueuePanelEffect(prev, effectType).next);
              if (effectType === 'lightning') bumpLightningAnim('self');
              if (effectType === 'paint' || effectType === 'scribble') {
                const tryRun = (attempts = 0) => {
                  const panelEl = document.querySelector(
                    '.code-card .fill-blank-code, .code-card .fill-blank-area, .code-card',
                  ) as HTMLElement | null;
                  if (panelEl) {
                    if (effectType === 'paint') {
                      startPaintCanvas(panelEl, 'self');
                      return;
                    }
                    if (
                      startScribbleCanvas(panelEl, 'self', ITEM_PANEL_EFFECT_MS, {
                        interactive: false,
                      })
                    ) {
                      return;
                    }
                  }
                  if (attempts < 40) requestAnimationFrame(() => tryRun(attempts + 1));
                };
                tryRun();
              }
              return;
            }

            const roster = Array.isArray(battleMeta.roomRoster)
              ? (battleMeta.roomRoster as Array<{ name?: string; userId?: string }>)
              : [];
            const targetName =
              roster.find((player) => String(player.userId) === targetId)?.name ||
              roster.find((player) => `player-${player.userId}` === targetId)?.name;

            // setState 업데이터 밖에서 사이드 이펙트 실행
            setBattleBots((prev) => {
              const targetBot =
                prev.find((bot) => bot.id === `player-${targetId}` || bot.id === targetId) ||
                prev.find((bot) => bot.name === targetName);
              if (
                targetBot &&
                (payload.itemType === 'paint' ||
                  payload.itemType === 'lightning' ||
                  payload.itemType === 'scribble' ||
                  payload.itemType === 'lock')
              ) {
                queueMicrotask(() => {
                  SFX.play(payload.itemType);
                  applyAttackPanelEffect(
                    targetBot.id,
                    payload.itemType as AttackPanelType,
                  );
                  if (payload.itemType === 'lightning') bumpLightningAnim(targetBot.id);
                  if (payload.itemType === 'paint' || payload.itemType === 'scribble') {
                    setExpandedOpponentId(targetBot.id);
                    // 낙서: 내가 이미 그리는 중이면 interactive를 유지한 채 시간만 연장
                    runPanelCanvasEffect(
                      targetBot.id,
                      payload.itemType,
                      payload.itemType === 'scribble'
                        ? {
                            interactive: isScribbleInteractive(targetBot.id),
                            onStroke: getScribbleOnStroke(targetBot.id),
                          }
                        : undefined,
                    );
                  }
                });
              }
              return prev;
            });
          }),
        );

        unsubs.push(
          onRoomEvent(
            ROOM_SOCKET_EVENTS.USER_LEFT,
            (payload?: { roomId?: string; userId?: string }) => {
              if (String(payload?.roomId) !== String(roomId)) return;
              const leftId = String(payload?.userId || '').replace(/^player-/, '');
              if (!leftId) return;
              const myId = String(getCurrentUserId() || '').replace(/^player-/, '');
              if (leftId === myId || leavingToLobbyRef.current) return;
              const alreadyDeparted = departedUserIdsRef.current.has(leftId);
              departedUserIdsRef.current.add(leftId);
              const roster = Array.isArray(battleMeta.roomRoster)
                ? (battleMeta.roomRoster as Array<{ name?: string; userId?: string }>)
                : [];
              const leftName =
                roster.find((player) => String(player.userId || '').replace(/^player-/, '') === leftId)?.name ||
                '상대';
              if (!alreadyDeparted) {
                setChatMessages((messages) => [
                  ...messages,
                  { sender: 'SYSTEM', text: `${leftName}가 퇴장하였습니다`, time: '' },
                ]);
              }
              setBattleBots((prev) =>
                prev.filter((bot) => {
                  const botUid = String(bot.id).replace(/^player-/, '');
                  return botUid !== leftId && bot.id !== leftId;
                }),
              );
              setExpandedOpponentId((prev) => {
                if (!prev) return prev;
                const raw = String(prev).replace(/^player-/, '');
                return raw === leftId || prev === leftId ? null : prev;
              });
            },
          ),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.GAME_ENDED, (payload: BattleGameEndedPayload) => {
            if (payload.matchId && payload.matchId !== matchId) return;
            if (payload.roomId && String(payload.roomId) !== String(roomId)) return;
            if (payload.message) {
              setChatMessages((prev) => [
                ...prev,
                { sender: 'SYSTEM', text: String(payload.message), time: '' },
              ]);
            }
            if (payload.reason === 'no_players' || payload.message?.includes('대기실로 이동')) {
              returnFromAbandonedMatch(true);
              return;
            }
            if (leavingToLobbyRef.current || resultLeavingNavRef.current) return;
            if (payload.matchId) {
              const myId = getCurrentUserId();
              const rewards = Array.isArray(payload.rewards) ? payload.rewards : [];
              const mine =
                rewards.find((reward) => String(reward.userId || reward.id) === String(myId)) ||
                null;
              setBattleSettings({
                ...getBattleSettings(),
                matchSubmitResult: {
                  ...(getBattleSettings().matchSubmitResult as object),
                  resultReady: true,
                  rewards: payload.rewards,
                  earnedGold: mine?.earnedGold,
                  ratingDelta: mine?.ratingDelta,
                  newTitleIds: mine?.newTitleIds,
                },
              });
            }
            if (leavingToResultRef.current) {
              setBattleFinished(true);
              setShowGameOver(true);
              return;
            }
            setShowSaveModal(false);
            setShowResultLeavingModal(true);
          }),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.MATCH_RESULT_PENDING, (payload: MatchResultPendingPayload) => {
            const waiting = Array.isArray(payload.waitingForUserIds)
              ? payload.waitingForUserIds.map((id) => String(id))
              : [];
            setPendingResultUserIds(waiting);
          }),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.GAME_STATE_UPDATE, (payload: GameStateUpdatePayload) => {
            const myId = getCurrentUserId();
            const scores = Array.isArray(payload.scores) ? payload.scores : [];
            const statuses = Array.isArray(payload.submitStatuses) ? payload.submitStatuses : [];
            const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];

            setBattleBots((prev) =>
              prev.map((bot) => {
                const userId = String(bot.id).replace(/^player-/, '');
                const matchesUser = (uid: string) =>
                  String(uid) === userId ||
                  String(uid) === String(bot.id) ||
                  `player-${uid}` === String(bot.id);

                if (matchesUser(String(myId))) return bot;

                const entry = scores.find((item) => matchesUser(String(item.userId)));
                const mineStatuses = statuses.filter(
                  (item) => matchesUser(String(item.userId)) && item.isSubmitted,
                );
                const fromStatus = mineStatuses
                  .map((item) => Number(item.problemIndex))
                  .filter((idx) => Number.isInteger(idx) && idx >= 0);

                let solvedProblems = Array.isArray(bot.solvedProblems) ? [...bot.solvedProblems] : [];
                fromStatus.forEach((idx) => {
                  if (!solvedProblems.includes(idx)) solvedProblems.push(idx);
                });
                solvedProblems.sort((a, b) => a - b);

                const written = submissions.filter((item) => matchesUser(String(item.userId)));
                const blankAnswersByProblem = [...(bot.blankAnswersByProblem || [])];
                written.forEach((item) => {
                  const idx = Number(item.problemIndex);
                  if (!Number.isInteger(idx) || idx < 0) return;
                  while (blankAnswersByProblem.length <= idx) blankAnswersByProblem.push([]);
                  if (item.selectedOption != null && Number.isFinite(Number(item.selectedOption))) {
                    blankAnswersByProblem[idx] = [String(item.selectedOption)];
                  } else if (Array.isArray(item.answers)) {
                    blankAnswersByProblem[idx] = item.answers.map((answer) => String(answer ?? ''));
                  }
                  if (!solvedProblems.includes(idx)) solvedProblems.push(idx);
                });
                solvedProblems.sort((a, b) => a - b);

                if (entry) {
                  const score = Number(entry.score) || 0;
                  return {
                    ...bot,
                    score,
                    solvedProblems,
                    blankAnswersByProblem,
                    status: 'playing',
                  };
                }

                if (fromStatus.length === 0 && written.length === 0) return bot;
                return {
                  ...bot,
                  solvedProblems,
                  blankAnswersByProblem,
                  status: 'playing',
                };
              }),
            );
          }),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.USER_RECONNECTED, (payload: UserReconnectedPayload) => {
            if (!payload.matchId) return;
            void fetchActiveMatch(roomId)
              .then((match) => {
                if (cancelled) return;
                setBattleSettings({
                  ...getBattleSettings(),
                  matchId: match.matchId,
                  roundSeconds: match.roundSeconds,
                });
                setChatMessages((prev) => [
                  ...prev,
                  { sender: 'SYSTEM', text: '재접속 정보를 복구했습니다.', time: '' },
                ]);
              })
              .catch(() => undefined);
          }),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ChatMessagePayload) => {
            const name = payload.sender?.displayName || payload.sender?.username || 'UNKNOWN';
            const text = String(payload.message || '');
            if (!text) return;
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const modeLabel =
              payload.mode === 'WHISPER'
                ? `[귓속말${payload.targetUserName ? `:${payload.targetUserName}` : ''}]`
                : payload.mode === 'FRIEND'
                  ? '[친구]'
                  : '[전체]';
            const messageId = String(payload.messageId || '');
            setChatMessages((prev) => {
              if (messageId && prev.some((item) => item.id === messageId)) return prev;
              return [...prev, { id: messageId || undefined, sender: name, text, time: timeStr, mode: modeLabel }];
            });
          }),
        );
      } catch {
        // REST 매치는 소켓 없이도 진행
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
    };
  }, [isLiveMatch, roomId, battleMeta.roomRoster, matchId, navigate, problems.length, returnFromAbandonedMatch]);

  const timeExpired = remaining <= 0;
  useEffect(() => {
    if (!isLiveMatch || !matchId || !sessionReady) return;
    return watchMatchCompletion({
      intervalMs: demoSpectating || spectatorLocked || battleFinished || timeExpired ? 1500 : 3000,
      onAbandoned: returnFromAbandonedMatch,
      onTime: (seconds) => {
        const nextDeadline = Date.now() + seconds * 1000;
        if (nextDeadline < liveDeadlineRef.current) liveDeadlineRef.current = nextDeadline;
      },
      fetchPending: () => fetchMatchPending(matchId, { background: true }),
      onSubmitted: () => {
        if (matchResultSubmittedRef.current || leavingToLobbyRef.current) return;
        matchResultSubmittedRef.current = true;
        setShowSaveModal(false);
        setSpectatorLocked(true);
        setDemoSpectating(true);
      },
      onReady: () => {
        if (resultLeavingNavRef.current || leavingToLobbyRef.current) return;
        resultLeavingNavRef.current = true;
        setBattleSettings({ ...getBattleSettings(), matchSubmitResult: { ...(getBattleSettings().matchSubmitResult as object), resultReady: true } });
        navigate(`${ROUTES.RESULT}?roomId=${encodeURIComponent(roomId)}&matchId=${encodeURIComponent(matchId)}`, { replace: true });
      },
    });
  }, [isLiveMatch, matchId, roomId, sessionReady, demoSpectating, spectatorLocked, battleFinished, timeExpired, navigate, returnFromAbandonedMatch]);

  // 라이브: 마지막 문제까지 제출(관전)하면 결과 제출만 하고, 상대 대기 (바로 결과창 X)
  useEffect(() => {
    if (!isLiveMatch || !matchId || showGameOver) return;
    if (!(demoSpectating || spectatorLocked)) return;
    if (currentIndex < problems.length - 1) return;
    if (matchResultSubmittedRef.current) return;

    matchResultSubmittedRef.current = true;
    const elapsed = finishedAtElapsedSec >= 0 ? finishedAtElapsedSec : Math.max(0, totalBattleSeconds - remaining);
    // 모든 문제를 푼 경우에만 완주 시각 확정
    if (finishedAtElapsedSec < 0 && localSolvedProblems.length >= totalProblems) {
      setFinishedAtElapsedSec(elapsed);
    }

    const problemResultsList = finalizeProblemResults(problemResultsRef.current, totalProblems);
    const earlyMetrics = getUserRankMetrics(localSolvedProblems, solveTimes, elapsed);
    void submitMatchResult(matchId, {
      ingameScore,
      codes: answers,
      blankAnswers,
      selectedOptions: selectedOptionByProblem,
      solveTimes,
      problemResults: problemResultsList,
      localSolvedProblems,
      totalSolveTime: earlyMetrics.totalSolveTime,
      finishedAtElapsedSec: Math.max(0, elapsed),
    })
      .then((result) => {
        setBattleSettings({
          ...getBattleSettings(),
          matchSubmitResult: {
            resultReady: result.resultReady,
            earnedGold: result.earnedGold,
            ratingDelta: result.ratingDelta,
            newTitleIds: result.newTitleIds,
            waitingForUserIds: result.waitingForUserIds,
          },
        });
        if (result.resultReady) {
          const resultParams = new URLSearchParams({ roomId });
          if (matchId) resultParams.set('matchId', matchId);
          navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
        } else {
          setChatMessages((prev) => [
            ...prev,
            {
              sender: 'SYSTEM',
              text: `다른 플레이어 제출 대기 중... (${(result.waitingForUserIds || []).length}명)`,
              time: '',
            },
          ]);
        }
      })
      .catch((error) => {
        console.error('매치 결과 조기 제출 실패:', error);
        matchResultSubmittedRef.current = false;
      });
  }, [
    isLiveMatch,
    matchId,
    showGameOver,
    demoSpectating,
    spectatorLocked,
    currentIndex,
    problems.length,
    finishedAtElapsedSec,
    totalBattleSeconds,
    remaining,
    ingameScore,
    answers,
    blankAnswers,
    selectedOptionByProblem,
    solveTimes,
    localSolvedProblems,
    totalProblems,
    roomId,
    navigate,
  ]);
  useEffect(() => {
    const onPageHide = () => {
      if (!isLiveMatch || !initialSessionLoadedRef.current || matchResultSubmittedRef.current ||
        leavingToLobbyRef.current || remainingRef.current <= 0) return;
      const userId = getCurrentUserId();
      const draft = preserveDraft(userId, {
        matchId,
        currentIndex,
        codes: problems.map((problem, index) => assembleCode(problem.question || '', blankAnswers[index] || [])),
        blankAnswers,
        selectedOptions: selectedOptionByProblem,
        remaining: remainingRef.current,
        solveTimes,
        buildsUsed: buildsUsedByProblem,
        selectedItemKeys: Array.from(selectedItemKeys),
        problemStartedAtElapsed: problemStartedAtElapsedRef.current,
      });
      saveDraftOnPageHide(userId, draft);
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [isLiveMatch, matchId, problems, currentIndex, blankAnswers, selectedOptionByProblem, solveTimes, buildsUsedByProblem, selectedItemKeys]);

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
    if (dirty) setSaveStatus('unsaved');

    if (!dirty && !isLiveMatch) return;

    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    saveDebounceRef.current = setTimeout(() => {
      doPersistSession(answers).catch(() => {});
    }, 500);

    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    };
  }, [answers, sessionSavedSnapshot, problems.length, doPersistSession, isLiveMatch]);

  useEffect(() => {
    if (battleFinished && matchId) closeDraftWriter(getCurrentUserId(), matchId);
  }, [battleFinished, matchId]);

  const queueAdvanceProblem = (_reason = 'time') => {
    if (advanceQueuedRef.current || battleFinished) return;
    advanceQueuedRef.current = true;
    syncBattleDemoState(sessionId, { event: 'advance-queued', reason: _reason, currentIndex, remaining });

    setProblemResults((prev) =>
      prev[currentIndex] !== undefined ? prev : { ...prev, [currentIndex]: false },
    );
    if (currentIndex >= problems.length - 1) {
      // 타임업은 관전 전환으로 처리. 여기까지 오면 데모 올클리어 등
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
    problemStartedAtElapsedRef.current = Math.max(0, totalBattleSeconds - remaining);
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

  /** 제한시간 종료: 미제출 문항을 서버에 반영(상대 100% 표시) 후 관전 모드 */
  const enterTimeoutSpectator = useCallback(async () => {
    if (isLiveMatch || timeoutSpectateRef.current || demoSpectating || spectatorLocked || battleFinished) return;
    timeoutSpectateRef.current = true;
    setTimeoutSpectateRequest(false);

    const lastIndex = Math.max(0, problems.length - 1);
    const nextResults: ProblemResultsMap = { ...problemResultsRef.current };
    for (let i = 0; i < problems.length; i += 1) {
      if (nextResults[i] === undefined) nextResults[i] = false;
    }
    problemResultsRef.current = nextResults;
    setProblemResults(nextResults);

    const elapsed = Math.max(0, totalBattleSeconds - remaining);
    if (finishedAtElapsedSec < 0) {
      setFinishedAtElapsedSec(elapsed);
    }
    setCurrentIndex(lastIndex);
    setSpectatorMyViewProblem(lastIndex);
    setRevisionEditMode(false);
    setShowSaveModal(false);
    setShowGameOver(false);
    setSpectatorLocked(true);
    setDemoSpectating(true);
    setShowClearFlash(true);
    setRevealHint(null);
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'SYSTEM',
        text: '제한 시간이 종료되어 관전 모드로 전환합니다. 다른 플레이어를 기다립니다...',
        time: '',
      },
    ]);
    syncBattleDemoState(sessionId, {
      event: 'timeout-spectate',
      lockedProblemIndex: lastIndex,
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
    doPersistSubmission(answers, lastIndex);
  }, [
    demoSpectating,
    spectatorLocked,
    battleFinished,
    problems.length,
    isLiveMatch,
    matchId,
    blankAnswers,
    selectedOptionByProblem,
    totalBattleSeconds,
    remaining,
    finishedAtElapsedSec,
    sessionId,
    answers,
    doPersistSession,
    doPersistSubmission,
  ]);

  useEffect(() => {
    if (!timeoutSpectateRequest) return;
    void enterTimeoutSpectator();
  }, [timeoutSpectateRequest, enterTimeoutSpectator]);

  const goToResultPage = () => {
    if (resultLeavingNavRef.current) return;
    resultLeavingNavRef.current = true;
    const resultParams = new URLSearchParams({ roomId });
    if (matchId) resultParams.set('matchId', matchId);
    navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
  };

  const resolveIsLastFinisher = async () => {
    const myId = String(getCurrentUserId() || '').replace(/^player-/, '');
    if (!isLiveMatch || !matchId) return true;
    let waiting = pendingResultUserIds;
    try {
      const pending = await fetchMatchPending(matchId);
      waiting = Array.isArray(pending.waitingForUserIds) ? pending.waitingForUserIds.map(String) : waiting;
      setPendingResultUserIds(waiting);
      if (pending.resultReady) return true;
    } catch {
      /* 소켓 대기 목록으로 판단 */
    }
    const others = waiting
      .map((id) => String(id).replace(/^player-/, ''))
      .filter((id) => id && id !== myId && !departedUserIdsRef.current.has(id));
    if (waiting.length === 0) {
      const roster = Array.isArray(battleMeta.roomRoster)
        ? (battleMeta.roomRoster as Array<{ userId?: string }>)
        : [];
      const humans = roster
        .map((player) => String(player.userId || '').replace(/^player-/, ''))
        .filter((id) => id && !id.startsWith('bot') && !departedUserIdsRef.current.has(id));
      return humans.filter((id) => id !== myId).length === 0;
    }
    return others.length === 0;
  };

  const canOfferRevise =
    isItemMode &&
    selectedItemKeys.has('revise') &&
    itemInventory.revise > 0 &&
    !revisionEditMode;

  const handleFinalSubmitClick = async () => {
    if (demoSpectating || spectatorLocked || showSaveModal || showResultLeavingModal) return;
    if (showReviseAskModal || showReviseSelectModal) return;
    if (!hasCurrentAnswerAttempted() && !revisionEditMode) {
      setShowAnswerRequiredModal(true);
      return;
    }
    const isLast = await resolveIsLastFinisher();
    setFinalSubmitKind(isLast ? 'result' : 'spectate');
    if (canOfferRevise) {
      setShowReviseAskModal(true);
      return;
    }
    setShowSaveModal(true);
  };

  const openReviseSelect = () => {
    if (selectedOption !== null) {
      setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: selectedOption }));
    }
    setShowReviseAskModal(false);
    setSelectedReviseProblems([]);
    setShowReviseSelectModal(true);
    setShowReviseHint(true);
    window.setTimeout(() => setShowReviseHint(false), 1800);
  };

  const skipReviseAndConfirm = () => {
    setShowReviseAskModal(false);
    setShowReviseSelectModal(false);
    setShowSaveModal(true);
  };

  const toggleReviseProblem = (index: number) => {
    setSelectedReviseProblems((prev) => {
      if (prev.includes(index)) return prev.filter((item) => item !== index);
      if (prev.length >= itemInventory.revise) return prev;
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const goToReviseProblem = (index: number) => {
    if (!revisionEditMode || !selectedReviseProblems.includes(index)) return;
    if (selectedOption !== null) {
      setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: selectedOption }));
    }
    setCurrentIndex(index);
    setProblemSolved(false);
    setSelectedOption(selectedOptionByProblem[index] ?? null);
    problemStartedAtElapsedRef.current = Math.max(0, totalBattleSeconds - remaining);
  };

  const confirmReviseSelection = async () => {
    if (selectedReviseProblems.length < 1) return;
    if (isLiveMatch && matchId) {
      try {
        await activateMatchRevise(matchId, selectedReviseProblems);
      } catch (error) {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'SYSTEM', text: getMatchErrorMessage(error), time: '' },
        ]);
        return;
      }
    }
    const used = selectedReviseProblems.length;
    setItemInventory((prev) => ({ ...prev, revise: Math.max(0, prev.revise - used) }));
    setShowReviseSelectModal(false);
    setRevisionEditMode(true);
    const first = selectedReviseProblems[0];
    setCurrentIndex(first);
    setProblemSolved(false);
    setSelectedOption(selectedOptionByProblem[first] ?? null);
    problemStartedAtElapsedRef.current = Math.max(0, totalBattleSeconds - remaining);
  };

  const cancelFinalSubmit = () => {
    setShowSaveModal(false);
  };

  const finalizeSaveAndSpectate = async () => {
    if (saveModalTimerRef.current) clearTimeout(saveModalTimerRef.current);
    const lastIndex = Math.max(0, problems.length - 1);
    const indexesToSubmit = new Set<number>();
    if (revisionEditMode) {
      selectedReviseProblems.forEach((index) => indexesToSubmit.add(index));
    }
    if (problems.length > 0) indexesToSubmit.add(lastIndex);
    let submittedAny = false;
    for (const index of [...indexesToSubmit].sort((a, b) => a - b)) {
      const ok = await submitProblemAt(index, { force: true });
      if (ok) submittedAny = true;
    }
    if (!submittedAny && hasCurrentAnswerAttempted()) return;
    setCurrentIndex(lastIndex);
    setRevisionEditMode(false);
    setShowSaveModal(false);
    setSpectatorLocked(true);
    setRevealHint(null);
    setSpectatorMyViewProblem(lastIndex);
    if (selectedOption !== null) {
      setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: selectedOption }));
    }
    setSessionSavedSnapshot(answers.join('||'));
    setSaveStatus('saved');
    if (finalSubmitKind === 'result') {
      leavingToResultRef.current = true;
      setBattleFinished(true);
      setShowGameOver(true);
    } else {
      setDemoSpectating(true);
      setShowClearFlash(true);
    }
    syncBattleDemoState(sessionId, {
      event: 'submit-lock',
      lockedProblemIndex: currentIndex,
      demoSpectating: finalSubmitKind !== 'result',
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

  useEffect(() => {
    if (!showResultLeavingModal) return;
    const timer = window.setTimeout(() => {
      if (resultLeavingNavRef.current) return;
      resultLeavingNavRef.current = true;
      const resultParams = new URLSearchParams({ roomId });
      if (matchId) resultParams.set('matchId', matchId);
      navigate(`${ROUTES.RESULT}?${resultParams.toString()}`, { replace: true });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [showResultLeavingModal, roomId, matchId, navigate]);

  const updateBlankAnswer = (problemIndex: number, blankIndex: number, value: string) => {
    if (problemSolved && !revisionEditMode) return;
    if (isPanelTypeActive(selfPanelEffects, 'lock')) return;
    setBlankAnswers((prev) => {
      const next = prev.map((arr) => [...arr]);
      if (!next[problemIndex]) next[problemIndex] = [];
      next[problemIndex][blankIndex] = value;
      return next;
    });
  };

  const submitProblemAt = async (problemIndex: number, options?: { force?: boolean }) => {
    if (demoSpectating || spectatorLocked) return false;
    if (problemIndex === currentIndex && problemSolved && !options?.force) return false;
    const optionForProblem =
      problemIndex === currentIndex
        ? selectedOption
        : (selectedOptionByProblem[problemIndex] ?? null);
    const problem = normalizeBattleProblem(problems[problemIndex] || ({} as BattleProblem));
    const attempted = hasProblemAnswerAttempted({
      problem,
      problemIndex,
      langKey,
      blankAnswers,
      selectedOption: optionForProblem,
    });
    if (!attempted) return false;
    if (answerSubmittingRef.current) return false;
    answerSubmittingRef.current = true;

    const battleElapsed = Math.max(0, totalBattleSeconds - remaining);
    const elapsed = Math.max(0, battleElapsed - problemStartedAtElapsedRef.current);
    let isCorrect = false;

    try {
      if (isLiveMatch) {
        const answersForProblem = (blankAnswers[problemIndex] || []).map((value) => String(value ?? ''));
        const result = await submitMatchAnswer(matchId, {
          problemIndex,
          answers: answersForProblem,
          selectedOption: optionForProblem === null ? undefined : optionForProblem,
        });
        isCorrect = Boolean(result.isCorrect);
        setIngameScore(Number(result.score) || 0);
      } else {
        isCorrect = isProblemAnswerCorrect({
          problem,
          problemIndex,
          langKey,
          blankAnswers,
          selectedOption: optionForProblem,
        });
        const wasCorrect = problemResults[problemIndex] === true;
        if (isCorrect && !wasCorrect) {
          setIngameScore((prev) => prev + BATTLE_CORRECT_SCORE);
        } else if (!isCorrect && wasCorrect) {
          setIngameScore((prev) => Math.max(0, prev - BATTLE_CORRECT_SCORE));
        }
      }

      setProblemResults((prev) => ({ ...prev, [problemIndex]: isCorrect }));
      setSolveTimes((prev) =>
        prev[problemIndex] != null ? prev : { ...prev, [problemIndex]: elapsed },
      );

      setLocalSolvedProblems((prev) => {
        const next = isCorrect
          ? Array.from(new Set([...prev, problemIndex])).sort((a, b) => a - b)
          : prev.filter((index) => index !== problemIndex);
        markProblemSubmitted(sessionId, next);
        if (isCorrect && next.length >= totalProblems) {
          setFinishedAtElapsedSec(battleElapsed);
        }
        return next;
      });

      if (problemIndex === currentIndex) setProblemSolved(true);
      return true;
    } catch (error) {
      if (isAlreadySubmittedError(error)) {
        if (problemIndex === currentIndex) setProblemSolved(true);
        return true;
      }
      setChatMessages((prev) => [
        ...prev,
        { sender: 'SYSTEM', text: getMatchErrorMessage(error), time: '' },
      ]);
      return false;
    } finally {
      answerSubmittingRef.current = false;
    }
  };

  const submitCurrentProblem = async (options?: { force?: boolean }) =>
    submitProblemAt(currentIndex, options);

  const handleSubmit = async () => {
    if (demoSpectating || spectatorLocked || problemSolved) return;
    if (!hasCurrentAnswerAttempted()) {
      setShowAnswerRequiredModal(true);
      return;
    }
    if (currentIndex >= problems.length - 1) {
      await handleFinalSubmitClick();
      return;
    }

    const submitted = await submitCurrentProblem();
    if (!submitted) return;

    setCurrentIndex((prev) => prev + 1);
    setProblemSolved(false);
    setSelectedOption(null);
    problemStartedAtElapsedRef.current = Math.max(0, totalBattleSeconds - remaining);
  };

  const handleAdvance = () => {
    if (problemResults[currentIndex] === undefined) {
      markProblemWrong(currentIndex);
    }
    if (currentIndex >= problems.length - 1) {
      void handleFinalSubmitClick();
      return;
    }
    setCurrentIndex(currentIndex + 1);
    setProblemSolved(false);
    setSelectedOption(null);
    problemStartedAtElapsedRef.current = Math.max(0, totalBattleSeconds - remaining);
  };

  const selectChoice = (idx: number) => {
    if (problemSolved && !revisionEditMode) return;
    setSelectedOption(idx);
    setSelectedOptionByProblem((prev) => ({ ...prev, [currentIndex]: idx }));
  };

  const getEmptyBlankIndexes = () => {
    const correct = resolveProblemAnswersWithFallback(currentProblem, langKey);
    if (currentCaps.showShortAnswerPanel) {
      return isUserBlankFilled(blankAnswers[currentIndex]?.[0], correct[0]) ? [] : [0];
    }
    const blankCount = Math.max(
      correct.length,
      (currentProblem.question || '').match(/_____/g)?.length || 0,
    );
    const blanks = blankAnswers[currentIndex] || [];
    const empty: number[] = [];
    for (let i = 0; i < blankCount; i += 1) {
      if (!isUserBlankFilled(blanks[i], correct[i])) empty.push(i);
    }
    return empty;
  };

  const handleUseSelfItem = async (type: keyof ItemInventory) => {
    if (demoSpectating || spectatorLocked) return;
    if (!isItemMode || !selectedItemKeys.has(type)) return;
    if (itemInventory[type] <= 0) return;
    if (!canUseItem(currentCaps, type)) return;
    if (type === 'buildCharge' && !showBuildPanel) return;

    const correct = resolveProblemAnswersWithFallback(currentProblem, langKey);
    let serverEffect: Awaited<ReturnType<typeof useMatchItem>>['effect'] | null = null;

    if (isLiveMatch) {
      try {
        const result = await useMatchItem(matchId, {
          problemIndex: currentIndex,
          itemKey: type,
          emptyBlankIndexes: type === 'blankBreak' ? getEmptyBlankIndexes() : undefined,
        });
        serverEffect = result.effect || null;
      } catch (error) {
        setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text: getMatchErrorMessage(error), time: '' }]);
        return;
      }
    }

    if (type === 'revealLength' || type === 'revealPrev') {
      if (serverEffect?.hint) {
        setRevealHint(serverEffect.hint);
      } else if (correct.length === 0) {
        setRevealHint('(정보 없음)');
        return;
      } else {
        const idx =
          typeof serverEffect?.blankIndex === 'number'
            ? serverEffect.blankIndex
            : Math.floor(Math.random() * correct.length);
        const value = String(correct[idx] ?? '');
        setRevealHint(
          type === 'revealLength' ? `[${value.length}자]` : `[앞글자: ${value[0] || '?'}]`,
        );
      }
    } else if (type === 'blankBreak') {
      const applied = applyBlankBreak(correct, serverEffect);
      if (!applied) return;
      return;
    } else if (type === 'buildCharge') {
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

  const applyBlankBreak = (
    correct: string[],
    serverEffect?: Awaited<ReturnType<typeof useMatchItem>>['effect'] | null,
  ): boolean => {
    const answers =
      Array.isArray(serverEffect?.answers) && serverEffect.answers.length > 0
        ? serverEffect.answers.map((value) => String(value ?? ''))
        : correct;

    if (currentCaps.showShortAnswerPanel) {
      const value =
        typeof serverEffect?.value === 'string'
          ? serverEffect.value
          : String(answers[0] ?? '');
      if (!value && answers.length === 0) {
        setRevealHint('(정보 없음)');
        return false;
      }
      setBreakingBlanks((prev) => ({ ...prev, [`${currentIndex}_0`]: true }));
      setTimeout(() => {
        setBlankAnswers((prev) => {
          const next = prev.map((a) => [...a]);
          if (!next[currentIndex]) next[currentIndex] = [];
          next[currentIndex][0] = value;
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
      return true;
    }

    const blankCount = Math.max(
      answers.length,
      (currentProblem.question || '').match(/_____/g)?.length || 0,
    );
    if (blankCount === 0) {
      setRevealHint('(정보 없음)');
      return false;
    }
    const blanks = blankAnswers[currentIndex] || [];
    const unsolved: number[] = [];
    for (let i = 0; i < blankCount; i += 1) {
      if (!isUserBlankFilled(blanks[i], answers[i])) unsolved.push(i);
    }
    if (unsolved.length === 0) return false;

    const blankIdx =
      typeof serverEffect?.blankIndex === 'number' && unsolved.includes(serverEffect.blankIndex)
        ? serverEffect.blankIndex
        : unsolved[Math.floor(Math.random() * unsolved.length)];
    const value =
      typeof serverEffect?.value === 'string'
        ? serverEffect.value
        : String(answers[blankIdx] ?? '');
    if (!value && answers.length === 0) {
      setRevealHint('(정보 없음)');
      return false;
    }

    setBreakingBlanks((prev) => ({ ...prev, [`${currentIndex}_${blankIdx}`]: true }));
    setTimeout(() => {
      setBlankAnswers((prev) => {
        const next = prev.map((a) => [...a]);
        if (!next[currentIndex]) next[currentIndex] = [];
        next[currentIndex][blankIdx] = value;
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
    return true;
  };

  const canUseAttackItems = isItemMode && selectedAttackItems.length > 0 && !showGameOver;

  const applyAttackPanelEffect = (botId: string, type: AttackPanelType): boolean => {
    let started = false;
    setOpponentEffects((prev) => {
      const result = enqueuePanelEffect(prev[botId], type);
      started = result.started;
      return { ...prev, [botId]: result.next };
    });
    // 중첩(큐)이어도 페인트처럼 시각 효과를 다시 재생
    if (type === 'lightning') bumpLightningAnim(botId);
    return started;
  };

  const runPanelCanvasEffect = (
    botId: string,
    type: 'paint' | 'scribble',
    options?: { interactive?: boolean; onStroke?: (stroke: ScribbleStroke) => void },
  ) => {
    const tryRun = (attempts = 0) => {
      const panelEl = (document.querySelector(
        `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] [data-opponent-canvas="${botId}"]`,
      ) ||
        document.querySelector(`[data-opponent-canvas="${botId}"]`) ||
        document.querySelector(
          `.opponent-code-panel-mini.expanded[data-opponent-id="${botId}"] .mini-code-area`,
        )) as HTMLElement | null;
      if (panelEl) {
        if (type === 'paint') {
          startPaintCanvas(panelEl, botId);
          return;
        }
        if (
          startScribbleCanvas(panelEl, botId, ITEM_PANEL_EFFECT_MS, {
            interactive: options?.interactive !== false,
            onStroke: options?.onStroke,
          })
        ) {
          return;
        }
      }
      if (attempts < 40) requestAnimationFrame(() => tryRun(attempts + 1));
    };
    tryRun();
  };

  const handleOpenItemModal = (botId: string) => {
    if (!canUseAttackItems) return;
    const bot = currentBotViews.find((entry) => entry.id === botId);
    if (bot && totalProblems > 0 && (bot.solvedProblems?.length || 0) >= totalProblems) {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'SYSTEM', text: '이미 모든 문제를 푼 상대에게는 공격할 수 없습니다.', time: '' },
      ]);
      return;
    }
    itemTargetBotIdRef.current = botId;
    setExpandedOpponentId(botId);
    setShowItemModal(true);
  };

  const handleCloseItemModal = () => {
    setShowItemModal(false);
    itemTargetBotIdRef.current = null;
  };

  const handleSelectItemType = async (type: keyof ItemInventory) => {
    if (!canUseAttackItems || !selectedItemKeys.has(type)) return;
    if (itemInventory[type] <= 0) return;
    if (!ATTACK_ITEM_KEYS.includes(type) && !canUseItem(currentCaps, type)) return;
    const botId = itemTargetBotIdRef.current || expandedOpponentId;
    if (!botId) return;

    const targetBot = battleBots.find((bot) => bot.id === botId);
    const roster = Array.isArray(battleMeta.roomRoster)
      ? (battleMeta.roomRoster as Array<{ name?: string; userId?: string }>)
      : [];
    const targetUserId = String(
      (targetBot?.id || '').replace(/^player-/, '') ||
        roster.find((player) => player.name === targetBot?.name)?.userId ||
        '',
    );

    if (isLiveMatch) {
      try {
        await useMatchItem(matchId, {
          problemIndex: currentIndex,
          itemKey: type,
          targetUserId: targetUserId || undefined,
        });
        if (type !== 'timeReduce') {
          await emitBattleItemUsed(roomId, {
            itemType: type,
            targetUserId: targetUserId || undefined,
          });
        }
      } catch (error) {
        setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text: getMatchErrorMessage(error), time: '' }]);
        return;
      }
    }

    itemTargetBotIdRef.current = botId;
    setExpandedOpponentId(botId);
    setShowItemModal(false);
    SFX.play(type);
    setItemCastState({ type, ts: Date.now() });
    setTimeout(() => setItemCastState(null), 1500);

    if (type === 'paint' || type === 'lightning' || type === 'scribble' || type === 'lock') {
      setPanelHit((p) => ({ ...p, [botId]: true }));
      setTimeout(() => setPanelHit((p) => {
        const n = { ...p };
        delete n[botId];
        return n;
      }), 600);
    }

    if (type === 'paint') {
      applyAttackPanelEffect(botId, 'paint');
      // started 여부와 무관하게 캔버스 시작 (Strict Mode setState 이중호출 대비)
      runPanelCanvasEffect(botId, 'paint');
      setItemInventory((prev) => ({ ...prev, paint: prev.paint - 1 }));
    } else if (type === 'lightning') {
      applyAttackPanelEffect(botId, 'lightning');
      setItemInventory((prev) => ({ ...prev, lightning: prev.lightning - 1 }));
    } else if (type === 'timeReduce') {
      // 서버가 대상의 마감 시간을 기록하고 통지한다.
      setItemInventory((prev) => ({ ...prev, timeReduce: prev.timeReduce - 1 }));
    } else if (type === 'scribble') {
      applyAttackPanelEffect(botId, 'scribble');
      runPanelCanvasEffect(botId, 'scribble', {
        interactive: true,
        onStroke: (stroke) => {
          if (!isLiveMatch || !roomId || !targetUserId) return;
          void emitBattleItemUsed(roomId, {
            itemType: 'scribble',
            targetUserId,
            scribbleStroke: stroke,
          });
        },
      });
      setItemInventory((prev) => ({ ...prev, scribble: prev.scribble - 1 }));
    } else if (type === 'lock') {
      applyAttackPanelEffect(botId, 'lock');
      setItemInventory((prev) => ({ ...prev, lock: prev.lock - 1 }));
    }

    itemTargetBotIdRef.current = null;
  };

  const handleSendChat = () => {
    if (!chatMsg.trim()) return;
    const text = chatMsg.trim();
    const messageId = createChatMessageId();
    setChatMsg('');
    if (isLiveMatch && roomId) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      setChatMessages((prev) => [
        ...prev,
        { id: messageId, sender: getCurrentUserName(), text, time: timeStr, mode: '[전체]' },
      ]);
      void sendRoomMessage(roomId, text, { messageId }).then((result) => {
        if (!result.success) {
          setChatMessages((prev) => [
            ...prev,
            { sender: 'SYSTEM', text: result.message || '메시지 전송 실패', time: '' },
          ]);
        }
      });
      return;
    }
    if (!demoSpectating) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setChatMessages((prev) => [...prev, { sender: getCurrentUserName(), text, time: timeStr }]);
  };

  const leaveBattle = () => {
    setShowLeaveConfirm(true);
  };

  const confirmLeaveBattle = async () => {
    const numericRoomId = roomId ? Number(roomId) : NaN;
    leavingToLobbyRef.current = true;
    if (roomId) blockAutoRejoin(roomId);
    try {
      if (Number.isInteger(numericRoomId) && numericRoomId > 0) {
        await leaveRoom(numericRoomId, matchId);
      }
      setActiveRoomId(null);
      setShowLeaveConfirm(false);
      clearBattleAndLeave(sessionId, roomId);
      markLobbyChatReset();
      navigate(ROUTES.LOBBY);
    } catch (error) {
      leavingToLobbyRef.current = false;
      if (roomId) clearAutoRejoinBlock(roomId);
      setShowLeaveConfirm(false);
      setLeaveAlertMessage(getRoomErrorMessage(error) || '방 나가기에 실패했습니다. 다시 시도해 주세요.');
    }
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

  const blanksLockedByItem = isPanelTypeActive(selfPanelEffects, 'lock');

  const isLocked =
    demoSpectating || spectatorLocked || (problemSolved && !revisionEditMode) || blanksLockedByItem;

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
        const checked = allProblemsSubmitted || idx <= currentIndex;
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
  const previouslySolved = !demoSpectating && isPreviouslySolvedProblem(activeProblem, solvedProblemKeys);
  const activeCaps = demoSpectating ? displayedCaps : currentCaps;
  const activeProblemIndex = demoSpectating ? myViewProblemIndex : currentIndex;
  const activeSelectedOption = demoSpectating ? displayedSelectedOption : selectedOption;
  const activeLocked = demoSpectating || isLocked;
  const activeShouldRenderVisual = demoSpectating ? displayedShouldRenderVisual : shouldRenderProblemVisual;

  const isLastProblem = currentIndex >= problems.length - 1;
  const battleActionBar = (
    <div className="battle-action-bar">
      {!demoSpectating && revisionEditMode && (
        <>
          <div className="battle-revise-tabs">
            {selectedReviseProblems.map((idx) => (
              <button
                key={`revise-tab-${idx}`}
                type="button"
                className={`pixel-btn${idx === currentIndex ? ' pixel-btn-success' : ' pixel-btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '13px' }}
                onClick={() => goToReviseProblem(idx)}
              >
                {idx + 1}번
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pixel-btn pixel-btn-success"
            onClick={() => void handleFinalSubmitClick()}
            style={{ padding: '4px 10px', fontSize: '14px' }}
          >
            최종제출
          </button>
        </>
      )}
      {!demoSpectating &&
        !revisionEditMode &&
        (isLastProblem ? (
          <button
            type="button"
            className="pixel-btn pixel-btn-success"
            onClick={() => void handleFinalSubmitClick()}
            style={{ padding: '4px 10px', fontSize: '14px' }}
            disabled={spectatorLocked}
          >
            최종제출
          </button>
        ) : !problemSolved ? (
          <button
            type="button"
            className="pixel-btn pixel-btn-success"
            onClick={handleSubmit}
            style={{ padding: '4px 10px', fontSize: '14px' }}
            disabled={spectatorLocked}
          >
            {spectatorLocked ? 'LOCKED' : '제출'}
          </button>
        ) : (
          <button
            type="button"
            className="pixel-btn pixel-btn-success"
            onClick={handleAdvance}
            style={{ padding: '4px 10px', fontSize: '14px' }}
          >
            다음 문제
          </button>
        ))}
      <button type="button" className="pixel-btn pixel-btn-danger" onClick={leaveBattle} style={{ padding: '4px 10px', fontSize: '14px' }}>
        나가기
      </button>
    </div>
  );

  const mainColumn = (
    <div className={`battle-main-column${demoSpectating ? ' is-spectator-my' : ''}`}>
      <div
        className={`pixel-card code-card${itemCastState ? ' casting-item' : ''}${
          isPanelTypeActive(selfPanelEffects, 'paint') ? ' paint-marked' : ''
        }${
          isPanelTypeActive(selfPanelEffects, 'lightning') && !lightningAnimSuppress.self
            ? ' lightning-struck'
            : ''
        }${isPanelTypeActive(selfPanelEffects, 'scribble') ? ' scribble-marked' : ''}${
          isPanelTypeActive(selfPanelEffects, 'lock') ? ' lock-marked' : ''
        }`}
        style={{ position: 'relative' }}
      >
              <div className="pixel-card-header code-card-header-centered">
                <div className="code-card-header-center">
                  <span style={{ color: 'var(--px-primary)' }}>MY CODE</span>
                  <span className="code-card-lang-badge">{langLabel}</span>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="code-card-progress-text">
                    {problemProgressText}
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
                      const buildUnavailable =
                        type === 'buildCharge' && !showBuildPanel;
                      const disabled =
                        !canUseItem(currentCaps, type) ||
                        itemInventory[type] <= 0 ||
                        buildUnavailable;
                      return (
                        <button
                          key={type}
                          type="button"
                          className={`battle-self-item-btn${disabled ? ' is-zero' : ''}`}
                          onClick={() => handleUseSelfItem(type)}
                          disabled={disabled}
                          title={
                            buildUnavailable
                              ? '이 문제에서는 빌드 아이템을 사용할 수 없습니다'
                              : undefined
                          }
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
              {previouslySolved && (
                <div className="battle-item-hint-banner" style={{ color: 'var(--px-warning)' }}>
                  이미 푼 적 있는 문제입니다.
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
                    lang={buildLangKey}
                    langLabel={buildLangLabel}
                    readOnly
                    buildsUsed={buildsUsed}
                    buildsAllowed={buildsAllowed}
                    isBuilding={isBuilding}
                    logs={currentBuildLogs}
                    collapsed={buildPanelCollapsed}
                    disabled={activeLocked}
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
                <div className="opponent-timer-kicker">TIME LEFT</div>
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
                lightningAnimSuppress={lightningAnimSuppress}
                onOpenItemModal={handleOpenItemModal}
                showItemButton={canUseAttackItems}
                itemDisabledByBot={Object.fromEntries(
                  currentBotViews.map((bot) => [
                    bot.id,
                    totalProblems > 0 && (bot.solvedProblems?.length || 0) >= totalProblems,
                  ]),
                )}
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

      {showReviseAskModal && (
        <div className="game-over-overlay" style={{ zIndex: 3150 }}>
          <div className="game-over-box" style={{ maxWidth: '520px', borderColor: 'var(--px-warning)' }}>
            <div className="game-over-text" style={{ fontSize: '20px', color: 'var(--px-warning)', lineHeight: 1.45 }}>
              수정 아이템이 있습니다. 사용하시겠습니까?
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' }}>
              <button type="button" className="pixel-btn pixel-btn-success" onClick={openReviseSelect}>
                예
              </button>
              <button type="button" className="pixel-btn pixel-btn-secondary" onClick={skipReviseAndConfirm}>
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {showReviseSelectModal && (
        <div className="game-over-overlay revise-select-overlay" style={{ zIndex: 3160 }}>
          {showReviseHint && <div className="revise-select-toast">문제를 선택하세요</div>}
          <div className="revise-select-board">
            <div className="revise-select-title">문제를 선택하세요</div>
            <div className="revise-select-sub">
              보유 수정 아이템 {itemInventory.revise}개 · 선택 {selectedReviseProblems.length}개
            </div>
            <div className="revise-select-grid">
              {problems.map((problem, index) => {
                const selected = selectedReviseProblems.includes(index);
                return (
                  <button
                    key={`revise-card-${index}`}
                    type="button"
                    className={`revise-problem-card${selected ? ' is-selected' : ''}`}
                    onClick={() => toggleReviseProblem(index)}
                  >
                    <div className="revise-problem-index">{index + 1}번 문제</div>
                    <div className="revise-problem-title">{problem.title || `문제 ${index + 1}`}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
              <button
                type="button"
                className="pixel-btn pixel-btn-success"
                onClick={() => void confirmReviseSelection()}
                disabled={selectedReviseProblems.length < 1}
              >
                선택 완료
              </button>
              <button type="button" className="pixel-btn pixel-btn-secondary" onClick={skipReviseAndConfirm}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="game-over-overlay" style={{ zIndex: 3100 }}>
          <div className="game-over-box" style={{ maxWidth: '520px', borderColor: 'var(--px-warning)' }}>
            <div className="game-over-text" style={{ fontSize: '22px', color: 'var(--px-warning)', lineHeight: 1.4 }}>
              {finalSubmitKind === 'result' ? '제출 후 결과창으로 넘어갑니다.' : '제출 후 관전 모드로 넘어갑니다.'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' }}>
              <button type="button" className="pixel-btn pixel-btn-success" onClick={() => void finalizeSaveAndSpectate()}>
                확인
              </button>
              <button type="button" className="pixel-btn pixel-btn-secondary" onClick={cancelFinalSubmit}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showResultLeavingModal && (
        <div className="game-over-overlay" style={{ zIndex: 3200 }}>
          <div className="game-over-box" style={{ maxWidth: '520px', borderColor: 'var(--px-warning)' }}>
            <div className="game-over-text" style={{ fontSize: '22px', color: 'var(--px-warning)', lineHeight: 1.4 }}>
              결과창으로 넘어갑니다.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '18px' }}>
              <button type="button" className="pixel-btn pixel-btn-success" onClick={goToResultPage}>
                확인
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

      <RoomAlertModal
        open={Boolean(leaveAlertMessage)}
        message={leaveAlertMessage}
        onClose={() => setLeaveAlertMessage('')}
      />

      <ExitConfirmModal
        open={showLeaveConfirm}
        title="로비 이동"
        message="로비로 이동하시겠습니까?"
        confirmLabel="이동"
        cancelLabel="취소"
        onConfirm={() => void confirmLeaveBattle()}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
