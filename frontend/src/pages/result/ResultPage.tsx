import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AiReviewerPanel, type AiMessage } from '../../components/result/AiReviewerPanel/AiReviewerPanel';
import { ResultActionBar } from '../../components/result/ResultActionBar/ResultActionBar';
import { ResultChatPanel } from '../../components/result/ResultChatPanel/ResultChatPanel';
import { ResultPopup } from '../../components/result/ResultPopup/ResultPopup';
import { ResultRankingPanel } from '../../components/result/ResultRankingPanel/ResultRankingPanel';
import { ResultReviewFooter } from '../../components/result/ResultReviewFooter/ResultReviewFooter';
import { ResultTeamPanel } from '../../components/result/ResultTeamPanel/ResultTeamPanel';
import { ReviewInviteModal } from '../../components/result/ReviewInviteModal/ReviewInviteModal';
import { ReviewProblemView } from '../../components/result/ReviewProblemView/ReviewProblemView';
import { checkNewTitles, loadTitles, saveTitles, type TitleDef } from '../../constants/titleTypes';
import { ROUTES } from '../../constants/routes';
import { ENABLE_RESULT_BOT_DEPARTURE, MY_RESULT_USER_ID, REVIEW_BOT_ACCEPT_DELAY_MS } from '../../constants/resultConstants';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { clearBattleAndLeave, getSessionId, readFinalRankingSnapshot } from '../../services/battleSessionService';
import {
  clearReviewInvite,
  createReviewInviteId,
  persistReviewInvite,
  scheduleReviewInviteResponse,
  shouldAutoAcceptReviewInvite,
} from '../../services/reviewSessionService';
import type { DemoBot } from '../../utils/battle/demoBots';
import { normalizeCodeHistoryEntry, persistCodeHistory, readCodeHistory } from '../../utils/codeHistoryUtils';
import { buildResultPlayers } from '../../utils/resultUtils';
import './result.css';

interface BattleSubmission {
  ingameScore?: number;
  myRatingScore?: number;
  solveTimes?: Record<number, number>;
  mode?: string;
  lang?: string;
  codes?: string[];
  answers?: string[];
  problems?: Array<{
    title?: string;
    question?: string;
    explanation?: string;
    answer?: Record<string, string[]>;
    options?: string[];
  }>;
  submittedAt?: string;
  roomId?: string;
  historyId?: string;
  code?: string;
  problemResults?: boolean[];
}

interface DemoState {
  mode?: string;
  lang?: string;
  roundSeconds?: number;
  remaining?: number;
  ingameScore?: number;
  solveTimes?: Record<number, number>;
  localSolvedProblems?: number[];
  finishedAtElapsedSec?: number;
  battleBots?: DemoBot[];
}

interface OnlineUser {
  id?: string;
  name?: string;
  avatar?: string;
}

const MY_USER_ID = MY_RESULT_USER_ID;

type ReviewPhase = 'idle' | 'selecting' | 'reviewing';

function removeMyPresence(): void {
  try {
    const stored = localStorage.getItem('roomUsers');
    if (!stored) return;
    const users = JSON.parse(stored) as OnlineUser[];
    const filtered = users.filter((u) => !u.name?.includes(MY_USER_ID));
    localStorage.setItem('roomUsers', JSON.stringify(filtered));
  } catch {
    /* ignore */
  }
}

