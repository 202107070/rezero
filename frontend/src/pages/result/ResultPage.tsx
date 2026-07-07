import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AiReviewerPanel, type AiMessage } from '../../components/result/AiReviewerPanel/AiReviewerPanel';
import { ResultActionBar } from '../../components/result/ResultActionBar/ResultActionBar';
import { ResultChatPanel } from '../../components/result/ResultChatPanel/ResultChatPanel';
import { ResultPopup } from '../../components/result/ResultPopup/ResultPopup';
import { ResultProblemModal } from '../../components/result/ResultProblemModal/ResultProblemModal';
import { ResultRankingPanel } from '../../components/result/ResultRankingPanel/ResultRankingPanel';
import { ResultReviewFooter } from '../../components/result/ResultReviewFooter/ResultReviewFooter';
import { ResultTeamPanel } from '../../components/result/ResultTeamPanel/ResultTeamPanel';
import { ReviewInviteModal } from '../../components/result/ReviewInviteModal/ReviewInviteModal';
import { ReviewProblemView } from '../../components/result/ReviewProblemView/ReviewProblemView';
import {
  UserListContextMenu,
  type UserListMenuAction,
} from '../../components/lobby/UserListContextMenu/UserListContextMenu';
import { checkNewTitles, type TitleDef } from '../../constants/titleTypes';
import { ROUTES } from '../../constants/routes';
import { ENABLE_RESULT_BOT_DEPARTURE, REVIEW_BOT_ACCEPT_DELAY_MS } from '../../constants/resultConstants';
import { useAuthUser } from '../../contexts/AuthContext';
import { clearBattleAndLeave, getSessionId, readFinalRankingSnapshot } from '../../services/battleSessionService';
import {
  getBattleDemoState,
  getBattleSubmission,
  getRoomUsers,
  updateRoomUsers,
} from '../../services/sessionStore';
import { addGold, getGold, saveTitles, setNewTitleIds, getTitles } from '../../services/userService';
import {
  addFriend,
  getFollowRoomPath,
  getUserPresence,
  isFriend,
  removeFriend,
} from '../../services/friendStore';
import {
  clearReviewInvite,
  createReviewInviteId,
  persistReviewInvite,
  scheduleReviewInviteResponse,
  shouldAutoAcceptReviewInvite,
} from '../../services/reviewSessionService';
import type { DemoBot } from '../../utils/battle/demoBots';
import { normalizeCodeHistoryEntry, persistCodeHistory, readCodeHistory } from '../../utils/codeHistoryUtils';
import type { BattleProblem } from '../../types/battle';
import { getLangKey } from '../../utils/battle/codeUtils';
import { buildResultPlayers, type ResultPlayer } from '../../utils/resultUtils';
import { formatCorrectAnswer, getResultPlayerAnswer } from '../../utils/resultAnswerUtils';
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
  blankAnswers?: string[][];
  selectedOptions?: Record<number, number>;
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
  blankAnswers?: string[][];
  selectedOptions?: Record<number, number>;
}

interface OnlineUser {
  id?: string;
  name?: string;
  avatar?: string;
}

function removeMyPresence(myUserId: string): void {
  updateRoomUsers((users) => users.filter((u) => u.id !== myUserId && u.id !== 'me'));
}

type ReviewPhase = 'idle' | 'selecting' | 'reviewing';

function readOnlineUsers(): OnlineUser[] {
  return getRoomUsers();
}

