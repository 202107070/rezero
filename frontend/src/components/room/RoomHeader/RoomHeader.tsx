interface RoomHeaderProps {
  roomId?: string | number;
  roomTitle: string;
  isPrivate: boolean;
  playerCount: number;
  maxPlayers: number;
}

function formatRoomNumber(roomId?: string | number): string {
  const raw = String(roomId ?? '').trim();
  if (!raw || !/^\d+$/.test(raw)) return '???';
  return raw.padStart(3, '0');
}

export function RoomHeader({ roomId, roomTitle, isPrivate, playerCount, maxPlayers }: RoomHeaderProps) {
  return (
    <div className="room-header">
      <h3 className="room-title">
        #{formatRoomNumber(roomId)} - {roomTitle}
      </h3>
      <div className="room-info-badge">
        {isPrivate ? 'PRIVATE 🔒 | ' : 'PUBLIC | '}
        {playerCount}/{maxPlayers}명
      </div>
    </div>
  );
}