function readOnlineUsers(): OnlineUser[] {
  try {
    const stored = localStorage.getItem('roomUsers');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function ResultPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const sessionId = getSessionId(roomId);

  const submission = useMemo((): BattleSubmission => {
    try {
      return JSON.parse(localStorage.getItem('battleSubmission') || '{}');
    } catch {
      return {};
    }
  }, []);

  const demoState = useMemo((): DemoState | null => {
    try {
      return JSON.parse(localStorage.getItem(`battleDemoState_${sessionId}`) || 'null');
    } catch {
      return null;
    }
  }, [sessionId]);

  const rankingSnapshot = useMemo(() => readFinalRankingSnapshot(sessionId), [sessionId]);

  const roomUsers = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('roomUsers') || 'null');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, []);

  const demoBots = useMemo(
    () => (Array.isArray(demoState?.battleBots) ? demoState.battleBots : []) as DemoBot[],
    [demoState],
  );

  const roomMode = submission?.mode || demoState?.mode || '1/1';
  const isVersusMany = roomMode !== '1/1';
  const lang = submission.lang || demoState?.lang || 'JAVA';

  const allPlayers = useMemo(
    () => buildResultPlayers({ rankingSnapshot, roomUsers, demoBots, submission, demoState }),
    [rankingSnapshot, roomUsers, demoBots, submission, demoState],
  );

  const myScore = allPlayers.find((p) => p.id === MY_USER_ID)?.ingameScore || 0;
  const earnedGold = Math.floor(myScore / 10);
  const myRank = allPlayers.findIndex((p) => p.id === MY_USER_ID) + 1;
  const rankBorderColor =
    myRank === 1 ? 'var(--px-warning)' : myRank === allPlayers.length ? 'var(--px-danger)' : 'var(--px-success)';
  const rankGlow =
    myRank === 1
      ? '0 0 0 4px #000, 0 0 30px rgba(247,213,29,0.3)'
      : myRank === allPlayers.length
        ? '0 0 0 4px #000, 0 0 30px rgba(231,110,85,0.3)'
        : '0 0 0 4px #000, 0 0 30px rgba(146,204,65,0.3)';
  const isWin = myRank <= Math.ceil(allPlayers.length / 2);
  const totalProblemCount =
    submission.problemResults?.length ||
    submission.problems?.length ||
    allPlayers.find((p) => p.id === MY_USER_ID)?.problemResults?.length ||
    0;
  const myCorrectCount =
    allPlayers.find((p) => p.id === MY_USER_ID)?.problemResults?.filter(Boolean).length ?? 0;

  const [totalGold, setTotalGold] = useState(() => {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEYS.ROCKY_GOLD) || '0', 10) || 0;
    } catch {
      return 0;
    }
  });

  const [resultPopup, setResultPopup] = useState<{
    show: boolean;
    mainMsg: string;
    detailLines: string[];
    newTitles: TitleDef[];
  }>({ show: false, mainMsg: '', detailLines: [], newTitles: [] });

  const [isAiOpen, setIsAiOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState([
    { sender: 'SYSTEM', text: '매치가 종료되었습니다.', type: 'sys' as const },
    { sender: '알고리즘깎는노인', text: '수고하셨습니다.', type: 'user' as const },
    { sender: MY_USER_ID, text: '고생하셨습니다!', type: 'user' as const },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState('ALL');

  const [aiMessages, setAiMessages] = useState<AiMessage[]>([
    {
      type: 'system',
      text: '안녕하세요! 이번 대결에 대한 피드백이 필요하신가요? 작성하신 코드의 시간 복잡도나 개선점을 분석해 드릴 수 있습니다.',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [departedUserIds, setDepartedUserIds] = useState<Set<string>>(() => new Set());

  const [reviewPhase, setReviewPhase] = useState<ReviewPhase>('idle');
  const [selectedReviewProblems, setSelectedReviewProblems] = useState<Set<number>>(() => new Set());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteWaiting, setInviteWaiting] = useState(false);
  const [reviewPartnerId, setReviewPartnerId] = useState<string | null>(null);
  const botAcceptTimerRef = useRef<(() => void) | null>(null);

  const reviewSelectMode = reviewPhase === 'selecting';

  const mySubmissionCodes = Array.isArray(submission.codes)
    ? submission.codes
    : Array.isArray(submission.answers)
      ? submission.answers
      : [];
  const winners = allPlayers.slice(0, Math.max(1, Math.ceil(allPlayers.length / 2)));
  const losers = allPlayers.slice(Math.ceil(allPlayers.length / 2));

  useEffect(() => {
    try {
      const storedGold = parseInt(localStorage.getItem(STORAGE_KEYS.ROCKY_GOLD) || '0', 10) || 0;
      const newGold = storedGold + earnedGold;
      localStorage.setItem(STORAGE_KEYS.ROCKY_GOLD, String(newGold));
      setTotalGold(newGold);
    } catch (e) {
      console.error('골드 저장 실패:', e);
    }
  }, [earnedGold]);

  useEffect(() => {
    const prev = loadTitles();
    const newStats = { ...prev.stats };
    newStats.totalGames += 1;

    if (isWin) {
      newStats.totalWins = (prev.stats.totalWins || 0) + 1;
      newStats.consecutiveWins = (prev.stats.consecutiveWins || 0) + 1;
      newStats.langWins = { ...prev.stats.langWins, [lang]: ((prev.stats.langWins || {})[lang] || 0) + 1 };
    } else {
      newStats.consecutiveWins = 0;
    }
    if (totalProblemCount > 0 && myCorrectCount >= totalProblemCount) newStats.perfectGame = true;

    const updated = { ...prev, stats: newStats };
    const newTitles = checkNewTitles(updated, newStats);
    saveTitles(updated);
    localStorage.setItem('rocky_new_titles', JSON.stringify(newTitles.map((t) => t.id)));

    const totalPlayers = allPlayers.length;
    let mainMsg = '';

    if (myRank === totalPlayers) {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등(꼴등)입니다.`;
    } else if (myRank === 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 1등입니다.`;
    } else {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등입니다.`;
    }

    const detailLines: string[] = [];

    if (totalProblemCount > 0) {
      detailLines.push(`${totalProblemCount}문제 중 ${myCorrectCount}문제를 맞췄습니다.`);
    }

    if (myRank === 1 && newStats.consecutiveWins >= 3) {
      detailLines.push(`🔥 ${newStats.consecutiveWins}연속 우승!`);
    }
    if (totalProblemCount > 0 && myCorrectCount >= totalProblemCount && myRank !== totalPlayers) {
      detailLines.push('모든 문제를 맞췄습니다! 👏');
    }
    if (myCorrectCount === 0 && myRank === totalPlayers) {
      detailLines.push('한 문제도 맞추지 못했습니다. 기본기를 다시 다져보세요.');
    }

    setResultPopup({ show: true, mainMsg, detailLines, newTitles });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      if (!submission?.submittedAt) return;
      const entry = normalizeCodeHistoryEntry({
        historyId: submission.historyId || `${submission.roomId || roomId || 'solo'}::${submission.submittedAt}`,
        roomId: submission.roomId || roomId || '',
        submittedAt: submission.submittedAt,
        lang: submission.lang || 'JAVA',
        problems: Array.isArray(submission.problems) ? submission.problems : [],
        codes: mySubmissionCodes,
        code: submission.code || mySubmissionCodes[0] || '',
        mode: submission.mode,
      });
      if (!entry) return;
      const history = readCodeHistory().filter((item) => item.historyId !== entry.historyId);
      persistCodeHistory([entry, ...history].slice(0, 50));
    } catch (e) {
      console.error('코드 히스토리 저장 실패:', e);
    }
  }, [roomId, submission, mySubmissionCodes]);

  useEffect(() => {
    window.addEventListener('beforeunload', removeMyPresence);
    return () => window.removeEventListener('beforeunload', removeMyPresence);
  }, []);

  useEffect(() => {
    if (!ENABLE_RESULT_BOT_DEPARTURE) return;

    const users = readOnlineUsers();
    const bots = users.filter((u) => u.id !== 'me' && !u.name?.includes(MY_USER_ID));
    const timers = bots.map((bot, index) =>
      window.setTimeout(() => {
        const key = bot.id || bot.name || `bot-${index}`;
        setDepartedUserIds((prev) => new Set([...prev, key]));
      }, (index + 1) * 10000),
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  useEffect(() => {
    return () => {
      botAcceptTimerRef.current?.();
    };
  }, []);

  const toggleReviewProblem = (index: number) => {
    setSelectedReviewProblems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleStartReview = () => {
    setReviewPhase('selecting');
    setSelectedReviewProblems(new Set());
  };

  const handleCancelReview = () => {
    setReviewPhase('idle');
    setSelectedReviewProblems(new Set());
  };

  const handleRequestReview = () => {
    if (selectedReviewProblems.size === 0) return;
    setInviteTargetId(null);
    setShowInviteModal(true);
  };

  const handleCloseInviteModal = () => {
    if (inviteWaiting) return;
    setShowInviteModal(false);
    setInviteTargetId(null);
  };

  const handleInvite = () => {
    if (!inviteTargetId || selectedReviewProblems.size === 0) return;

    const target = allPlayers.find((p) => p.id === inviteTargetId);
    const invite = {
      id: createReviewInviteId(),
      sessionId,
      fromUserId: MY_USER_ID,
      fromUserName: MY_USER_ID,
      toUserId: inviteTargetId,
      toUserName: target?.name || '',
      problemIndices: [...selectedReviewProblems].sort((a, b) => a - b),
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    persistReviewInvite(invite);
    setInviteWaiting(true);

    if (shouldAutoAcceptReviewInvite(inviteTargetId)) {
      botAcceptTimerRef.current?.();
      botAcceptTimerRef.current = scheduleReviewInviteResponse(
        sessionId,
        () => {
          setInviteWaiting(false);
          setShowInviteModal(false);
          setReviewPartnerId(inviteTargetId);
          setReviewPhase('reviewing');
        },
        () => {
          setInviteWaiting(false);
          setShowInviteModal(false);
        },
        REVIEW_BOT_ACCEPT_DELAY_MS,
        true,
      );
    }
  };

  const handleExitReview = () => {
    botAcceptTimerRef.current?.();
    botAcceptTimerRef.current = null;
    setReviewPhase('idle');
    setSelectedReviewProblems(new Set());
    setReviewPartnerId(null);
    setInviteTargetId(null);
    setInviteWaiting(false);
    setShowInviteModal(false);
    clearReviewInvite(sessionId);
  };

  const reviewProblems = useMemo(() => {
    if (reviewPhase !== 'reviewing') return [];
    const problems = submission.problems || [];
    const myResults = allPlayers.find((p) => p.id === MY_USER_ID)?.problemResults || [];

    return [...selectedReviewProblems].sort((a, b) => a - b).map((index) => {
      const problem = problems[index];
      const correctAnswer = problem?.answer?.[lang]?.[0] || problem?.answer?.JAVA?.[0] || '';
      return {
        index,
        title: problem?.title || `문제 ${index + 1}`,
        question: problem?.question || '',
        myAnswer: mySubmissionCodes[index] || '',
        correctAnswer,
        explanation: problem?.explanation || '',
        isCorrect: myResults[index] === true,
      };
    });
  }, [reviewPhase, selectedReviewProblems, submission.problems, mySubmissionCodes, allPlayers, lang]);

  const reviewPartnerName = allPlayers.find((p) => p.id === reviewPartnerId)?.name || '';
  const inviteTargetName = allPlayers.find((p) => p.id === inviteTargetId)?.name || '';

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel = chatMode === 'ALL' ? '[전체]' : '[친구]';
    setChatMessages((prev) => [
      ...prev,
      { sender: MY_USER_ID, text: chatInput, type: 'user', mode: modeLabel, time: timeStr },
    ]);
    setChatInput('');
  };

  const handleSendAiChat = () => {
    if (!aiInput.trim()) return;
    setAiMessages((prev) => [...prev, { type: 'user', text: aiInput }]);
    setAiInput('');
  };

  const replayToRoom = () => {
    removeMyPresence();
    navigate(roomId ? `${ROUTES.ROOM}?id=${roomId}` : ROUTES.LOBBY);
  };

  const clearSessionAndNavigateLobby = () => {
    clearBattleAndLeave(sessionId, roomId);
    removeMyPresence();
    navigate(ROUTES.LOBBY);
  };

  return (
    <div className="page-container result-page">
      <div className="result-gold-bar">
        💰 GOLD +{earnedGold.toLocaleString()} (총 보유: {totalGold.toLocaleString()} G)
      </div>

      <div className={`result-body ${isVersusMany ? 'versus-many' : 'versus-duel'}${reviewPhase === 'reviewing' ? ' review-active' : ''}`}>
        {reviewPhase === 'reviewing' ? (
          <div className={isVersusMany ? 'result-ranking-slot' : 'result-review-slot'}>
            <ReviewProblemView
              problems={reviewProblems}
              partnerName={reviewPartnerName}
              rankBorderColor={rankBorderColor}
              rankGlow={rankGlow}
              onExitReview={handleExitReview}
            />
          </div>
        ) : isVersusMany ? (
          <div className="result-ranking-slot">
            <ResultRankingPanel
              players={allPlayers}
              rankBorderColor={rankBorderColor}
              rankGlow={rankGlow}
              departedUserIds={departedUserIds}
              myUserId={MY_USER_ID}
              reviewSelectMode={reviewSelectMode}
              selectedReviewProblems={selectedReviewProblems}
              onToggleReviewProblem={toggleReviewProblem}
              onStartReview={handleStartReview}
              onCancelReview={handleCancelReview}
              onRequestReview={handleRequestReview}
            />
          </div>
        ) : (
          <>
            <div className="result-win-slot">
              <ResultTeamPanel
                variant="win"
                players={winners}
                departedUserIds={departedUserIds}
                myUserId={MY_USER_ID}
                reviewSelectMode={reviewSelectMode}
                selectedReviewProblems={selectedReviewProblems}
                onToggleReviewProblem={toggleReviewProblem}
              />
            </div>
            <div className="result-lose-slot">
              <ResultTeamPanel
                variant="lose"
                players={losers}
                departedUserIds={departedUserIds}
                myUserId={MY_USER_ID}
                reviewSelectMode={reviewSelectMode}
                selectedReviewProblems={selectedReviewProblems}
                onToggleReviewProblem={toggleReviewProblem}
              />
            </div>
            <div className="result-duel-review-bar">
              <ResultReviewFooter
                playerCount={allPlayers.length}
                reviewSelectMode={reviewSelectMode}
                selectedCount={selectedReviewProblems.size}
                onStartReview={handleStartReview}
                onCancelReview={handleCancelReview}
                onRequestReview={handleRequestReview}
              />
            </div>
          </>
        )}

        <div className="result-chat-slot">
          <ResultChatPanel
            messages={chatMessages}
            chatInput={chatInput}
            chatMode={chatMode}
            myUserId={MY_USER_ID}
            onChatInputChange={setChatInput}
            onChatModeChange={setChatMode}
            onSend={handleSendChat}
          />
        </div>

        <div className="result-action-slot">
          <ResultActionBar onReplay={replayToRoom} onExit={clearSessionAndNavigateLobby} />
        </div>
      </div>

      <AiReviewerPanel
        isOpen={isAiOpen}
        messages={aiMessages}
        aiInput={aiInput}
        onOpen={() => setIsAiOpen(true)}
        onClose={() => setIsAiOpen(false)}
        onAiInputChange={setAiInput}
        onSend={handleSendAiChat}
      />

      <ReviewInviteModal
        show={showInviteModal}
        players={allPlayers}
        myUserId={MY_USER_ID}
        rankBorderColor={rankBorderColor}
        rankGlow={rankGlow}
        departedUserIds={departedUserIds}
        selectedTargetId={inviteTargetId}
        waiting={inviteWaiting}
        inviteTargetName={inviteTargetName}
        onSelectTarget={setInviteTargetId}
        onInvite={handleInvite}
        onClose={handleCloseInviteModal}
      />

      <ResultPopup
        show={resultPopup.show}
        mainMsg={resultPopup.mainMsg}
        detailLines={resultPopup.detailLines}
        newTitles={resultPopup.newTitles}
        rankBorderColor={rankBorderColor}
        onClose={() => setResultPopup((p) => ({ ...p, show: false }))}
      />

    </div>
  );
}
