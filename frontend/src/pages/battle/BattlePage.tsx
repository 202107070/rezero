import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BattleChatPanel, { type ChatMessage } from '../../components/battle/BattleChatPanel';
import FillBlankRenderer from '../../components/battle/FillBlankRenderer';
import ProblemVisualPreview from '../../components/battle/ProblemVisualPreview';
import ItemSelectModal from '../../components/battle/ItemSelectModal';
import OpponentPanels, { type BotView } from '../../components/battle/OpponentPanels';
import {
  ATTACK_ITEM_KEYS,
  ITEM_PANEL_EFFECT_MS,
  SELF_ITEM_KEYS,
  type ItemKey,
} from '../../constants/itemTypes';
import { ROUTES } from '../../constants/routes';
import {
  clearBattleAndLeave,
  getSessionId,
  markProblemSubmitted,
  persistBattleSession,
  persistBattleSubmission,
  restoreBattleSession,
  saveRoomUsers,
  syncBattleDemoState,
} from '../../services/battleSessionService';
import type { BattleProblem, ItemInventory, RoomUser } from '../../types/battle';
import { getBotSolveDelay } from '../../utils/battle/demoBots';
import { loadAudioSettings } from '../../utils/audio/audioSettings';
import { applyAudioSettings, BattleBGM, LobbyBGM, SFX } from '../../utils/audio/gameAudio';
import { comparePlayersByRank } from '../../utils/resultUtils';
import {
  clearPaintCanvas,
  clearScribbleCanvas,
  startPaintCanvas,
  startScribbleCanvas,
} from '../../utils/battle/canvasEffects';
import { assembleCode, DEFAULT_TEMPLATE, getLangKey, getLangLabel, getTotalBattleSeconds } from '../../utils/battle/codeUtils';
import { isBlankBasedType } from '../../utils/problemTypeUtils';
import {
  areAllBotsSolvedOnPlayerProblem,
  createDemoBattleRoster,
  getBotSchedule,
  getBotSolvedProblemsFromElapsed,
  getBotWorkingProblemIndexFromElapsed,
  isBotProblemSolvedByElapsed,
  type DemoBot,
} from '../../utils/battle/demoBots';
import { formatTime } from '../../utils/battle/formatTime';
import './battle.css';

const DEFAULT_ITEMS: ItemInventory = {
  paint: 40,
  revealLength: 40,
  revealPrev: 40,
  lightning: 40,
  timeReduce: 40,
  scribble: 40,
  blankBreak: 40,
};

