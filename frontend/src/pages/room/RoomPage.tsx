import { useCallback, useEffect, useMemo, useRef, type MouseEvent, useState } from 'react';
import { getCurrentUserName } from '../../services/authService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BattleSettingsPanel } from '../../components/room/BattleSettingsPanel/BattleSettingsPanel';
import { CharacterSelect } from '../../components/room/CharacterSelect/CharacterSelect';
import { KickModal } from '../../components/room/KickModal/KickModal';
import { RoomAlertModal } from '../../components/room/RoomAlertModal/RoomAlertModal';
import { PlayerGrid } from '../../components/room/PlayerGrid/PlayerGrid';
import { RoomActionBar } from '../../components/room/RoomActionBar/RoomActionBar';
import { RoomChatPanel } from '../../components/room/RoomChatPanel/RoomChatPanel';
import { RoomHeader } from '../../components/room/RoomHeader/RoomHeader';
import { RoomProfileModal } from '../../components/room/RoomProfileModal/RoomProfileModal';
import { StartGameOverlay } from '../../components/room/StartGameOverlay/StartGameOverlay';
import {
  buildInitialMessages,
  buildInitialPlayers,
  BOT_READY_DELAY_MS,
  DEMO_BOT_POOL,
  DIFF_MAP,
  LANG_MAP,
  pickDemoBot,
} from '../../constants/roomConstants';
import { RoomItemLoadout } from '../../components/room/RoomItemLoadout/RoomItemLoadout';
import {
  defaultSelectedItemKeys,
  loadItemInventory,
  type ItemKey,
} from '../../constants/itemTypes';
import { setKickedCount, getKickedCount } from '../../services/roomStore';
import { ROUTES } from '../../constants/routes';
import type { GameMode } from '../../types/lobby';
import {
  clearRoomSession,
  prepareBattleStart,
  removeRoomFromLobby,
  updateRoomPlayerCount,
} from '../../services/battlePrepService';
import type { RoomChatMessage, RoomPlayer, RoomSettings } from '../../types/room';
import { RoomFriendMessenger } from '../../components/room/RoomFriendMessenger/RoomFriendMessenger';
import {
  addFriend,
  getFollowRoomPath,
  getUserPresence,
  isFriend,
  removeFriend,
  setUserPresence,
} from '../../services/friendStore';
import { getStartBlockReason } from '../../utils/room/roomStartValidation';
import {
  UserListContextMenu,
  type UserListMenuAction,
} from '../../components/lobby/UserListContextMenu/UserListContextMenu';
import './room.css';

