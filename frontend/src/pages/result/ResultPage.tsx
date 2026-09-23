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
import { ReviewIncomingInviteModal } from '../../components/result/ReviewIncomingInviteModal/ReviewIncomingInviteModal';
import { ReviewProblemView } from '../../components/result/ReviewProblemView/ReviewProblemView';
import {
  UserListContextMenu,
  type UserListMenuAction,
} from '../../components/lobby/UserListContextMenu/UserListContextMenu';
import { CHARACTERS } from '../../constants/roomConstants';
import { checkNewTitles, type TitleDef } from '../../constants/titleTypes';
import { ROUTES } from '../../constants/routes';
import { ENABLE_RESULT_BOT_DEPARTURE, REVIEW_BOT_ACCEPT_DELAY_MS } from '../../constants/resultConstants';
import { useAuthUser } from '../../contexts/AuthContext';
import { clearBattleAndLeave, getSessionId, readFinalRankingSnapshot, saveFinalRankingSnapshot } from '../../services/battleSessionService';
import { fetchRoom, leaveRoom } from '../../services/roomService';
import {
  disconnectRoomSocket,
  emitReviewInvite,
  emitReviewInviteResponse,
  emitFriendRemove,
  emitFriendRequest,
  emitFriendRequestResult,
  emitUpdateLocation,
  getActiveRoomId,
  joinRoomSocket,
  onRoomEvent,
  ROOM_SOCKET_EVENTS,
  sendRoomMessage,
  setActiveRoomId,
  type ChatMessagePayload,
  type ReviewInviteResponsePayload,
  type ReviewInviteSocketPayload,
} from '../../services/roomSocket';
import { getCurrentDisplayName, getCurrentUserName, refreshMeProfile } from '../../services/authService';
import {
  getBattleDemoState,
  getBattleSettings,
  getBattleSubmission,
  getRoomUsers,
  updateRoomUsers,
} from '../../services/sessionStore';
import { fetchMatchRanking, isMatchResultNotReady } from '../../services/matchService';
import {
  addGold,
  applyMatchRewards,
  getGold,
  getRatingScore,
  saveTitles,
  setNewTitleIds,
  setRatingScore,
  getTitles,
} from '../../services/userService';
import {
  addFriend,
  findFriendUserId,
  getFollowRoomPath,
  getFriendNames,
  getFriendUserIds,
  getUserPresence,
  isFriend,
  removeFriend,
  removeFriendByUserId,
} from '../../services/friendStore';
import { getTierByRating } from '../../utils/tierUtils';
import {
  clearReviewInvite,
  createReviewInviteId,
  persistReviewInvite,
  scheduleReviewInviteResponse,
  shouldAutoAcceptReviewInvite,
} from '../../services/reviewSessionService';
import type { DemoBot } from '../../utils/battle/demoBots';
import { normalizeCodeHistoryEntry, saveMatchHistoryEntry } from '../../utils/codeHistoryUtils';
import type { BattleProblem } from '../../types/battle';
import type { FinalRankingSnapshot } from '../../utils/battle/rankUtils';
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
  const myUserName = authUser.displayName || authUser.username || getCurrentDisplayName() || getCurrentUserName();

  const resolveAvatarIcon = (avatar?: string) => {
    const key = String(avatar || '').trim();
    if (!key) return '😎';
    const mapped = CHARACTERS.find((c) => c.id === key)?.icon;
    if (mapped) return mapped;
    if (key.length <= 4) return key;
    return '🤺';
  };
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get('roomId') || '';
  const sessionId = getSessionId(roomId);
  const matchId = searchParams.get('matchId') || String(getBattleSettings().matchId || '');

  const submission = useMemo((): BattleSubmission => getBattleSubmission<BattleSubmission>(), []);

  const demoState = useMemo((): DemoState | null => getBattleDemoState<DemoState>(sessionId), [sessionId]);

  const [rankingSnapshot, setRankingSnapshot] = useState(() => readFinalRankingSnapshot(sessionId));

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

  const myPlayer =
    allPlayers.find((p) => p.id === myUserId) ||
    allPlayers.find((p) => p.id === `player-${myUserId}`) ||
    allPlayers.find((p) => p.name === myUserName);
  const myScore = myPlayer?.ingameScore || 0;
  const isLiveMatch = Boolean(matchId);
  const storedSubmit = (getBattleSettings().matchSubmitResult || {}) as {
    earnedGold?: number;
    ratingDelta?: number;
    newTitleIds?: string[];
    rewards?: Array<{ userId?: string; id?: string; earnedGold?: number; ratingDelta?: number }>;
  };
  const storedRewardFromList = Array.isArray(storedSubmit.rewards)
    ? storedSubmit.rewards.find(
        (reward) => String(reward.userId || reward.id) === String(myUserId),
      )
    : null;
  const [apiRewardGold, setApiRewardGold] = useState<number | null>(
    typeof storedSubmit.earnedGold === 'number'
      ? storedSubmit.earnedGold
      : typeof storedRewardFromList?.earnedGold === 'number'
        ? storedRewardFromList.earnedGold
        : null,
  );
  const earnedGold = isLiveMatch ? (apiRewardGold ?? 0) : myScore;
  const myRank = myPlayer?.rank ?? (myPlayer ? allPlayers.indexOf(myPlayer) + 1 : 0);
  const totalPlayersForRank = Math.max(1, allPlayers.length);
  const isLastPlace = myRank > 0 && myRank === totalPlayersForRank && totalPlayersForRank > 1;
  const isFirstPlace = myRank === 1;
  const rankBorderColor = isFirstPlace
    ? 'var(--px-warning)'
    : isLastPlace
      ? 'var(--px-danger)'
      : 'var(--px-primary)';
  const rankGlow = isFirstPlace
    ? '0 0 0 4px #000, 0 0 30px rgba(247,213,29,0.35)'
    : isLastPlace
      ? '0 0 0 4px #000, 0 0 30px rgba(231,110,85,0.35)'
      : '0 0 0 4px #000, 0 0 30px rgba(32,156,238,0.3)';
  const isWin = myRank > 0 && myRank <= Math.ceil(allPlayers.length / 2);
  const totalProblemCount =
    submission.problemResults?.length ||
    submission.problems?.length ||
    myPlayer?.problemResults?.length ||
    0;
  const myCorrectCount = myPlayer?.problemResults?.filter(Boolean).length ?? 0;

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
  const [incomingReviewInvite, setIncomingReviewInvite] = useState<ReviewInviteSocketPayload | null>(null);
  const pendingInviteIdRef = useRef<string | null>(null);
  const [pendingFriendRequest, setPendingFriendRequest] = useState<{
    fromUserId: string;
    fromUserName: string;
  } | null>(null);
  const [, setFriendNames] = useState<string[]>(() => getFriendNames());
  const [liveRatingScore, setLiveRatingScore] = useState(() => getRatingScore());
  const [liveRatingTier, setLiveRatingTier] = useState(() => getTierByRating(getRatingScore()));

  const reviewSelectMode = reviewPhase === 'selecting';

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      try {
        await joinRoomSocket(roomId);
        if (cancelled) return;

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ChatMessagePayload) => {
            const name = payload.sender?.displayName || payload.sender?.username || 'UNKNOWN';
            const text = String(payload.message || '');
            if (!text) return;
            // 더미/봇 멘트를 결과 채팅에 표시하지 않음
            if (name === '알고리즘깎는노인' || text === '수고하셨습니다.' || text === '고생하셨습니다!') {
              return;
            }
            if (payload.mode === 'FRIEND') {
              const senderId = String(payload.sender?.id || '').replace(/^player-/, '');
              const myId = String(myUserId || '');
              if (senderId !== myId && !isFriend(name)) return;
            }
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const modeLabel =
              payload.mode === 'WHISPER'
                ? `[귓속말${payload.targetUserName ? `:${payload.targetUserName}` : ''}]`
                : payload.mode === 'FRIEND'
                  ? '[친구]'
                  : '[전체]';
            setChatMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.sender === name && last.text === text) return prev;
              return [...prev, { sender: name, text, type: 'user' as const, mode: modeLabel, time: timeStr }];
            });
          }),
        );

        unsubs.push(
          onRoomEvent(
            ROOM_SOCKET_EVENTS.FRIEND_REQUEST,
            (payload?: { fromUserId?: string; fromUserName?: string }) => {
              if (!payload?.fromUserId) return;
              if (String(payload.fromUserId) === String(myUserId)) return;
              setPendingFriendRequest({
                fromUserId: String(payload.fromUserId),
                fromUserName: payload.fromUserName || 'UNKNOWN',
              });
            },
          ),
        );

        unsubs.push(
          onRoomEvent(
            ROOM_SOCKET_EVENTS.FRIEND_REQUEST_RESULT,
            (payload?: { fromUserName?: string; fromUserId?: string; accepted?: boolean }) => {
              if (!payload) return;
              if (payload.accepted) {
                if (payload.fromUserName) {
                  addFriend(payload.fromUserName, payload.fromUserId);
                  setFriendNames(getFriendNames());
                }
                setChatMessages((prev) => [
                  ...prev,
                  {
                    sender: 'SYSTEM',
                    text: `${payload.fromUserName || '상대'}님이 친구 요청을 수락했습니다.`,
                    type: 'sys',
                  },
                ]);
              } else {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    sender: 'SYSTEM',
                    text: `${payload.fromUserName || '상대'}님이 친구 요청을 거절했습니다.`,
                    type: 'sys',
                  },
                ]);
              }
            },
          ),
        );

        unsubs.push(
          onRoomEvent(
            ROOM_SOCKET_EVENTS.FRIEND_REMOVE,
            (payload?: { fromUserId?: string; fromUserName?: string }) => {
              if (payload?.fromUserId) removeFriendByUserId(String(payload.fromUserId));
              if (payload?.fromUserName) removeFriend(payload.fromUserName);
              setChatMessages((prev) => [
                ...prev,
                {
                  sender: 'SYSTEM',
                  text: `${payload?.fromUserName || '상대'}님이 친구 목록에서 나를 삭제했습니다.`,
                  type: 'sys',
                },
              ]);
            },
          ),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.REVIEW_INVITE, (payload: ReviewInviteSocketPayload) => {
            if (String(payload.fromUserId) === String(myUserId)) return;
            if (!payload.toUserIds?.map(String).includes(String(myUserId))) return;
            setIncomingReviewInvite(payload);
          }),
        );

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.REVIEW_INVITE_RESPONSE, (payload: ReviewInviteResponsePayload) => {
            // 내가 보낸 초대에 대한 응답만 처리
            if (String(payload.fromUserId || '') !== String(myUserId)) return;
            if (payload.accepted) {
              setInviteWaiting(false);
              setShowInviteModal(false);
              setReviewPartnerIds([String(payload.toUserId)]);
              if (Array.isArray(payload.problemIndices) && payload.problemIndices.length > 0) {
                setSelectedReviewProblems(new Set(payload.problemIndices));
              }
              setReviewPhase('reviewing');
            } else {
              setInviteWaiting(false);
              setShowInviteModal(false);
              setChatMessages((prev) => [
                ...prev,
                {
                  sender: 'SYSTEM',
                  text: `${payload.toUserName || '상대'}님이 리뷰 초대를 거절했습니다.`,
                  type: 'sys',
                },
              ]);
            }
          }),
        );
      } catch {
        // ignore
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
  }, [roomId, myUserId]);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    const rewardsAppliedRef = { current: false };

    let timer = 0;
    const loadRanking = async () => {
      try {
        const ranking = await fetchMatchRanking(matchId);
        if (cancelled || !Array.isArray(ranking.players)) return;
        const snapshot: FinalRankingSnapshot = {
          sessionId,
          roomId: roomId || String(ranking.matchId || ''),
          finalizedAt: ranking.finalizedAt || new Date().toISOString(),
          elapsedSec: Number(ranking.elapsedSec) || 0,
          roundSeconds: Number(ranking.roundSeconds) || 0,
          totalProblems: Number(ranking.totalProblems) || 0,
          players: ranking.players.map((player) => ({
            id: String(player.id),
            name: player.name || String(player.id),
            avatar: resolveAvatarIcon(player.avatar),
            ingameScore: Number(player.ingameScore) || 0,
            ratingScore: Number(player.ratingScore) || 1000,
            totalSolveTime: Number(player.totalSolveTime) || 0,
            completionTime: Number(player.completionTime) || 0,
            solvedProblems: Array.isArray(player.solvedProblems) ? player.solvedProblems : [],
            problemResults: Array.isArray(player.problemResults) ? player.problemResults : [],
            rank: Number(player.rank) || 0,
          })),
        };
        setRankingSnapshot(snapshot);
        saveFinalRankingSnapshot(snapshot);

        if (!rewardsAppliedRef.current) {
          const mine =
            (ranking.rewards || []).find(
              (reward) => String(reward.userId || reward.id) === String(myUserId),
            ) || null;
          const earned =
            typeof mine?.earnedGold === 'number'
              ? mine.earnedGold
              : typeof storedSubmit.earnedGold === 'number'
                ? storedSubmit.earnedGold
                : undefined;
          const ratingDelta =
            typeof mine?.ratingDelta === 'number'
              ? mine.ratingDelta
              : typeof storedSubmit.ratingDelta === 'number'
                ? storedSubmit.ratingDelta
                : undefined;
          const newTitleIds = Array.isArray(mine?.newTitleIds)
            ? mine.newTitleIds
            : storedSubmit.newTitleIds;

          if (earned !== undefined || ratingDelta !== undefined || newTitleIds?.length) {
            const ratingBefore = getRatingScore();
            applyMatchRewards({
              earnedGold: earned,
              ratingDelta,
              newTitleIds,
            });
            const resolvedAfter =
              typeof ratingDelta === 'number'
                ? Math.max(0, ratingBefore + ratingDelta)
                : getRatingScore();
            setRatingScore(resolvedAfter);
            setLiveRatingScore(resolvedAfter);
            setLiveRatingTier(getTierByRating(resolvedAfter));
            if (typeof earned === 'number') setApiRewardGold(earned);
            setTotalGold(getGold());
            rewardsAppliedRef.current = true;

            void refreshMeProfile().then(() => {
              const serverScore = getRatingScore();
              // 서버가 아직 반영 전이면 로컬 계산값 유지
              const finalScore =
                typeof ratingDelta === 'number' &&
                ((ratingDelta < 0 && serverScore > resolvedAfter) ||
                  (ratingDelta > 0 && serverScore < resolvedAfter))
                  ? resolvedAfter
                  : serverScore || resolvedAfter;
              setRatingScore(finalScore);
              setLiveRatingScore(finalScore);
              setLiveRatingTier(getTierByRating(finalScore));
              void emitUpdateLocation({
                location: 'result',
                roomId: String(roomId || ''),
                ratingScore: finalScore,
              }).catch(() => undefined);
            });
          }
        }

        if (timer) window.clearInterval(timer);
      } catch (error) {
        if (!isMatchResultNotReady(error)) {
          console.error('랭킹 조회 실패:', error);
        }
      }
    };

    void loadRanking();
    timer = window.setInterval(() => {
      void loadRanking();
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [matchId, sessionId, roomId, myUserId, storedSubmit.earnedGold, storedSubmit.ratingDelta, storedSubmit.newTitleIds]);

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
    if (isLiveMatch) return;
    const newGold = addGold(earnedGold);
    setTotalGold(newGold);
  }, [earnedGold, isLiveMatch]);

  useEffect(() => {
    if (isLiveMatch) return;
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

    const totalPlayers = Math.max(1, allPlayers.length);
    let mainMsg = '';

    if (myRank <= 0) {
      mainMsg = '매치 결과를 집계했습니다.';
    } else if (myRank === 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 1등입니다.`;
    } else if (myRank === totalPlayers && totalPlayers > 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등(꼴등)입니다.`;
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
    if (!isLiveMatch || allPlayers.length === 0 || myRank <= 0) return;
    const totalPlayers = Math.max(1, allPlayers.length);
    let mainMsg = '';
    if (myRank === 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 1등입니다.`;
    } else if (myRank === totalPlayers && totalPlayers > 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등(꼴등)입니다.`;
    } else {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등입니다.`;
    }
    const detailLines: string[] = [];
    if (totalProblemCount > 0) {
      detailLines.push(`${totalProblemCount}문제 중 ${myCorrectCount}문제를 맞췄습니다.`);
    }
    setResultPopup((prev) => ({
      show: true,
      mainMsg,
      detailLines: detailLines.length > 0 ? detailLines : prev.detailLines,
      newTitles: prev.newTitles,
    }));
  }, [isLiveMatch, allPlayers.length, myRank, totalProblemCount, myCorrectCount]);

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
      void saveMatchHistoryEntry(entry);
    } catch (e) {
      console.error('코드 히스토리 저장 실패:', e);
    }
  }, [roomId, submission, mySubmissionCodes]);

  useEffect(() => {
    void emitUpdateLocation({
      location: 'result',
      roomId: String(roomId || ''),
      ratingScore: getRatingScore(),
    }).catch(() => undefined);
  }, [roomId]);

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
    pendingInviteIdRef.current = invite.id;
    setInviteWaiting(true);

    const botTargets = targets.filter((id) => shouldAutoAcceptReviewInvite(id));
    const humanTargets = targets.filter((id) => !shouldAutoAcceptReviewInvite(id));

    if (humanTargets.length > 0 && roomId) {
      const problemPreviews = invite.problemIndices.map((index) => {
        const problem = resultProblems[index];
        return {
          index,
          title: problem?.title || `Problem ${index + 1}`,
          question: problem?.question || '',
        };
      });
      void emitReviewInvite(roomId, {
        id: invite.id,
        sessionId,
        matchId: matchId || undefined,
        toUserIds: humanTargets,
        problemIndices: invite.problemIndices,
        problems: problemPreviews,
      }).catch(() => undefined);
    }

    if (botTargets.length > 0 && humanTargets.length === 0) {
      botAcceptTimerRef.current?.();
      botAcceptTimerRef.current = scheduleReviewInviteResponse(
        sessionId,
        () => {
          setInviteWaiting(false);
          setShowInviteModal(false);
          setReviewPartnerIds(botTargets);
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

  const handleAcceptIncomingReview = () => {
    if (!incomingReviewInvite || !roomId) return;
    void emitReviewInviteResponse(roomId, {
      inviteId: incomingReviewInvite.id,
      fromUserId: incomingReviewInvite.fromUserId,
      accepted: true,
      problemIndices: incomingReviewInvite.problemIndices,
    });
    setSelectedReviewProblems(new Set(incomingReviewInvite.problemIndices || []));
    setReviewPartnerIds([incomingReviewInvite.fromUserId]);
    setReviewPhase('reviewing');
    setIncomingReviewInvite(null);
  };

  const handleRejectIncomingReview = () => {
    if (!incomingReviewInvite || !roomId) return;
    void emitReviewInviteResponse(roomId, {
      inviteId: incomingReviewInvite.id,
      fromUserId: incomingReviewInvite.fromUserId,
      accepted: false,
      problemIndices: incomingReviewInvite.problemIndices,
    });
    setIncomingReviewInvite(null);
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

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel =
      chatMode === 'WHISPER' && whisperTarget
        ? `[귓속말:${whisperTarget}]`
        : chatMode === 'ALL'
          ? '[전체]'
          : '[친구]';
    const whisperUser = allPlayers.find((p) => p.name === whisperTarget);
    const friendUserIds = getFriendUserIds(
      allPlayers.map((p) => ({ name: p.name, userId: p.id })),
    );
    setChatInput('');
    setChatMessages((prev) => [
      ...prev,
      { sender: myUserName, text, type: 'user', mode: modeLabel, time: timeStr },
    ]);
    if (roomId) {
      try {
        const result = await sendRoomMessage(roomId, text, {
          mode: chatMode === 'WHISPER' ? 'WHISPER' : chatMode === 'FRIEND' ? 'FRIEND' : 'ALL',
          targetUserId: whisperUser?.id,
          targetUserName: whisperTarget || undefined,
          friendUserIds,
        });
        if (!result.success) {
          setChatMessages((prev) => [
            ...prev,
            { sender: 'SYSTEM', text: result.message || '채팅 전송 실패', type: 'sys' },
          ]);
        }
      } catch {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'SYSTEM', text: '채팅 서버에 연결할 수 없습니다.', type: 'sys' },
        ]);
      }
    }
  };

  const appendSystemChat = (text: string) => {
    setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text, type: 'sys' as const }]);
  };

  const handleNicknameContextMenu = (event: MouseEvent, player: ResultPlayer) => {
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
      case 'my-info':
        appendSystemChat('내 정보는 로비에서 확인할 수 있습니다.');
        break;
      case 'match-story':
        appendSystemChat(`${userName} 님의 프로필은 로비에서 확인할 수 있습니다.`);
        break;
      case 'add-friend':
        if (isFriend(userName)) {
          const target = allPlayers.find((p) => p.name === userName);
          const friendId = target?.id || findFriendUserId(userName);
          removeFriend(userName);
          if (friendId) {
            void emitFriendRemove(String(friendId).replace(/^player-/, '')).catch(() => undefined);
          }
          appendSystemChat(`${userName} 님을 친구 목록에서 삭제했습니다.`);
        } else {
          appendSystemChat(`${userName} 님에게 친구 요청을 보냈습니다.`);
          const target = allPlayers.find((p) => p.name === userName);
          if (target?.id) {
            void emitFriendRequest(String(target.id).replace(/^player-/, ''), userName).catch(() => undefined);
          }
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

  const replayToRoom = async () => {
    removeMyPresence(myUserId);
    if (!roomId) {
      navigate(ROUTES.LOBBY);
      return;
    }
    try {
      setActiveRoomId(roomId);
      await joinRoomSocket(roomId);
      await fetchRoom(Number(roomId));
    } catch {
      // RoomPage에서 재입장/재조회
    }
    navigate(`${ROUTES.ROOM}?id=${roomId}`);
  };

  const clearSessionAndNavigateLobby = async () => {
    clearBattleAndLeave(sessionId, roomId);
    removeMyPresence(myUserId);
    const activeId = roomId || getActiveRoomId();
    const numericRoomId = activeId ? Number(activeId) : NaN;
    if (Number.isInteger(numericRoomId) && numericRoomId > 0) {
      try {
        await leaveRoom(numericRoomId);
      } catch {
        // ignore
      }
    }
    setActiveRoomId(null);
    // 로비에서 새 소켓을 붙일 수 있도록 강제 종료
    disconnectRoomSocket(true);
    navigate(ROUTES.LOBBY);
  };

  return (
    <div className="page-container result-page">
      <div className="result-gold-bar">
        💰 GOLD +{earnedGold.toLocaleString()} (총 보유: {totalGold.toLocaleString()} G)
        {' · '}
        레이팅 {liveRatingScore} ({liveRatingTier})
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
        onInvite={handleInvite}
        onToggleTarget={toggleInviteTarget}
        onClose={handleCloseInviteModal}
      />

      <ReviewIncomingInviteModal
        show={Boolean(incomingReviewInvite)}
        fromUserName={incomingReviewInvite?.fromUserName || '상대'}
        problemCount={incomingReviewInvite?.problemIndices?.length || 0}
        problems={
          incomingReviewInvite?.problems?.length
            ? incomingReviewInvite.problems
            : (incomingReviewInvite?.problemIndices || []).map((index) => ({
                index,
                title: resultProblems[index]?.title || `Problem ${index + 1}`,
                question: resultProblems[index]?.question || '',
              }))
        }
        onAccept={handleAcceptIncomingReview}
        onReject={handleRejectIncomingReview}
      />

      {pendingFriendRequest && (
        <div className="review-modal-overlay" style={{ zIndex: 4000 }}>
          <div className="review-modal-panel ranking-panel" style={{ width: 'min(420px, 92vw)', height: 'auto', minHeight: 180 }}>
            <div className="rank-title">FRIEND REQUEST</div>
            <div className="review-incoming-msg">
              <strong>{pendingFriendRequest.fromUserName}</strong>님이 친구 요청을 보냈습니다.
            </div>
            <div className="review-modal-actions review-modal-actions-end">
              <button
                type="button"
                className="pixel-btn pixel-btn-secondary review-modal-btn"
                onClick={() => {
                  void emitFriendRequestResult(pendingFriendRequest.fromUserId, false);
                  setPendingFriendRequest(null);
                }}
              >
                거절
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-primary review-modal-btn"
                onClick={() => {
                  addFriend(pendingFriendRequest.fromUserName, pendingFriendRequest.fromUserId);
                  setFriendNames(getFriendNames());
                  void emitFriendRequestResult(pendingFriendRequest.fromUserId, true);
                  setPendingFriendRequest(null);
                  appendSystemChat(`${pendingFriendRequest.fromUserName} 님과 친구가 되었습니다.`);
                }}
              >
                수락
              </button>
            </div>
          </div>
        </div>
      )}

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
            'match-story': '프로필 보기',
            'add-friend': isFriend(contextMenu.player.name) ? '친구삭제' : '친구추가',
          }}
          hiddenActions={
            contextMenu.player.id === myUserId
              ? (['match-story', 'add-friend', 'whisper', 'follow', 'summon'] as UserListMenuAction[])
              : (['my-info', 'summon'] as UserListMenuAction[])
          }
          disabledActions={(() => {
            if (contextMenu.player!.id === myUserId) return [];
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