export default function BattlePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const freshStart = params.get('fresh') === '1';
  const roomId = params.get('roomId') || '';
  const roomMode = params.get('mode') || '1/1';
  const battleMeta = useMemo(() => {
    try {
      const stored = localStorage.getItem('battleSettings');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);
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
  const battleDiff = battleMeta.diff || 'NORMAL';
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
    () => getTotalBattleSeconds(battleDiff, Math.max(1, problems.length || parseInt(battleMeta.count, 10) || 5)),
    [battleDiff, problems.length, battleMeta.count],
  );
  const [remaining, setRemaining] = useState(() =>
    getTotalBattleSeconds(battleDiff, Math.max(1, parseInt(battleMeta.count, 10) || 5)),
  );
  const [elapsedSec, setElapsedSec] = useState(0);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showClearFlash, setShowClearFlash] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceReason, setAdvanceReason] = useState('time');
  const [demoSpectating, setDemoSpectating] = useState(false);
  const [spectatorLocked, setSpectatorLocked] = useState(false);
  const [battleFinished, setBattleFinished] = useState(false);
  const [battleBots, setBattleBots] = useState<DemoBot[]>([]);
  const [expandedOpponentId, setExpandedOpponentId] = useState<string | null>(null);
  const [problemCollapsed, setProblemCollapsed] = useState(true);
  const [localSolvedProblems, setLocalSolvedProblems] = useState<number[]>([]);
  const [blankAnswers, setBlankAnswers] = useState<string[][]>([]);
  const [correctBlanks, setCorrectBlanks] = useState<Record<number, Record<number, boolean>>>({});
  const [comboCount, setComboCount] = useState(0);
  const [ingameScore, setIngameScore] = useState(0);
  const [solveTimes, setSolveTimes] = useState<Record<number, number>>({});
  const [myRatingScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('rocky_rating_score') || '1000', 10) || 1000;
    } catch {
      return 1000;
    }
  });
  const [problemSolved, setProblemSolved] = useState(false);
  const [problemStartTime, setProblemStartTime] = useState(Date.now());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [wrongChoice, setWrongChoice] = useState<number | null>(null);
  const [revealHint, setRevealHint] = useState<string | null>(null);
  const [breakingBlanks, setBreakingBlanks] = useState<Record<string, boolean>>({});
  const [itemCastState, setItemCastState] = useState<{ type: string; ts: number } | null>(null);
  const [panelHit, setPanelHit] = useState<Record<string, boolean>>({});
  const [showItemModal, setShowItemModal] = useState(false);
  const [opponentEffects, setOpponentEffects] = useState<
    Record<string, Record<number, { panelEffect?: { type: string; expiresAt: number } }>>
  >({});
  const [itemInventory, setItemInventory] = useState<ItemInventory>(() => {
    try {
      const stored = localStorage.getItem('rocky_items');
      return stored ? { ...DEFAULT_ITEMS, ...JSON.parse(stored) } : { ...DEFAULT_ITEMS };
    } catch {
      return { ...DEFAULT_ITEMS };
    }
  });
  const [sessionSavedSnapshot, setSessionSavedSnapshot] = useState('');
  const [, setSaveStatus] = useState<'saving' | 'saved' | 'unsaved'>('saved');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { sender: 'SYSTEM', text: '배틀 시작! 서로 화이팅 하세요.', mode: '', time: '' },
  ]);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMode, setChatMode] = useState('ALL');
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemTargetBotIdRef = useRef<string | null>(null);
  const advanceQueuedRef = useRef(false);
  const gameOverNavRef = useRef(false);
  const saveModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mistakeOnCurrentRef = useRef(false);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSessionLoadedRef = useRef(false);
  const initialSessionSaveQueuedRef = useRef(false);
  const lastTimedPersistRemainingRef = useRef(-1);
  const itemInventoryInitialized = useRef(false);

  const currentProblem = problems[currentIndex] || ({} as BattleProblem);
  const currentProblemLocked = localSolvedProblems.includes(currentIndex);
  const hasProblems = problems.length > 0;
  const totalProblems = hasProblems ? problems.length : 1;
  const currentProblemNumber = hasProblems ? currentIndex + 1 : 0;
  const problemProgressText = hasProblems ? `${currentProblemNumber}/${totalProblems}` : '0/1';
  const progressPercent = hasProblems ? (currentProblemNumber / totalProblems) * 100 : 0;

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
    const meScore = (() => {
      const n = localSolvedProblems.length;
      return n > 0 ? n * 1000 + 50 * n * (n - 1) : ingameScore;
    })();
    const meTotalSolveTime = Object.values(solveTimes).reduce((s, t) => s + t, 0);
    return [
      {
        id: 'me',
        name: 'rocky_user',
        avatar: '😎',
        problem: currentProblemNumber,
        solvedCount: localSolvedProblems.length,
        solvedProblems: localSolvedProblems,
        ingameScore: meScore,
        totalSolveTime: meTotalSolveTime,
        completionTime: meTotalSolveTime > 0 ? meTotalSolveTime : Number.POSITIVE_INFINITY,
      },
      ...currentBotViews.map((bot) => {
        const n = bot.solvedProblems.length;
        const botScore = n > 0 ? n * 1000 + 50 * n * (n - 1) : 0;
        const botTotalSolveTime = bot.solvedProblems.reduce(
          (sum, pi) => sum + getBotSolveDelay(bot, pi, totalBattleSeconds),
          0,
        );
        const lastSolvedIdx = bot.solvedProblems.length > 0 ? Math.max(...bot.solvedProblems) : -1;
        const completionTime =
          lastSolvedIdx >= 0
            ? getBotSolveDelay(bot, lastSolvedIdx, totalBattleSeconds)
            : Number.POSITIVE_INFINITY;
        return {
          id: bot.id,
          name: bot.name,
          avatar: bot.avatar,
          problem: bot.currentProblem + 1,
          solvedCount: bot.solvedProblems.length,
          solvedProblems: bot.solvedProblems,
          status: bot.status,
          ingameScore: botScore,
          totalSolveTime: botTotalSolveTime,
          completionTime,
        };
      }),
    ];
  }, [currentBotViews, currentProblemNumber, totalBattleSeconds, ingameScore, localSolvedProblems, solveTimes]);

  const rankedUsers = useMemo(
    () =>
      [...roomUsers].sort((a, b) =>
        comparePlayersByRank(
          {
            ingameScore: a.ingameScore || 0,
            completionTime: a.completionTime ?? Number.POSITIVE_INFINITY,
            totalSolveTime: a.totalSolveTime || 0,
          },
          {
            ingameScore: b.ingameScore || 0,
            completionTime: b.completionTime ?? Number.POSITIVE_INFINITY,
            totalSolveTime: b.totalSolveTime || 0,
          },
        ),
      ),
    [roomUsers],
  );

  const userRankMap = useMemo(() => {
    const map: Record<string, number> = {};
    rankedUsers.forEach((u, i) => {
      map[u.id] = i + 1;
    });
    return map;
  }, [rankedUsers]);

  const myRank = userRankMap.me || '?';

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
        demoSpectating,
        spectatorLocked,
        battleBots,
        selectedDemoBotCode,
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
      demoSpectating,
      spectatorLocked,
      battleBots,
      selectedDemoBotCode,
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
      const stored = localStorage.getItem('battleProblems');
      const parsed = stored ? JSON.parse(stored) : null;
      const baseProblems = Array.isArray(parsed) && parsed.length > 0 ? parsed : [fallback];
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
          if (restored.problems) setProblems(restored.problems);
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
    const timer = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    if (advanceQueuedRef.current || showAdvanceModal) return;

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
      const playerFinalSubmitted = demoSpectating || spectatorLocked;
      if (timeUp || (allBotsSolved && playerFinalSubmitted)) {
        setBattleFinished(true);
        setShowGameOver(true);
        doPersistSubmission(answers, currentIndex);
      }
      return;
    }

    const reason = timeUp ? 'time' : 'all-clear';
    setAdvanceReason(reason);
    queueAdvanceProblem(reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, currentIndex, problems.length, battleBots, elapsedSec, totalBattleSeconds, currentProblemLocked, battleFinished, showAdvanceModal, demoSpectating, spectatorLocked]);

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
    saveRoomUsers(roomUsers);
    doPersistSubmission(answers, currentIndex);
    const t = setTimeout(() => {
      navigate(`${ROUTES.RESULT}?roomId=${roomId}`);
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGameOver]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      doPersistSession(answers).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, doPersistSession]);

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (saveModalTimerRef.current) clearTimeout(saveModalTimerRef.current);
      if (clearFlashTimerRef.current) clearTimeout(clearFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!itemInventoryInitialized.current) {
      itemInventoryInitialized.current = true;
      return;
    }
    localStorage.setItem('rocky_items', JSON.stringify(itemInventory));
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

  const queueAdvanceProblem = (reason = 'time') => {
    if (showAdvanceModal || battleFinished) return;
    setShowAdvanceModal(true);
    syncBattleDemoState(sessionId, { event: 'advance-queued', reason, currentIndex, remaining });
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceQueuedRef.current = true;
    advanceTimerRef.current = setTimeout(() => {
      setShowAdvanceModal(false);
      advanceQueuedRef.current = false;
      if (currentIndex >= problems.length - 1) {
        setBattleFinished(true);
        setShowGameOver(true);
        doPersistSubmission(answers, currentIndex);
        return;
      }
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
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
    }, 3000);
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

  const handleBlankEnter = (blankIndex: number, e: React.KeyboardEvent) => {
    if (demoSpectating || spectatorLocked || problemSolved) return;
    e.preventDefault();
    if (!isBlankBasedType(currentProblem.type)) return;
    const blanks = blankAnswers[currentIndex] || [];
    const correct = currentProblem.answer?.[langKey] || [];
    const u = String(blanks[blankIndex] || '').trim().toLowerCase();
    const c = String(correct[blankIndex] || '').trim().toLowerCase();
    if (u === c) {
      setCorrectBlanks((prev) => ({
        ...prev,
        [currentIndex]: { ...(prev[currentIndex] || {}), [blankIndex]: true },
      }));
    }
  };

  const allBlanksCorrect = () => {
    if (!isBlankBasedType(currentProblem.type)) return false;
    const correct = currentProblem.answer?.[langKey] || [];
    const saved = correctBlanks[currentIndex] || {};
    for (let i = 0; i < correct.length; i++) {
      if (!saved[i]) return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (demoSpectating || spectatorLocked || problemSolved) return;
    if (isBlankBasedType(currentProblem.type)) {
      if (!allBlanksCorrect()) return;
      const newCombo = comboCount + 1;
      const earnedScore = 1000 + 100 * (newCombo - 1);
      const elapsed = (Date.now() - problemStartTime) / 1000;
      setComboCount(newCombo);
      setIngameScore((prev) => prev + earnedScore);
      setSolveTimes((prev) => ({ ...prev, [currentIndex]: elapsed }));
      setProblemSolved(true);
    } else if (currentProblem.type === 'short_answer') {
      const u = String(blankAnswers[currentIndex]?.[0] || '').trim().toLowerCase();
      const c = String(currentProblem.answer?.[langKey]?.[0] || '').trim().toLowerCase();
      if (u === c) {
        const hadMistake = mistakeOnCurrentRef.current;
        const newCombo = hadMistake ? 0 : comboCount + 1;
        const earnedScore = 1000 + (hadMistake ? 0 : 100 * (newCombo - 1));
        const elapsed = (Date.now() - problemStartTime) / 1000;
        setComboCount(newCombo);
        setIngameScore((prev) => prev + earnedScore);
        setSolveTimes((prev) => ({ ...prev, [currentIndex]: elapsed }));
        setProblemSolved(true);
      } else {
        setComboCount(0);
        mistakeOnCurrentRef.current = true;
      }
    }
  };

  const handleAdvance = () => {
    if (currentIndex >= problems.length - 1) {
      lockAndSpectate();
      return;
    }
    setCurrentIndex(currentIndex + 1);
    setProblemSolved(false);
    setSelectedOption(null);
    setWrongChoice(null);
    setProblemStartTime(Date.now());
    mistakeOnCurrentRef.current = false;
  };

  const onSubmitChoice = (idx: number) => {
    if (problemSolved) return;
    if (idx === currentProblem.correctIndex) {
      const hadMistake = wrongChoice !== null || mistakeOnCurrentRef.current;
      const newCombo = hadMistake ? 0 : comboCount + 1;
      const earnedScore = 1000 + (hadMistake ? 0 : 100 * (newCombo - 1));
      const elapsed = (Date.now() - problemStartTime) / 1000;
      setSelectedOption(idx);
      setWrongChoice(null);
      setComboCount(newCombo);
      setIngameScore((prev) => prev + earnedScore);
      setSolveTimes((prev) => ({ ...prev, [currentIndex]: elapsed }));
      setProblemSolved(true);
    } else {
      setWrongChoice(idx);
      setComboCount(0);
      mistakeOnCurrentRef.current = true;
    }
  };

  const handleUseSelfItem = (type: keyof ItemInventory) => {
    if (!isItemMode || !selectedItemKeys.has(type)) return;
    if (itemInventory[type] <= 0) return;
    if (currentProblem.type === 'multiple_choice') return;
    if (currentProblem.type === 'short_answer' && type === 'blankBreak') return;
    const correct = currentProblem.answer?.[langKey] || [];
    if (type === 'revealLength') {
      const idx = Math.floor(Math.random() * correct.length);
      setRevealHint(correct[idx] ? `[${correct[idx].length}자]` : '(정보 없음)');
    } else if (type === 'revealPrev') {
      const idx = Math.floor(Math.random() * correct.length);
      setRevealHint(correct[idx] ? `[앞글자: ${correct[idx][0] || '?'}]` : '(정보 없음)');
    } else if (type === 'blankBreak') {
      applyBlankBreak(correct);
      return;
    }
    setItemInventory((prev) => ({ ...prev, [type]: prev[type] - 1 }));
    SFX.play(type);
  };

  const applyBlankBreak = (correct: string[]) => {
    const partial = currentProblem.question || '';
    if (currentProblem.type === 'short_answer') {
      setBreakingBlanks((prev) => ({ ...prev, [`${currentIndex}_0`]: true }));
      setTimeout(() => {
        setBlankAnswers((prev) => {
          const next = prev.map((a) => [...a]);
          if (!next[currentIndex]) next[currentIndex] = [];
          next[currentIndex][0] = correct[0] || '';
          return next;
        });
        setCorrectBlanks((prev) => ({ ...prev, [currentIndex]: { ...(prev[currentIndex] || {}), 0: true } }));
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
    const solved = correctBlanks[currentIndex] || {};
    const unsolved: number[] = [];
    for (let i = 0; i < blankCount; i++) {
      if (!solved[i]) unsolved.push(i);
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
      setCorrectBlanks((prev) => ({ ...prev, [currentIndex]: { ...(prev[currentIndex] || {}), [blankIdx]: true } }));
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
    setOpponentEffects((prev) => ({
      ...prev,
      [botId]: {
        ...(prev[botId] || {}),
        [currentIndex]: {
          ...(prev[botId]?.[currentIndex] || {}),
          panelEffect: { type, expiresAt: Date.now() + ITEM_PANEL_EFFECT_MS },
        },
      },
    }));
  };

  const runPanelCanvasEffect = (botId: string, type: 'paint' | 'scribble') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const panelEl = document.querySelector('.opponent-code-panel-mini.expanded .mini-code-lines');
        if (!panelEl) return;
        if (type === 'paint') startPaintCanvas(panelEl as HTMLElement, botId);
        else startScribbleCanvas(panelEl as HTMLElement, botId, ITEM_PANEL_EFFECT_MS);
      });
    });
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
    const modeLabel = chatMode === 'ALL' ? '[전체]' : '[친구]';
    setChatMessages((prev) => [...prev, { sender: 'rocky_user', text: chatMsg, mode: modeLabel, time: timeStr }]);
    setChatMsg('');
  };

  const leaveBattle = () => {
    clearBattleAndLeave(sessionId, roomId);
    navigate(ROUTES.LOBBY);
  };

  const renderMiniStatus = (bot: BotView) => {
    const solvedCount = Math.min(bot.solvedProblems?.length || 0, totalProblems);
    const n = solvedCount;
    const botScore = n > 0 ? n * 1000 + 50 * n * (n - 1) : 0;
    return (
      <div className="mini-status-row">
        <div className="mini-status-top">
          <span style={{ color: 'var(--px-success)' }}>{botScore.toLocaleString()} PTS</span>
          <span>
            {solvedCount}/{totalProblems}
          </span>
          <span>{Math.round((solvedCount / Math.max(1, totalProblems)) * 100)}%</span>
        </div>
        <div className="mini-status-checks">
          {Array.from({ length: totalProblems }).map((_, idx) => {
            const checked = bot.solvedProblems?.includes(idx);
            return (
              <span
                key={`${bot.id}-mini-${idx}`}
                className={`mini-problem-check ${checked ? 'filled' : ''}`}
                title={`${idx + 1}번 문제`}
              >
                {checked ? '✓' : ''}
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

  return (
    <div className="page-container battle-page">
      <div className="battle-layout">
        <div className="battle-workspace">
          <div className="battle-main-column">
            <div className={`pixel-card code-card${itemCastState ? ' casting-item' : ''}`} style={{ position: 'relative' }}>
              <div className="pixel-card-header code-card-header-centered">
                <div className="code-card-header-center">
                  <span style={{ color: 'var(--px-primary)' }}>MY CODE</span>
                  <span className="code-card-lang-badge">{langLabel}</span>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="code-card-progress-text">{problemProgressText}</span>
                </div>
              </div>
              <div
                style={{
                  padding: '4px 12px 3px',
                  fontSize: '17px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.15)',
                  borderBottom: '2px solid var(--px-border)',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  내 등수: <span style={{ color: 'var(--px-warning)' }}>#{myRank}</span>
                </span>
                {comboCount > 0 && (
                  <span style={{ color: '#ff6b35', fontSize: '15px', textShadow: '1px 1px 0 #000' }}>
                    🔥 {comboCount} COMBO
                  </span>
                )}
                <span>
                  점수: <span style={{ color: 'var(--px-success)' }}>{(ingameScore || 0).toLocaleString()} PTS</span>
                </span>
                {isItemMode && selectedSelfItems.length > 0 && (
                  <>
                    <span style={{ color: '#aaa', marginLeft: 'auto' }}>내 아이템:</span>
                    {selectedSelfItems.map((type) => {
                      const meta =
                        type === 'revealLength'
                          ? { icon: '📏', name: '글자수' }
                          : type === 'revealPrev'
                            ? { icon: '🔍', name: '앞글자' }
                            : { icon: '🔨', name: '깨기' };
                      const disabled =
                        currentProblem.type === 'multiple_choice' ||
                        itemInventory[type] <= 0 ||
                        (currentProblem.type === 'short_answer' && type === 'blankBreak');
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleUseSelfItem(type)}
                          disabled={disabled}
                          style={{
                            background: '#1a1e21',
                            border: '2px solid var(--px-border)',
                            color: disabled ? '#555' : 'var(--px-success)',
                            fontFamily: 'var(--font-pixel)',
                            fontSize: '17px',
                            padding: '1px 6px',
                            filter: itemInventory[type] <= 0 ? 'grayscale(1)' : undefined,
                          }}
                        >
                          {meta.icon} {meta.name} ({itemInventory[type]})
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
              {revealHint && (
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '21px',
                    background: 'rgba(247,213,29,0.15)',
                    borderBottom: '2px solid var(--px-warning)',
                    color: 'var(--px-warning)',
                    textAlign: 'center',
                  }}
                >
                  💡 힌트: {revealHint}
                </div>
              )}
              <div key="problem-summary" className="code-problem-summary" style={{ height: problemCollapsed ? 105 : 180 }}>
                <div className="code-problem-head">
                  <div className="code-problem-copy">
                    <div className="code-problem-kicker">PROBLEM</div>
                    <div className="code-problem-title">{currentProblem.title || 'Loading...'}</div>
                  </div>
                  <button
                    type="button"
                    className="panel-toggle-btn"
                    onClick={() => setProblemCollapsed(!problemCollapsed)}
                    style={{ flexShrink: 0 }}
                  >
                    {problemCollapsed ? '▼' : '▲'}
                  </button>
                </div>
                <div className="code-problem-body">
                  <div>{currentProblem.explanation || ''}</div>
                </div>
              </div>
              {isBlankBasedType(currentProblem.type) && (
                <div className="fill-blank-area">
                  {currentProblem.visual && (
                    <ProblemVisualPreview visual={currentProblem.visual} />
                  )}
                  <div className="fill-blank-code">
                    <FillBlankRenderer
                      code={currentProblem.question || ''}
                      answers={blankAnswers[currentIndex] || []}
                      problemIndex={currentIndex}
                      correctBlanks={correctBlanks[currentIndex] || {}}
                      breakingBlanks={breakingBlanks}
                      isLocked={isLocked}
                      onUpdate={(i, v) => updateBlankAnswer(currentIndex, i, v)}
                      onEnter={handleBlankEnter}
                    />
                  </div>
                </div>
              )}
              {currentProblem.type === 'multiple_choice' && (
                <div className="fill-blank-area">
                  {currentProblem.visual && <ProblemVisualPreview visual={currentProblem.visual} compact />}
                  <div className="fill-blank-question">{currentProblem.question}</div>
                  {(currentProblem.options || []).map((opt, i) => {
                    const isCorrect = problemSolved && i === currentProblem.correctIndex;
                    const isWrong = !problemSolved && wrongChoice === i;
                    const isSelected = selectedOption === i;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`pixel-btn battle-choice-btn${problemSolved ? ' is-locked' : ''}`}
                        onClick={() => {
                          if (!problemSolved) onSubmitChoice(i);
                        }}
                        style={{
                          background: isCorrect
                            ? 'rgba(146,204,65,0.35)'
                            : isWrong
                              ? 'rgba(231,76,60,0.35)'
                              : isSelected
                                ? 'rgba(52,152,219,0.25)'
                                : '#2c3e50',
                          borderColor: isCorrect
                            ? 'var(--px-success)'
                            : isWrong
                              ? 'var(--px-danger)'
                              : isSelected
                                ? '#3498db'
                                : 'var(--px-primary)',
                          color: isCorrect || isWrong ? '#fff' : '#e0e0e0',
                          opacity: problemSolved && i !== currentProblem.correctIndex ? 0.5 : 1,
                        }}
                      >
                        {String.fromCharCode(65 + i)}. {opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {currentProblem.type === 'short_answer' && (
                <div className="fill-blank-area">
                  {currentProblem.visual && <ProblemVisualPreview visual={currentProblem.visual} compact />}
                  <div className="fill-blank-question">{currentProblem.question}</div>
                  <input
                    className="blank-input battle-short-input"
                    value={blankAnswers[currentIndex]?.[0] || ''}
                    onChange={(e) => updateBlankAnswer(currentIndex, 0, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                    disabled={problemSolved}
                  />
                  {problemSolved && (
                    <div
                      className="battle-feedback-text"
                      style={{
                        color:
                          blankAnswers[currentIndex]?.[0]?.trim()?.toLowerCase() ===
                          (currentProblem.answer?.[langKey]?.[0] || '').trim().toLowerCase()
                            ? 'var(--px-success)'
                            : 'var(--px-danger)',
                      }}
                    >
                      {blankAnswers[currentIndex]?.[0]?.trim()?.toLowerCase() ===
                      (currentProblem.answer?.[langKey]?.[0] || '').trim().toLowerCase()
                        ? '정답!'
                        : `오답 (정답: ${currentProblem.answer?.[langKey]?.[0] || ''})`}
                    </div>
                  )}
                </div>
              )}
            </div>
            {demoSpectating && !showSaveModal && !showClearFlash && !showGameOver && (
              <BattleChatPanel
                messages={chatMessages}
                chatMsg={chatMsg}
                chatMode={chatMode}
                onMsgChange={setChatMsg}
                onModeChange={setChatMode}
                onSend={handleSendChat}
              />
            )}
          </div>

          <div className="battle-opponent-column">
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
                currentProblemLocked={currentProblemLocked}
                currentIndex={currentIndex}
                problems={problems}
                currentProblem={currentProblem}
                userRankMap={userRankMap}
                opponentEffects={opponentEffects}
                panelHit={panelHit}
                onOpenItemModal={handleOpenItemModal}
                showItemButton={canUseAttackItems}
                renderMiniStatus={renderMiniStatus}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', padding: '0 4px 2px', flexShrink: 0, marginTop: '6px' }}>
              {!problemSolved ? (
                <button
                  type="button"
                  className="pixel-btn pixel-btn-success"
                  onClick={handleSubmit}
                  style={{ padding: '4px 10px', fontSize: '14px' }}
                  disabled={demoSpectating || spectatorLocked || (isBlankBasedType(currentProblem.type) && !allBlanksCorrect())}
                >
                  {demoSpectating || spectatorLocked ? 'LOCKED' : '제출'}
                </button>
              ) : (
                <button
                  type="button"
                  className="pixel-btn pixel-btn-success"
                  onClick={handleAdvance}
                  style={{ padding: '4px 10px', fontSize: '14px' }}
                >
                  {currentIndex >= problems.length - 1 ? '최종 제출' : '다음 문제'}
                </button>
              )}
              <button type="button" className="pixel-btn pixel-btn-danger" onClick={leaveBattle} style={{ padding: '4px 10px', fontSize: '14px' }}>
                나가기
              </button>
            </div>
          </div>
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

      {showAdvanceModal && !showGameOver && (
        <div className="game-over-overlay" style={{ zIndex: 3050 }}>
          <div className="game-over-box" style={{ maxWidth: '520px', borderColor: 'var(--px-primary)' }}>
            <div className="game-over-text" style={{ fontSize: '26px', color: 'var(--px-primary)' }}>
              다음 문제로 넘어갑니다
            </div>
            <div className="game-over-sub" style={{ marginBottom: '18px' }}>
              {advanceReason === 'time' ? '시간이 종료되었습니다.' : '모두 클리어했습니다!'}
            </div>
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
          allowedTypes={selectedAttackItems}
          onSelect={handleSelectItemType}
          onClose={handleCloseItemModal}
        />
      )}
    </div>
  );
}
