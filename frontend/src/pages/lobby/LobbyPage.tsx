import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryPanel } from '../../components/lobby/InventoryPanel/InventoryPanel';
import { InventoryItemsModal } from '../../components/lobby/InventoryItemsModal/InventoryItemsModal';
import { LobbyChatPanel } from '../../components/lobby/LobbyChatPanel/LobbyChatPanel';
import { MatchStoryModal } from '../../components/lobby/MatchStoryModal/MatchStoryModal';
import { RoomFilterModal } from '../../components/lobby/RoomFilterModal/RoomFilterModal';
import { PracticeModal } from '../../components/lobby/PracticeModal/PracticeModal';
import { ProfilePanel } from '../../components/lobby/ProfilePanel/ProfilePanel';
import { RankingBoard } from '../../components/lobby/RankingBoard/RankingBoard';
import type { UserListMenuAction } from '../../components/lobby/UserListContextMenu/UserListContextMenu';
import { JoinRoomPasswordModal } from '../../components/lobby/JoinRoomPasswordModal/JoinRoomPasswordModal';
import { RoomCreateModal } from '../../components/lobby/RoomCreateModal/RoomCreateModal';
import { RoomList } from '../../components/lobby/RoomList/RoomList';
import { RouletteWheel } from '../../components/lobby/RouletteWheel/RouletteWheel';
import { ExitConfirmModal } from '../../components/lobby/ExitConfirmModal/ExitConfirmModal';
import { SettingsModal } from '../../components/lobby/SettingsModal/SettingsModal';
import { TitleModal } from '../../components/lobby/TitleModal/TitleModal';
import { ROULETTE_COST, ROULETTE_ITEMS, type ItemInventory } from '../../constants/itemTypes';
import { ROUTES } from '../../constants/routes';
import { useAuthUser } from '../../contexts/AuthContext';
import { loadTitles, type TitleData } from '../../constants/titleTypes';
import {
  buildRoomSearchParams,
  createRoom,
  fetchRooms,
  getRoomErrorMessage,
  setPendingJoinPassword,
} from '../../services/roomService';
import { getCurrentDisplayName, getCurrentUserName } from '../../services/authService';
import { apiRequest } from '../../services/apiClient';
import {
  emitFriendRequest,
  emitFriendRequestResult,
  joinRoomSocket,
  LOBBY_ROOM_ID,
  onRoomEvent,
  ROOM_SOCKET_EVENTS,
  sendRoomMessage,
  type ChatMessagePayload,
  type LobbyPresencePayload,
} from '../../services/roomSocket';
import {
  addFriend,
  getFollowRoomPath,
  getFriendNames,
  isFriend,
  removeFriend,
  setUserPresence,
} from '../../services/friendStore';
import {
  getEquippedTitleId,
  getGold,
  getItemInventory,
  setGold,
  updateItemInventory,
} from '../../services/userService';
import type { ChatMessage, CodeHistoryEntry, GameMode, LobbyUser, Room } from '../../types/lobby';
import { persistCodeHistory, readCodeHistory } from '../../utils/codeHistoryUtils';
import { EMPTY_ROOM_FILTER } from '../../types/roomFilter';
import type { RoomFilterState } from '../../types/roomFilter';
import { getRoomFilterSummary, matchesRoomFilter } from '../../utils/roomFilterUtils';
import type { AudioSettings } from '../../types/audioSettings';
import type { DisplayMode } from '../../types/electron';
import { loadAudioSettings, saveAudioSettings } from '../../utils/audio/audioSettings';
import { applyAudioSettings, BattleBGM, LobbyBGM } from '../../utils/audio/gameAudio';
import { applyDisplayMode, loadDisplayMode, quitApp } from '../../utils/windowBridge';
import './lobby.css';

const SEG_ANGLE = 360 / ROULETTE_ITEMS.length;

