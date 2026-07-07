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
import { buildRoomSearchParams, createRoom } from '../../services/roomService';
import { getCurrentUserName } from '../../services/authService';
import {
  addFriend,
  getFollowRoomPath,
  getFriendNames,
  isFriend,
  removeFriend,
  seedDemoFriendPresence,
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
import { DEFAULT_ROOMS, loadDynamicRooms } from '../../utils/roomUtils';
import type { AudioSettings } from '../../types/audioSettings';
import type { DisplayMode } from '../../types/electron';
import { loadAudioSettings, saveAudioSettings } from '../../utils/audio/audioSettings';
import { applyAudioSettings, BattleBGM, LobbyBGM } from '../../utils/audio/gameAudio';
import { applyDisplayMode, loadDisplayMode, quitApp } from '../../utils/windowBridge';
import './lobby.css';

const SEG_ANGLE = 360 / ROULETTE_ITEMS.length;

function loadInitialUsers(): LobbyUser[] {
  const me = getCurrentUserName();
  const online: LobbyUser[] = [
    { name: me, rank: '-', title: getEquippedTitleId() },
    { name: '테스트유저1', rank: '골드', title: null },
    { name: '테스트유저2', rank: '실버', title: null },
  ];
  const seen = new Set<string>();
  return online.filter((user) => {
    if (seen.has(user.name)) return false;
    seen.add(user.name);
    return true;
  });
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
  const [users] = useState<LobbyUser[]>(loadInitialUsers);
  const [friendNames, setFriendNames] = useState<string[]>(() => getFriendNames());
  const [showRoulette, setShowRoulette] = useState(false);
  const [showInventoryItemsModal, setShowInventoryItemsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(loadDisplayMode);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(loadAudioSettings);
  const [rouletteSpinning, setRouletteSpinning] = useState(false);
  const [rouletteResult, setRouletteResult] = useState<string | null>(null);
  const [wheelDeg, setWheelDeg] = useState(0);
  const [rooms, setRooms] = useState<Room[]>(() => [...DEFAULT_ROOMS, ...loadDynamicRooms()]);

  const refreshRooms = useCallback(() => {
    setRooms([...DEFAULT_ROOMS, ...loadDynamicRooms()]);
    setCurrentPage(0);
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
    seedDemoFriendPresence();
    const me = getCurrentUserName();
    setUserPresence(me, { status: 'lobby' });
    return () => {
      setUserPresence(me, { status: 'lobby' });
    };
  }, []);

  useEffect(() => {
    window.addEventListener('pageshow', refreshRooms);
    return () => {
      window.removeEventListener('pageshow', refreshRooms);
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

  const handleSendChat = () => {
    if (!chatMsg.trim()) return;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const modeLabel =
      chatMode === 'WHISPER' && whisperTarget
        ? `[귓속말:${whisperTarget}]`
        : chatMode === 'ALL'
          ? '[전체]'
          : '[친구]';
    setChatMessages((prev) => [...prev, { sender: authUser.username, text: chatMsg, time: timeStr, mode: modeLabel }]);
    setChatMsg('');
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
            appendSystemChat(`${user.name} 님을 친구 목록에 추가했습니다.`);
          } else {
            appendSystemChat(`${user.name} 님은 이미 친구 목록에 있습니다.`);
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

  const handleConfirmCreate = () => {
    if (!isCreateFormValid()) {
      triggerModalShake();
      return;
    }

    const newRoom = createRoom({
      roomTitle: roomTitle.trim(),
      playerMode,
      gameMode: gameMode as GameMode,
      difficulty,
      language,
      roomPwd: roomVisibility === 'private' ? roomPwd : '',
      problemCount,
    });

    setRooms([...DEFAULT_ROOMS, ...loadDynamicRooms()]);
    setShowModal(false);
    resetCreateForm();

    const params = buildRoomSearchParams(newRoom);
    if (playerMode === '1/1') params.set('maxPlayers', '1');
    navigate(`${ROUTES.ROOM}?${params.toString()}`);
  };

  const handleJoinRoom = (room: Room) => {
    navigate(`${ROUTES.ROOM}?${buildRoomSearchParams(room).toString()}`);
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
        onConfirm={handleConfirmCreate}
        onPlayerModeChange={setPlayerMode}
        onGameModeChange={setGameMode}
        onRoomTitleChange={setRoomTitle}
        onDifficultyChange={setDifficulty}
        onLanguageChange={setLanguage}
        onRoomVisibilityChange={setRoomVisibility}
        onRoomPwdChange={setRoomPwd}
        onProblemCountChange={setProblemCount}
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
