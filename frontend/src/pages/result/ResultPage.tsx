import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AiReviewerPanel, type AiMessage } from '../../components/result/AiReviewerPanel/AiReviewerPanel';
import { UserStatusPanel } from '../../components/result/PlayerCodesPanel/PlayerCodesPanel';
import { ResultActionBar } from '../../components/result/ResultActionBar/ResultActionBar';
import { ResultChatPanel } from '../../components/result/ResultChatPanel/ResultChatPanel';
import { ResultPopup } from '../../components/result/ResultPopup/ResultPopup';
import { ResultRankingPanel } from '../../components/result/ResultRankingPanel/ResultRankingPanel';
import { ResultTeamPanel } from '../../components/result/ResultTeamPanel/ResultTeamPanel';
import {
  checkNewTitles,
  getEquippedTitle,
  loadTitles,
  saveTitles,
  type TitleDef,
} from '../../constants/titleTypes';
import { ROUTES } from '../../constants/routes';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { clearBattleAndLeave, getSessionId } from '../../services/battleSessionService';
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
}

interface DemoState {
  mode?: string;
  lang?: string;
  roundSeconds?: number;
  remaining?: number;
  ingameScore?: number;
  solveTimes?: Record<number, number>;
  battleBots?: DemoBot[];
}

interface OnlineUser {
  id?: string;
  name?: string;
  avatar?: string;
}

const MY_USER_ID = 'rocky_user';

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
    () => buildResultPlayers({ roomUsers, demoBots, submission, demoState }),
    [roomUsers, demoBots, submission, demoState],
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
  const totalSolved = Array.isArray(submission.codes)
    ? submission.codes.filter((c) => c && c.trim()).length
    : 0;

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
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>(readOnlineUsers);
  const [departedUserIds, setDepartedUserIds] = useState<Set<string>>(() => new Set());

  const titlesData = loadTitles();
  const equippedTitle = getEquippedTitle(titlesData);

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
    if (totalSolved >= (submission.problems?.length || 1)) newStats.perfectGame = true;

    const updated = { ...prev, stats: newStats };
    const newTitles = checkNewTitles(updated, newStats);
    saveTitles(updated);
    localStorage.setItem('rocky_new_titles', JSON.stringify(newTitles.map((t) => t.id)));

    const totalPlayers = allPlayers.length;
    let mainMsg = '';
    const detailLines: string[] = [];

    if (myRank === totalPlayers) {
      mainMsg = `당신은 ${totalPlayers}명 중 꼴등입니다.`;
      detailLines.push('분발하셔야 겠어요.');
    } else if (myRank === 1) {
      mainMsg = `당신은 ${totalPlayers}명 중 1등입니다.`;
    } else {
      mainMsg = `당신은 ${totalPlayers}명 중 ${myRank}등입니다.`;
    }

    if (isWin && newStats.consecutiveWins >= 3) {
      detailLines.push(`🔥 ${newStats.consecutiveWins}연속 우승!`);
    }
    if (totalSolved >= (submission.problems?.length || 1) && myRank !== totalPlayers) {
      detailLines.push('모든 문제를 완벽히 풀었습니다! 👏');
    }
    if (totalSolved === 0 && myRank === totalPlayers) {
      detailLines.push('한 문제도 풀지 못했습니다. 기본기를 다시 다져보세요.');
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
    const handleStorage = () => setOnlineUsers(readOnlineUsers());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', removeMyPresence);
    return () => window.removeEventListener('beforeunload', removeMyPresence);
  }, []);

  useEffect(() => {
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

      <div className={`result-body ${isVersusMany ? 'versus-many' : 'versus-duel'}`}>
        {isVersusMany ? (
          <div className="result-ranking-slot">
            <ResultRankingPanel
              players={allPlayers}
              rankBorderColor={rankBorderColor}
              rankGlow={rankGlow}
              departedUserIds={departedUserIds}
            />
          </div>
        ) : (
          <>
            <div className="result-win-slot">
              <ResultTeamPanel variant="win" players={winners} departedUserIds={departedUserIds} />
            </div>
            <div className="result-lose-slot">
              <ResultTeamPanel variant="lose" players={losers} departedUserIds={departedUserIds} />
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

        <div className="result-sidebar-slot">
          <div className="result-status-slot">
            <UserStatusPanel
              onlineUsers={onlineUsers}
              equippedTitle={equippedTitle}
              myUserId={MY_USER_ID}
              departedUserIds={departedUserIds}
            />
          </div>
          <div className="result-action-slot">
            <ResultActionBar onReplay={replayToRoom} onExit={clearSessionAndNavigateLobby} />
          </div>
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
