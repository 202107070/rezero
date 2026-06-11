interface RoomActionBarProps {
  isHost: boolean;
  myIsReady: boolean;
  autoReady: boolean;
  onReadyToggle: () => void;
  onAutoReadyChange: (checked: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function RoomActionBar({
  isHost,
  myIsReady,
  autoReady,
  onReadyToggle,
  onAutoReadyChange,
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
      {!isHost && (
        <label className="auto-ready-toggle room-auto-ready">
          <input type="checkbox" checked={autoReady} onChange={(e) => onAutoReadyChange(e.target.checked)} />
          자동 준비
        </label>
      )}
    </div>
  );
}
