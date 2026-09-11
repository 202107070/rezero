interface RoomActionBarProps {
  isHost: boolean;
  myIsReady: boolean;
  onReadyToggle: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function RoomActionBar({
  isHost,
  myIsReady,
  onReadyToggle,
  onStart,
  onLeave,
}: RoomActionBarProps) {
  return (
    <div className="room-action-bar">
      <div className={`room-bottom-bar${isHost ? ' host-bar' : ''}`}>
        {isHost ? (
          <>
            <button type="button" className="btn-ready btn-compact start" onClick={onStart}>
              START
            </button>
            <button type="button" className="btn-ready btn-compact room-lobby-btn" onClick={onLeave}>
              로비
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`btn-ready btn-compact ${myIsReady ? 'is-ready' : ''}`} onClick={onReadyToggle}>
              {myIsReady ? 'READY ✓' : 'READY'}
            </button>
            <button type="button" className="btn-ready btn-compact room-lobby-btn" onClick={onLeave}>
              로비
            </button>
          </>
        )}
      </div>
    </div>
  );
}