export default function RoomPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const roomId = searchParams.get('id') || '';
  const roomTitleFromUrl = searchParams.get('title') || '싱글 데스매치';
  const roomPwd = searchParams.get('pwd') || '';
  const isPrivate = roomPwd.length > 0;
  const roomMode = searchParams.get('mode') || '1/1';
  const gameMode = (searchParams.get('gameMode') || 'item') as GameMode;
  const isItemMode = gameMode === 'item';

  const urlLang = searchParams.get('lang') || 'JAVA';
  const urlDiff = searchParams.get('diff') || '보통';
  const urlTimeRaw = searchParams.get('time') || '45분';
  const urlCount = searchParams.get('count') || '5';
  const urlMaxPlayers = searchParams.get('maxPlayers') || '8';
  const parsedMaxPlayers = Math.max(2, Math.min(8, parseInt(urlMaxPlayers, 10) || 8));

  const initialLang = LANG_MAP[urlLang] || 'java';
  const initialDiff = DIFF_MAP[urlDiff] || 'NORMAL';
  const initialCount = parseInt(urlCount, 10) >= 3 && parseInt(urlCount, 10) <= 10 ? urlCount : '5';

  const initialPlayers = useMemo(() => buildInitialPlayers(), []);
  const [itemInventory] = useState(loadItemInventory);
  const [selectedItems, setSelectedItems] = useState<Set<ItemKey>>(() => new Set(defaultSelectedItemKeys()));

  const [myLanguage] = useState(initialLang);
  const [myCharacter, setMyCharacter] = useState('char1');
  const [isReady, setIsReady] = useState(false);
  const [autoReady, setAutoReady] = useState(false);
  const [settings] = useState<RoomSettings>({
    time: urlTimeRaw,
    diff: initialDiff,
    theme: 'ALGORITHM: DP',
    count: initialCount,
    maxPlayers: parsedMaxPlayers,
  });
  const [showProblemModal] = useState(false);
  const [selectedProblem] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profilePlayer, setProfilePlayer] = useState<RoomPlayer | null>(null);
  const [profilePlayerIndex, setProfilePlayerIndex] = useState<number | null>(null);
  const [showKickModal, setShowKickModal] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ index: number; name: string } | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [kickedCount, setKickedCountState] = useState(() => getKickedCount(roomId));

  const [players, setPlayers] = useState<(RoomPlayer | null)[]>(initialPlayers);
  const botReadyTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = botReadyTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const clearBotReadyTimer = (playerId: number) => {
    const timer = botReadyTimersRef.current.get(playerId);
    if (timer) {
      clearTimeout(timer);
      botReadyTimersRef.current.delete(playerId);
    }
  };

  const scheduleBotReady = (playerId: number, slotIndex: number) => {
    clearBotReadyTimer(playerId);
    const timer = setTimeout(() => {
      setPlayers((prev) => {
        const next = [...prev];
        const bot = next[slotIndex];
        if (bot && bot.id === playerId && !bot.isHost) {
          next[slotIndex] = { ...bot, isReady: true, status: 'READY' };
        }
        return next;
      });
      botReadyTimersRef.current.delete(playerId);
    }, BOT_READY_DELAY_MS);
    botReadyTimersRef.current.set(playerId, timer);
  };
  const [chatMsg, setChatMsg] = useState('');
  const [chatMode, setChatMode] = useState('ALL');
  const [whisperTarget, setWhisperTarget] = useState<string | null>(null);
  const [messages, setMessages] = useState<RoomChatMessage[]>(() =>
    buildInitialMessages(roomMode, parsedMaxPlayers, initialPlayers),
  );
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    userName: string;
  } | null>(null);

  const roomQuery = searchParams.toString();

  useEffect(() => {
    const me = getCurrentUserName();
    setUserPresence(me, {
      status: 'room',
      roomId,
      roomTitle: roomTitleFromUrl,
      roomQuery,
    });
    return () => {
      setUserPresence(me, { status: 'lobby' });
    };
  }, [roomId, roomTitleFromUrl, roomQuery]);

  const appendSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, { type: 'sys', text: `>> ${text}` }]);
  };

  const handleSummonSuccess = (friendName: string) => {
    appendSystemMessage(`[${friendName}] 님을 소환했습니다.`);
  };

  const handleSummonFail = (friendName: string, reason: string) => {
    appendSystemMessage(`${friendName} 님 소환 실패: ${reason}`);
  };

  const openUserContextMenu = (event: MouseEvent, userName: string) => {
    const myUserName = getCurrentUserName();
    if (!userName || userName === myUserName) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      userName,
    });
  };

  const closeUserContextMenu = () => {
    setContextMenu(null);
  };

  const handleUserMenuAction = (action: UserListMenuAction, userName: string) => {
    switch (action) {
      case 'match-story':
        appendSystemMessage('매치 스토리는 로비에서만 열 수 있습니다.');
        break;
      case 'add-friend':
        if (isFriend(userName)) {
          removeFriend(userName);
          appendSystemMessage(`${userName} 님을 친구 목록에서 삭제했습니다.`);
        } else {
          const added = addFriend(userName);
          appendSystemMessage(
            added ? `${userName} 님을 친구 목록에 추가했습니다.` : `${userName} 님은 이미 친구 목록에 있습니다.`,
          );
        }
        break;
      case 'whisper':
        setWhisperTarget(userName);
        setChatMode('WHISPER');
        appendSystemMessage(`${userName} 님에게 귓속말 모드가 설정되었습니다.`);
        break;
      case 'follow': {
        const roomPath = getFollowRoomPath(userName);
        if (!roomPath) {
          appendSystemMessage(`${userName} 님은 현재 따라갈 수 있는 방에 없습니다.`);
          break;
        }
        appendSystemMessage(`${userName} 님이 있는 방으로 이동합니다.`);
        navigate(roomPath);
        break;
      }
      case 'summon':
        appendSystemMessage('소환하기는 친구 메신저에서 사용 가능합니다.');
        break;
      default:
        break;
    }
  };

  const host = players[0];
  const myIsReady = isReady;
  const occupiedCount = players.filter((p) => p !== null).length;
  const displayMaxPlayers = roomMode === '1/1' ? 2 : parsedMaxPlayers;
  const maxOccupancy = displayMaxPlayers;
  const canInviteMore = Boolean(host?.isHost) && occupiedCount < maxOccupancy;

  const handleSendChat = () => {
    if (!chatMsg.trim()) return;
    const modeLabel =
      chatMode === 'WHISPER' && whisperTarget
        ? `[귓속말:${whisperTarget}]`
        : chatMode === 'ALL'
          ? '[전체]'
          : '[친구]';
    setMessages((prev) => [...prev, { type: 'user', name: getCurrentUserName(), text: chatMsg, mode: modeLabel }]);
    setChatMsg('');
  };

  const handleMyReadyToggle = () => {
    if (host?.isHost) return;
    setIsReady((r) => !r);
  };

  const showStartAlert = (message: string) => {
    setAlertMessage(message);
    setShowAlertModal(true);
  };

  const handleStartGame = () => {
    if (!host?.isHost) return;

    const blockReason = getStartBlockReason(players, roomMode);
    if (blockReason) {
      showStartAlert(blockReason);
      return;
    }

    const roomRoster = players.filter((player): player is RoomPlayer => player !== null);

    prepareBattleStart({
      roomId,
      settingsDiff: settings.diff,
      settingsCount: settings.count,
      settingsMaxPlayers: settings.maxPlayers,
      myLanguage,
      roomMode,
      gameMode,
      selectedItems: isItemMode ? Array.from(selectedItems) : [],
      roomRoster,
    });

    const battleParams = new URLSearchParams({
      fresh: '1',
      roomId: roomId || '',
      lang: myLanguage || 'java',
      mode: roomMode || '1/1',
      count: settings.count || '5',
      maxPlayers: String(settings.maxPlayers || parsedMaxPlayers),
      gameMode,
    });

    navigate(`${ROUTES.BATTLE}?${battleParams.toString()}`);
  };

  const handleLeaveToLobby = () => {
    removeRoomFromLobby(roomId);
    clearRoomSession(roomId);
    navigate(ROUTES.LOBBY);
  };

  const handleKickPlayer = () => {
    if (!kickTarget) return;

    const kickedName = kickTarget.name;
    const kickedPlayer = players[kickTarget.index];
    if (kickedPlayer) clearBotReadyTimer(kickedPlayer.id);

    setPlayers((prev) => {
      const next = [...prev];
      next[kickTarget.index] = null;
      return next;
    });

    const newKicked = kickedCount + 1;
    setKickedCountState(newKicked);
    setKickedCount(roomId, newKicked);
    setMessages((prev) => [...prev, { type: 'sys', text: `>> [${kickedName}] 님이 강퇴되었습니다.` }]);
    updateRoomPlayerCount(roomId);
    setShowKickModal(false);
    setKickTarget(null);
  };

  const openProfile = (player: RoomPlayer, index: number) => {
    setProfilePlayer(player);
    setProfilePlayerIndex(index);
    setShowProfileModal(true);
  };

  const handleToggleItem = (key: ItemKey) => {
    if (itemInventory[key] <= 0) return;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleInviteBot = useCallback(
    (index: number) => {
      if (DEMO_BOT_POOL.length === 0) return;

      const slotIndex = roomMode === '1/1' ? 1 : index;
      if (!host?.isHost || players[slotIndex] !== null || occupiedCount >= maxOccupancy) return;

      const botCount = players.filter((p) => p && !p.isHost).length;
      const bot = pickDemoBot(botCount);
      const maxId = players.reduce((max, p) => (p ? Math.max(max, p.id) : max), 0);
      const newBotId = maxId + 1;

      setPlayers((prev) => {
        const next = [...prev];
        next[slotIndex] = {
          id: newBotId,
          name: bot.name,
          rank: bot.rank,
          isHost: false,
          isReady: false,
          language: bot.language,
          character: bot.character,
          status: 'WAITING',
        };
        return next;
      });
      scheduleBotReady(newBotId, slotIndex);
      setMessages((prev) => [...prev, { type: 'sys', text: `>> [${bot.name}] 님이 입장하셨습니다.` }]);
      updateRoomPlayerCount(roomId);
    },
    [host?.isHost, players, roomMode, occupiedCount, maxOccupancy, roomId],
  );

  return (
    <>
      <div className="room-page-container">
        <div className="room-layout">
          <div className="room-main-col">
            <div className="pixel-card room-main-card">
              <RoomHeader
                roomTitle={roomTitleFromUrl}
                isPrivate={isPrivate}
                playerCount={occupiedCount}
                maxPlayers={displayMaxPlayers}
              />
              <div className="room-main-body">
                <div className="room-slots-section">
                  <PlayerGrid
                    players={players}
                    roomMode={roomMode}
                    myCharacter={myCharacter}
                    myLanguage={myLanguage}
                    canInviteMore={canInviteMore}
                    onPlayerClick={openProfile}
                    onInviteBot={handleInviteBot}
                    onPlayerContextMenu={(event, player) => openUserContextMenu(event, player.name)}
                  />
                </div>
                <div className="room-chat-section">
                  <RoomChatPanel
                    messages={messages}
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
            </div>
          </div>

          <div className="room-side-col">
            <div className={`pixel-card room-side-card ${isItemMode ? 'item-mode' : 'normal-mode'}`}>
              <CharacterSelect myCharacter={myCharacter} onSelect={setMyCharacter} />
              <BattleSettingsPanel myLanguage={myLanguage} settings={settings} />
              {isItemMode && (
                <RoomItemLoadout
                  inventory={itemInventory}
                  selectedItems={selectedItems}
                  onToggle={handleToggleItem}
                />
              )}
              <div className="room-side-bottom">
                <RoomFriendMessenger
                  roomId={roomId}
                  roomTitle={roomTitleFromUrl}
                  roomQuery={roomQuery}
                  onSummonSuccess={handleSummonSuccess}
                  onSummonFail={handleSummonFail}
                  onFriendContextMenu={openUserContextMenu}
                />
                <RoomActionBar
                  isHost={Boolean(host?.isHost)}
                  myIsReady={myIsReady}
                  autoReady={autoReady}
                  onReadyToggle={handleMyReadyToggle}
                  onAutoReadyChange={setAutoReady}
                  onStart={handleStartGame}
                  onLeave={handleLeaveToLobby}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <StartGameOverlay open={showProblemModal} message={selectedProblem} />

      <RoomAlertModal
        open={showAlertModal}
        message={alertMessage}
        onClose={() => setShowAlertModal(false)}
      />

      <KickModal
        open={showKickModal}
        targetName={kickTarget?.name || ''}
        onConfirm={handleKickPlayer}
        onCancel={() => {
          setShowKickModal(false);
          setKickTarget(null);
        }}
      />

      <RoomProfileModal
        open={showProfileModal}
        player={profilePlayer}
        playerIndex={profilePlayerIndex}
        myCharacter={myCharacter}
        isHost={Boolean(host?.isHost)}
        onClose={() => setShowProfileModal(false)}
        onKick={(index, name) => {
          setKickTarget({ index, name });
          setShowKickModal(true);
        }}
      />

      {contextMenu && (
        <UserListContextMenu
          open={contextMenu.open}
          x={contextMenu.x}
          y={contextMenu.y}
          userName={contextMenu.userName}
          actionLabels={{
            'add-friend': isFriend(contextMenu.userName) ? '친구삭제' : '친구추가',
          }}
          hiddenActions={['summon']}
          disabledActions={(() => {
            const presence = getUserPresence(contextMenu.userName);
            const canFollow = isFriend(contextMenu.userName) && presence?.status === 'room';
            return canFollow ? [] : (['follow'] as UserListMenuAction[]);
          })()}
          onSelect={handleUserMenuAction}
          onClose={closeUserContextMenu}
        />
      )}
    </>
  );
}