function loadInitialUsers(): LobbyUser[] {
  const me = getCurrentDisplayName() || getCurrentUserName();
  if (!me) return [];
  return [{ name: me, rank: '-', title: getEquippedTitleId() }];
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const authUser = useAuthUser();

  const [showModal, setShowModal] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [showRoomFilterModal, setShowRoomFilterModal] = useState(false);
  const [activeTab, setActiveTab] = useState('일반');
  const [playerMode, setPlayerMode] = useState('');
  const [gameMode, setGameMode] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [language, setLanguage] = useState('');
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('public');
  const [roomPwd, setRoomPwd] = useState('');
  const [problemCount, setProblemCount] = useState('');
  const [modalShake, setModalShake] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMsg, setChatMsg] = useState('');
  const [chatMode, setChatMode] = useState('ALL');
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null);
  const [practiceLang, setPracticeLang] = useState('JAVA');
  const [practiceDiff, setPracticeDiff] = useState('보통');
  const [practiceCount, setPracticeCount] = useState('5');
  const [currentPage, setCurrentPage] = useState(0);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeHistory, setCodeHistory] = useState<CodeHistoryEntry[]>(readCodeHistory);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [roomFilter, setRoomFilter] = useState<RoomFilterState>(EMPTY_ROOM_FILTER);
  const [selectedHistoryProblemIndex, setSelectedHistoryProblemIndex] = useState(0);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [gold, setGoldState] = useState(getGold);
  const [itemInventory, setItemInventory] = useState<ItemInventory>(() => getItemInventory());
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [titleData, setTitleData] = useState<TitleData>(loadTitles);
  const [users, setUsers] = useState<LobbyUser[]>(loadInitialUsers);

  const applyOnlineUsers = useCallback(
    (online: Array<{ userId?: string; username?: string; displayName?: string }>) => {
      const meName = authUser.displayName || authUser.username;
      const mapped: LobbyUser[] = online.map((user) => ({
        name: user.displayName || user.username || user.userId || 'USER',
        rank: '-',
        title:
          meName && (user.displayName === meName || user.username === authUser.username)
            ? getEquippedTitleId()
            : null,
        userId: user.userId,
      }));
      if (meName && !mapped.some((u) => u.name === meName || u.userId === authUser.id)) {
        mapped.unshift({ name: meName, rank: '-', title: getEquippedTitleId(), userId: authUser.id });
      }
      setUsers(mapped);
    },
    [authUser.displayName, authUser.username, authUser.id],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    void (async () => {
      try {
        const joinResult = await joinRoomSocket(LOBBY_ROOM_ID);
        if (cancelled) return;
        if (joinResult.onlineUsers?.length) {
          applyOnlineUsers(joinResult.onlineUsers);
        }

        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.LOBBY_PRESENCE, (payload: LobbyPresencePayload) => {
            applyOnlineUsers(payload.users || []);
          }),
        );
        unsubs.push(
          onRoomEvent(ROOM_SOCKET_EVENTS.RECEIVE_MESSAGE, (payload: ChatMessagePayload) => {
            const name = payload.sender?.displayName || payload.sender?.username || 'UNKNOWN';
            const text = String(payload.message || '');
            if (!text) return;
            const now = new Date();
            const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setChatMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.sender === name && last.text === text) return prev;
              return [...prev, { sender: name, text, time: timeStr, mode: '[전체]' }];
            });
          }),
        );
        unsubs.push(
          onRoomEvent(
            ROOM_SOCKET_EVENTS.FRIEND_REQUEST,
            (payload?: { fromUserId?: string; fromUserName?: string }) => {
              if (!payload?.fromUserId) return;
              if (String(payload.fromUserId) === String(authUser.id)) return;
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
            (payload?: { fromUserName?: string; accepted?: boolean }) => {
              if (!payload) return;
              const now = new Date();
              const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
              if (payload.accepted) {
                if (payload.fromUserName) addFriend(payload.fromUserName);
                setFriendNames(getFriendNames());
                setChatMessages((prev) => [
                  ...prev,
                  {
                    sender: 'SYSTEM',
                    text: `${payload.fromUserName || '상대'}님이 친구 요청을 수락했습니다.`,
                    time: timeStr,
                    mode: '[안내]',
                  },
                ]);
              } else {
                setChatMessages((prev) => [
                  ...prev,
                  {
                    sender: 'SYSTEM',
                    text: `${payload.fromUserName || '상대'}님이 친구 요청을 거절했습니다.`,
                    time: timeStr,
                    mode: '[안내]',
                  },
                ]);
              }
            },
          ),
        );
      } catch {
        // REST 폴백
        try {
          const data = await apiRequest<{ users?: Array<{ userId?: string; username?: string; displayName?: string }> }>(
            '/users/online',
          );
          if (!cancelled) applyOnlineUsers(data.users || []);
        } catch {
          // ignore
        }
      }
    })();

    const poll = window.setInterval(() => {
      void apiRequest<{ users?: Array<{ userId?: string; username?: string; displayName?: string }> }>('/users/online')
        .then((data) => applyOnlineUsers(data.users || []))
        .catch(() => undefined);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      unsubs.forEach((unsub) => {
        try {
          unsub();
        } catch {
          // ignore
        }
      });
    };
  }, [applyOnlineUsers, authUser.id]);

  const [friendNames, setFriendNames] = useState<string[]>(() => getFriendNames());
  const [pendingFriendRequest, setPendingFriendRequest] = useState<{
    fromUserId: string;
    fromUserName: string;
  } | null>(null);
  const [showRoulette, setShowRoulette] = useState(false);
  const [showInventoryItemsModal, setShowInventoryItemsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadDisplayMode);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(loadAudioSettings);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [wheelDeg, setWheelDeg] = useState(0);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [joinTarget, setJoinTarget] = useState<Room | null>(null);
  const [joinPwd, setJoinPwd] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningRoom, setJoiningRoom] = useState(false);

  const refreshRooms = useCallback(async () => {
    try {
      const nextRooms = await fetchRooms();
      setRooms(nextRooms);
    } catch (error) {
      setRooms([]);
      setChatMessages((prev) => {
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return [
          ...prev,
          { sender: 'SYSTEM', text: getRoomErrorMessage(error), time: timeStr, mode: '[안내]' },
        ];
      });
    }
  }, []);

  useEffect(() => {
    BattleBGM.stop();
    applyAudioSettings(audioSettings);
    if (audioSettings.lobbyMusic) {
      LobbyBGM.start();
    } else {
      LobbyBGM.stop();
    }
    return () => LobbyBGM.stop();
  }, [audioSettings.lobbyMusic]);

  useEffect(() => {
    const me = getCurrentUserName();
    setUserPresence(me, { status: 'lobby' });
    return () => {
      setUserPresence(me, { status: 'lobby' });
    };
  }, []);

  useEffect(() => {
    void refreshRooms();
    const onPageShow = () => {
      void refreshRooms();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshRooms();
      }
    };
    const timer = window.setInterval(() => {
      void refreshRooms();
    }, 2500);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('focus', onPageShow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('focus', onPageShow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refreshRooms]);

  const filteredRooms = rooms.filter((r) => matchesRoomFilter(r, roomFilter));
  const filterSummary = getRoomFilterSummary(roomFilter);
  const safeHistoryIndex = codeHistory.length === 0 ? 0 : Math.min(selectedHistoryIndex, codeHistory.length - 1);
  const validHistoryIds = new Set(codeHistory.map((entry) => entry.historyId));
  const safeSelectedHistoryIds = selectedHistoryIds.filter((id) => validHistoryIds.has(id));

  const appendSystemChat = (text: string) => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setChatMessages((prev) => [...prev, { sender: 'SYSTEM', text, time: timeStr, mode: '[안내]' }]);
  };

  const handleSendChat = async () => {
    if (!chatMsg.trim()) return;
    const text = chatMsg.trim();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel =
      chatMode === 'WHISPER' && whisperTarget
        ? `[귓속말:${whisperTarget}]`
        : chatMode === 'ALL'
          ? '[전체]'
          : '[친구]';
    const senderName = authUser.displayName || authUser.username;
    setChatMsg('');
    setChatMessages((prev) => [...prev, { sender: senderName, text, time: timeStr, mode: modeLabel }]);
    try {
      const result = await sendRoomMessage(LOBBY_ROOM_ID, text);
      if (!result.success) {
        setChatMessages((prev) => [
          ...prev,
          { sender: 'SYSTEM', text: result.message || '채팅 전송 실패', time: timeStr, mode: '[안내]' },
        ]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: 'SYSTEM', text: '채팅 서버에 연결할 수 없습니다.', time: timeStr, mode: '[안내]' },
      ]);
    }
  };

  const handleUserMenuAction = (action: UserListMenuAction, user: LobbyUser) => {
    switch (action) {
      case 'match-story':
        setSelectedHistoryIndex(0);
        setSelectedHistoryProblemIndex(0);
        setSelectedHistoryIds([]);
        setShowCodeModal(true);
        appendSystemChat(`${user.name} 님의 매치 스토리를 열었습니다.`);
        break;
      case 'add-friend': {
        if (isFriend(user.name)) {
          removeFriend(user.name);
          setFriendNames(getFriendNames());
          appendSystemChat(`${user.name} 님을 친구 목록에서 삭제했습니다.`);
        } else {
          const added = addFriend(user.name);
          if (added) {
            setFriendNames(getFriendNames());
            appendSystemChat(`${user.name} 님에게 친구 요청을 보냈습니다.`);
          } else {
            appendSystemChat(`${user.name} 님은 이미 친구 목록에 있습니다.`);
          }
          if (user.userId) {
            void emitFriendRequest(user.userId, user.name).catch(() => undefined);
          } else {
            appendSystemChat('상대 유저 ID를 찾을 수 없어 요청 알림은 전송되지 않았습니다.');
          }
        }
        break;
      }
      case 'whisper':
        setChatMode('WHISPER');
        setWhisperTarget(user.name);
        appendSystemChat(`${user.name} 님에게 귓속말 모드가 설정되었습니다.`);
        break;
      case 'follow': {
        const roomPath = getFollowRoomPath(user.name);
        if (!roomPath) {
          appendSystemChat(`${user.name} 님은 현재 따라갈 수 있는 방에 없습니다.`);
          break;
        }
        appendSystemChat(`${user.name} 님이 있는 방으로 이동합니다.`);
        navigate(roomPath);
        break;
      }
      case 'summon':
        appendSystemChat('소환하기는 대기방에서만 사용할 수 있습니다.');
        break;
      default:
        break;
    }
  };

  const resetCreateForm = () => {
    setPlayerMode('');
    setGameMode('');
    setRoomTitle('');
    setDifficulty('');
    setLanguage('');
    setRoomVisibility('public');
    setRoomPwd('');
    setProblemCount('');
  };

  const isCreateFormValid = () =>
    Boolean(
      roomTitle.trim() &&
        playerMode &&
        difficulty &&
        language &&
        gameMode &&
        problemCount &&
        (roomVisibility === 'public' || roomPwd.trim()),
    );

  const triggerModalShake = () => {
    setModalShake(true);
    setTimeout(() => setModalShake(false), 500);
  };

  const enterRoom = (room: Room, password = '') => {
    setPendingJoinPassword(password);
    navigate(`${ROUTES.ROOM}?${buildRoomSearchParams(room).toString()}`);
  };

  const handleConfirmCreate = async () => {
    if (!isCreateFormValid()) {
      triggerModalShake();
      return;
    }
    if (creatingRoom) return;

    setCreatingRoom(true);
    try {
      const newRoom = await createRoom({
        roomTitle: roomTitle.trim(),
        playerMode,
        gameMode: gameMode as GameMode,
        difficulty,
        language,
        roomPwd: roomVisibility === 'private' ? roomPwd : '',
        problemCount,
      });

      setShowModal(false);
      resetCreateForm();
      enterRoom(newRoom);
    } catch (error) {
      triggerModalShake();
      appendSystemChat(getRoomErrorMessage(error));
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinRoom = (room: Room) => {
    if (room.isPrivate || room.pwd) {
      setJoinTarget(room);
      setJoinPwd('');
      setJoinError('');
      return;
    }
    enterRoom(room);
  };

  const handleConfirmJoinPrivate = () => {
    if (!joinTarget || joiningRoom) return;
    if (!joinPwd.trim()) {
      setJoinError('비밀번호를 입력해 주세요.');
      return;
    }
    setJoiningRoom(true);
    setJoinError('');
    enterRoom(joinTarget, joinPwd);
    setJoinTarget(null);
    setJoinPwd('');
    setJoiningRoom(false);
  };

  const spinRoulette = () => {
    if (gold < ROULETTE_COST || rouletteSpinning) return;

    setGoldState((p) => {
      const v = p - ROULETTE_COST;
      setGold(v);
      return v;
    });
    setRouletteSpinning(true);
    setRouletteResult(null);

    const targetIdx = Math.floor(Math.random() * ROULETTE_ITEMS.length);
    const correction = 360 - targetIdx * SEG_ANGLE - SEG_ANGLE / 2;
    const minTarget = wheelDeg + 360 * 8;
    const base = Math.ceil((minTarget - correction) / 360) * 360;
    const targetDeg = base + correction;
    setWheelDeg(targetDeg);

    setTimeout(() => {
      const sel = ROULETTE_ITEMS[targetIdx];
      if (sel.type === 'miss') {
        setRouletteResult('💀 꽝! 아쉽습니다.');
      } else {
        setRouletteResult(`${sel.icon} ${sel.name} 획득!`);
        setItemInventory((p) => {
          const n = { ...p, [sel.type]: (p[sel.type as keyof ItemInventory] || 0) + 1 };
          updateItemInventory(() => n);
          return n;
        });
      }
      setTimeout(() => setRouletteSpinning(false), 1200);
    }, 3200);
  };

  const handleDeleteSelectedHistory = () => {
    if (selectedHistoryIds.length === 0) return;
    const nextHistory = codeHistory.filter((entry) => !selectedHistoryIds.includes(entry.historyId));
    persistCodeHistory(nextHistory);
    setCodeHistory(nextHistory);
    setSelectedHistoryIds([]);
    setSelectedHistoryIndex((prev) => (nextHistory.length === 0 ? 0 : Math.min(prev, nextHistory.length - 1)));
    setSelectedHistoryProblemIndex(0);
  };

  const handleSelectAllHistory = () => {
    if (selectedHistoryIds.length === codeHistory.length) {
      setSelectedHistoryIds([]);
      return;
    }
    setSelectedHistoryIds(codeHistory.map((entry) => entry.historyId));
  };

  const handleSettingsConfirm = (mode: DisplayMode, nextAudio: AudioSettings) => {
    setDisplayMode(mode);
    setAudioSettings(nextAudio);
    saveAudioSettings(nextAudio);
    applyAudioSettings(nextAudio);
    if (nextAudio.lobbyMusic) LobbyBGM.start();
    else LobbyBGM.stop();
    void applyDisplayMode(mode);
  };

  const startPractice = () => {
    const params = new URLSearchParams({
      lang: practiceLang,
      diff: practiceDiff,
      count: practiceCount,
    });
    navigate(`${ROUTES.PRACTICE}?${params.toString()}`);
  };

  return (
    <>
      <div className="page-container lobby-page">
        <div className="lobby-layout">
          <div className="lobby-main">
            <div className="lobby-main-top">
              <RoomList
                rooms={filteredRooms}
                currentPage={currentPage}
                filterSummary={filterSummary}
                onPageChange={setCurrentPage}
                onJoinRoom={handleJoinRoom}
                onCreateRoom={() => {
                  resetCreateForm();
                  setShowModal(true);
                }}
                onOpenBuild={() => navigate(ROUTES.BUILD)}
                onOpenFilter={() => setShowRoomFilterModal(true)}
                onPractice={() => setShowPracticeModal(true)}
              />
            </div>
            <div className="lobby-main-bottom">
              <LobbyChatPanel
                messages={chatMessages}
                chatMsg={chatMsg}
                chatMode={chatMode}
                whisperTarget={whisperTarget}
                onChatMsgChange={setChatMsg}
                onChatModeChange={(mode) => {
                  setChatMode(mode);
                  if (mode !== 'WHISPER') setWhisperTarget(null);
                }}
                onSend={handleSendChat}
              />
            </div>
          </div>

          <aside className="lobby-sidebar">
            <ProfilePanel
              username={authUser.username}
              displayName={authUser.displayName}
              titleData={titleData}
              onOpenMatchStory={() => {
                setSelectedHistoryIndex(0);
                setSelectedHistoryProblemIndex(0);
                setSelectedHistoryIds([]);
                setShowCodeModal(true);
              }}
              onOpenTitles={() => setShowTitleModal(true)}
            />
            <InventoryPanel
              gold={gold}
              items={itemInventory}
              onOpenItems={() => setShowInventoryItemsModal(true)}
              onOpenRoulette={() => setShowRoulette(true)}
            />
            <RankingBoard
              users={users}
              friendNames={friendNames}
              activeTab={activeTab}
              titleData={titleData}
              onTabChange={setActiveTab}
              onUserMenuAction={handleUserMenuAction}
            />
          </aside>
        </div>

        <div className="lobby-action-bar">
          <button type="button" className="pixel-btn lobby-action-btn" onClick={() => setShowSettingsModal(true)}>
            ⚙️ 설정
          </button>
          <button type="button" className="pixel-btn pixel-btn-danger lobby-action-btn" onClick={() => setShowExitModal(true)}>
            🚪 나가기
          </button>
        </div>
      </div>

      <TitleModal
        open={showTitleModal}
        titleData={titleData}
        onClose={() => setShowTitleModal(false)}
        onTitleDataChange={setTitleData}
      />

      <RoomCreateModal
        open={showModal}
        playerMode={playerMode}
        gameMode={gameMode}
        roomTitle={roomTitle}
        difficulty={difficulty}
        language={language}
        roomVisibility={roomVisibility}
        roomPwd={roomPwd}
        problemCount={problemCount}
        shakeError={modalShake}
        onClose={() => {
          setShowModal(false);
          resetCreateForm();
        }}
        onConfirm={() => void handleConfirmCreate()}
        onPlayerModeChange={setPlayerMode}
        onGameModeChange={setGameMode}
        onRoomTitleChange={setRoomTitle}
        onDifficultyChange={setDifficulty}
        onLanguageChange={setLanguage}
        onRoomVisibilityChange={setRoomVisibility}
        onRoomPwdChange={setRoomPwd}
        onProblemCountChange={setProblemCount}
      />

      <JoinRoomPasswordModal
        open={joinTarget !== null}
        roomTitle={joinTarget?.title || ''}
        password={joinPwd}
        error={joinError}
        submitting={joiningRoom}
        onPasswordChange={(value) => {
          setJoinPwd(value);
          setJoinError('');
        }}
        onClose={() => {
          setJoinTarget(null);
          setJoinPwd('');
          setJoinError('');
        }}
        onConfirm={handleConfirmJoinPrivate}
      />

      <RoomFilterModal
        open={showRoomFilterModal}
        filter={roomFilter}
        onClose={() => setShowRoomFilterModal(false)}
        onApply={(nextFilter) => {
          setRoomFilter(nextFilter);
          setCurrentPage(0);
        }}
      />

      <PracticeModal
        open={showPracticeModal}
        practiceLang={practiceLang}
        practiceDiff={practiceDiff}
        practiceCount={practiceCount}
        onClose={() => setShowPracticeModal(false)}
        onStart={startPractice}
        onLangChange={setPracticeLang}
        onDiffChange={setPracticeDiff}
        onCountChange={setPracticeCount}
      />

      <RouletteWheel
        open={showRoulette}
        gold={gold}
        spinning={rouletteSpinning}
        result={rouletteResult}
        wheelDeg={wheelDeg}
        onClose={() => {
          setShowRoulette(false);
          setRouletteResult(null);
        }}
        onSpin={spinRoulette}
      />

      <InventoryItemsModal
        open={showInventoryItemsModal}
        items={itemInventory}
        onClose={() => setShowInventoryItemsModal(false)}
      />

      <SettingsModal
        open={showSettingsModal}
        displayMode={displayMode}
        audioSettings={audioSettings}
        onClose={() => setShowSettingsModal(false)}
        onConfirm={handleSettingsConfirm}
      />

      <ExitConfirmModal
        open={showExitModal}
        onConfirm={() => void quitApp()}
        onCancel={() => setShowExitModal(false)}
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
                  addFriend(pendingFriendRequest.fromUserName);
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

      <MatchStoryModal
        open={showCodeModal}
        codeHistory={codeHistory}
        selectedIndex={safeHistoryIndex}
        selectedProblemIndex={selectedHistoryProblemIndex}
        selectedIds={safeSelectedHistoryIds}
        onClose={() => setShowCodeModal(false)}
        onSelectEntry={(idx) => {
          setSelectedHistoryIndex(idx);
          setSelectedHistoryProblemIndex(0);
        }}
        onSelectProblem={setSelectedHistoryProblemIndex}
        onToggleSelection={(historyId) =>
          setSelectedHistoryIds((prev) =>
            prev.includes(historyId) ? prev.filter((id) => id !== historyId) : [...prev, historyId],
          )
        }
        onSelectAll={handleSelectAllHistory}
        onDeleteSelected={handleDeleteSelectedHistory}
      />
    </>
  );
}