export default function ResultPage() {
  const navigate = useNavigate();
  const authUser = useAuthUser();
  const myUserId = authUser.id;
  const myUserName = authUser.username;
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const sessionId = getSessionId(roomId);

  const submission = useMemo((): BattleSubmission => getBattleSubmission<BattleSubmission>(), []);

  const demoState = useMemo((): DemoState | null => getBattleDemoState<DemoState>(sessionId), [sessionId]);

  const rankingSnapshot = useMemo(() => readFinalRankingSnapshot(sessionId), [sessionId]);

  const roomUsers = useMemo(() => getRoomUsers(), []);

  const demoBots = useMemo(
    () => (Array.isArray(demoState?.battleBots) ? demoState.battleBots : []) as DemoBot[],
    [demoState],
  );

  const roomMode = submission?.mode || demoState?.mode || '1/1';
  const isVersusMany = roomMode !== '1/1';
  const lang = submission.lang || demoState?.lang || 'JAVA';
  const langKey = getLangKey(lang);

  const allPlayers = useMemo(
    () => buildResultPlayers({ rankingSnapshot, roomUsers, demoBots, submission, demoState }),
    [rankingSnapshot, roomUsers, demoBots, submission, demoState],
  );

  const myScore = allPlayers.find((p) => p.id === myUserId)?.ingameScore || 0;
  const earnedGold = myScore;
  const myRank = allPlayers.findIndex((p) => p.id === myUserId) + 1;
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
    allPlayers.find((p) => p.id === myUserId)?.problemResults?.length ||
    0;
  const myCorrectCount =
    allPlayers.find((p) => p.id === myUserId)?.problemResults?.filter(Boolean).length ?? 0;

  const [totalGold, setTotalGold] = useState(() => getGold());

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
    { sender: myUserName, text: '고생하셨습니다!', type: 'user' as const },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState('ALL');
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null);

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
  const [inviteTargetIds, setInviteTargetIds] = useState<Set<string>>(() => new Set());
  const [inviteWaiting, setInviteWaiting] = useState(false);
  const [reviewPartnerIds, setReviewPartnerIds] = useState<string[]>([]);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [problemDetailModal, setProblemDetailModal] = useState<{
    player: ResultPlayer;
    problemIndex: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    player: ResultPlayer | null;
  }>({ open: false, x: 0, y: 0, player: null });
  const botAcceptTimerRef = useRef<(() => void) | null>(null);

  const reviewSelectMode = reviewPhase === 'selecting';

  const mySubmissionCodes = Array.isArray(submission.codes)
    ? submission.codes
    : Array.isArray(submission.answers)
      ? submission.answers
      : [];
  const resultProblems = useMemo(
    () => (Array.isArray(submission.problems) ? (submission.problems as BattleProblem[]) : []),
    [submission.problems],
  );
  const myBlankAnswers = submission.blankAnswers ?? demoState?.blankAnswers;
  const mySelectedOptions = submission.selectedOptions ?? demoState?.selectedOptions;
  const winners = allPlayers.slice(0, Math.max(1, Math.ceil(allPlayers.length / 2)));
  const losers = allPlayers.slice(Math.ceil(allPlayers.length / 2));

  useEffect(() => {
    const newGold = addGold(earnedGold);
    setTotalGold(newGold);
  }, [earnedGold]);

  useEffect(() => {
    const prev = getTitles();
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
    setNewTitleIds(newTitles.map((t) => t.id));

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
    const onBeforeUnload = () => removeMyPresence(myUserId);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [myUserId]);

  useEffect(() => {
    if (!ENABLE_RESULT_BOT_DEPARTURE) return;

    const users = readOnlineUsers();
    const bots = users.filter((u) => u.id !== 'me' && u.id !== myUserId);
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
    setInviteTargetIds(new Set());
    setShowInviteModal(true);
  };

  const handleCloseInviteModal = () => {
    if (inviteWaiting) return;
    setShowInviteModal(false);
    setInviteTargetIds(new Set());
  };

  const toggleInviteTarget = (playerId: string) => {
    setInviteTargetIds((prev) => {
      if (isVersusMany) {
        const next = new Set(prev);
        if (next.has(playerId)) next.delete(playerId);
        else next.add(playerId);
        return next;
      }
      return new Set([playerId]);
    });
  };

  const handleInvite = () => {
    const targets = [...inviteTargetIds];
    if (targets.length === 0 || selectedReviewProblems.size === 0) return;

    const targetNames = targets
      .map((id) => allPlayers.find((p) => p.id === id)?.name || '')
      .filter(Boolean);

    const invite = {
      id: createReviewInviteId(),
      sessionId,
      fromUserId: myUserId,
      fromUserName: myUserName,
      toUserId: targets[0],
      toUserIds: targets,
      toUserName: targetNames.join(', '),
      problemIndices: [...selectedReviewProblems].sort((a, b) => a - b),
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    persistReviewInvite(invite);
    setInviteWaiting(true);

    if (targets.every(shouldAutoAcceptReviewInvite)) {
      botAcceptTimerRef.current?.();
      botAcceptTimerRef.current = scheduleReviewInviteResponse(
        sessionId,
        () => {
          setInviteWaiting(false);
          setShowInviteModal(false);
          setReviewPartnerIds(targets);
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
    setReviewPartnerIds([]);
    setInviteTargetIds(new Set());
    setInviteWaiting(false);
    setShowInviteModal(false);
    setReviewExpanded(false);
    clearReviewInvite(sessionId);
  };

  const handleOpenProblemDetail = (player: ResultPlayer, problemIndex: number) => {
    if (reviewPhase !== 'idle') return;
    setProblemDetailModal({ player, problemIndex });
  };

  const handleCloseProblemDetail = () => {
    setProblemDetailModal(null);
  };

  const problemDetailSubmittedAnswer = useMemo(() => {
    if (!problemDetailModal || resultProblems.length === 0) return '';
    const { player, problemIndex } = problemDetailModal;
    const problem = resultProblems[problemIndex];
    if (!problem) return '';
    return getResultPlayerAnswer({
      playerId: player.id,
      problemIndex,
      problem,
      langKey: langKey,
      myUserId,
      mySubmissionCodes,
      myBlankAnswers,
      mySelectedOptions,
      demoBots,
    });
  }, [
    problemDetailModal,
    resultProblems,
    langKey,
    myUserId,
    mySubmissionCodes,
    myBlankAnswers,
    mySelectedOptions,
    demoBots,
  ]);

  const reviewProblems = useMemo(() => {
    if (reviewPhase !== 'reviewing') return [];
    const problems = submission.problems || [];
    const myResults = allPlayers.find((p) => p.id === myUserId)?.problemResults || [];

    return [...selectedReviewProblems].sort((a, b) => a - b).map((index) => {
      const problem = problems[index];
      const correctAnswer = problem ? formatCorrectAnswer(problem as BattleProblem, langKey) : '';
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
  }, [reviewPhase, selectedReviewProblems, submission.problems, mySubmissionCodes, allPlayers, langKey]);

  const reviewPartnerName = reviewPartnerIds
    .map((id) => allPlayers.find((p) => p.id === id)?.name || '')
    .filter(Boolean)
    .join(', ');
  const inviteTargetLabel = [...inviteTargetIds]
    .map((id) => allPlayers.find((p) => p.id === id)?.name || '')
    .filter(Boolean)
    .join(', ');

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel =
      chatMode === 'WHISPER' && whisperTarget
        ? `[귓속말:${whisperTarget}]`
        : chatMode === 'ALL'
          ? '[전체]'
          : '[친구]';
    setChatMessages((prev) => [
      ...prev,
      { sender: myUserName, text: chatInput, type: 'user', mode: modeLabel, time: timeStr },
    ]);
    setChatInput('');
  };

  const appendSystemChat = (text: string) => {
    setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text, type: 'sys' as const }]);
  };

  const handleNicknameContextMenu = (event: MouseEvent, player: ResultPlayer) => {
    if (player.id === myUserId) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      player,
    });
  };

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, open: false, player: null }));
  };

  const handleUserMenuAction = (action: UserListMenuAction, userName: string) => {
    switch (action) {
      case 'match-story':
        appendSystemChat(`${userName} 님의 매치 스토리는 로비에서 확인할 수 있습니다.`);
        break;
      case 'add-friend':
        if (isFriend(userName)) {
          removeFriend(userName);
          appendSystemChat(`${userName} 님을 친구 목록에서 삭제했습니다.`);
        } else {
          const added = addFriend(userName);
          appendSystemChat(added ? `${userName} 님을 친구 목록에 추가했습니다.` : `${userName} 님은 이미 친구입니다.`);
        }
        break;
      case 'whisper':
        setWhisperTarget(userName);
        setChatMode('WHISPER');
        appendSystemChat(`${userName} 님에게 귓속말 모드로 전환했습니다.`);
        break;
      case 'follow': {
        const roomPath = getFollowRoomPath(userName);
        if (!roomPath) {
          appendSystemChat(`${userName} 님은 현재 따라갈 수 있는 방에 없습니다.`);
          break;
        }
        appendSystemChat(`${userName} 님이 있는 방으로 이동합니다.`);
        navigate(roomPath);
        break;
      }
      case 'summon':
        appendSystemChat('소환하기는 대기실에서만 사용할 수 있습니다.');
        break;
      default:
        break;
    }
  };

  const handleSendAiChat = () => {
    if (!aiInput.trim()) return;
    setAiMessages((prev) => [...prev, { type: 'user', text: aiInput }]);
    setAiInput('');
  };

  const replayToRoom = () => {
    removeMyPresence(myUserId);
    navigate(roomId ? `${ROUTES.ROOM}?id=${roomId}` : ROUTES.LOBBY);
  };

  const clearSessionAndNavigateLobby = () => {
    clearBattleAndLeave(sessionId, roomId);
    removeMyPresence(myUserId);
    navigate(ROUTES.LOBBY);
  };

  return (
    <div className="page-container result-page">
      <div className="result-gold-bar">
        💰 GOLD +{earnedGold.toLocaleString()} (총 보유: {totalGold.toLocaleString()} G)
      </div>

      <div className={`result-body ${isVersusMany ? 'versus-many' : 'versus-duel'}${reviewPhase === 'reviewing' ? ' review-active' : ''}${reviewExpanded ? ' review-focus-problems' : ''}`}>
        {reviewPhase === 'reviewing' ? (
          <div className={isVersusMany ? 'result-ranking-slot' : 'result-review-slot'}>
            <ReviewProblemView
              problems={reviewProblems}
              partnerName={reviewPartnerName}
              rankBorderColor={rankBorderColor}
              rankGlow={rankGlow}
              reviewExpanded={reviewExpanded}
              onToggleReviewLayout={() => setReviewExpanded((v) => !v)}
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
              myUserId={myUserId}
              reviewSelectMode={reviewSelectMode}
              selectedReviewProblems={selectedReviewProblems}
              onToggleReviewProblem={toggleReviewProblem}
              onOpenProblemDetail={handleOpenProblemDetail}
              onNicknameContextMenu={handleNicknameContextMenu}
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
                myUserId={myUserId}
                reviewSelectMode={reviewSelectMode}
                selectedReviewProblems={selectedReviewProblems}
                onToggleReviewProblem={toggleReviewProblem}
                onOpenProblemDetail={handleOpenProblemDetail}
                onNicknameContextMenu={handleNicknameContextMenu}
              />
            </div>
            <div className="result-lose-slot">
              <ResultTeamPanel
                variant="lose"
                players={losers}
                departedUserIds={departedUserIds}
                myUserId={myUserId}
                reviewSelectMode={reviewSelectMode}
                selectedReviewProblems={selectedReviewProblems}
                onToggleReviewProblem={toggleReviewProblem}
                onOpenProblemDetail={handleOpenProblemDetail}
                onNicknameContextMenu={handleNicknameContextMenu}
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
            whisperTarget={whisperTarget}
            myUserId={myUserId}
            onChatInputChange={setChatInput}
            onChatModeChange={(mode) => {
              setChatMode(mode);
              if (mode !== 'WHISPER') setWhisperTarget(null);
            }}
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
        myUserId={myUserId}
        rankBorderColor={rankBorderColor}
        rankGlow={rankGlow}
        departedUserIds={departedUserIds}
        selectedTargetIds={inviteTargetIds}
        allowMultiple={isVersusMany}
        waiting={inviteWaiting}
        inviteTargetLabel={inviteTargetLabel}
        onToggleTarget={toggleInviteTarget}
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

      <ResultProblemModal
        isOpen={!!problemDetailModal}
        player={problemDetailModal?.player ?? null}
        problems={resultProblems}
        problemIndex={problemDetailModal?.problemIndex ?? 0}
        langKey={langKey}
        submittedAnswer={problemDetailSubmittedAnswer}
        onClose={handleCloseProblemDetail}
        onProblemIndexChange={(index) => {
          setProblemDetailModal((prev) => (prev ? { ...prev, problemIndex: index } : null));
        }}
      />

      {contextMenu.player && (
        <UserListContextMenu
          open={contextMenu.open}
          x={contextMenu.x}
          y={contextMenu.y}
          userName={contextMenu.player.name}
          actionLabels={{
            'add-friend': isFriend(contextMenu.player.name) ? '친구삭제' : '친구추가',
          }}
          hiddenActions={['summon']}
          disabledActions={(() => {
            const presence = getUserPresence(contextMenu.player!.name);
            const canFollow = isFriend(contextMenu.player!.name) && presence?.status === 'room';
            return canFollow ? [] : (['follow'] as UserListMenuAction[]);
          })()}
          onSelect={handleUserMenuAction}
          onClose={closeContextMenu}
        />
      )}

    </div>
  );
}
