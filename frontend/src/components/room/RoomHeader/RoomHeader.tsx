interface RoomHeaderProps {
  roomTitle: string;
  isPrivate: boolean;
  playerCount: number;
  maxPlayers: number;
}

export function RoomHeader({ roomTitle, isPrivate, playerCount, maxPlayers }: RoomHeaderProps) {
  return (
    <div className="room-header">
      <h3 className="room-title">#001 - {roomTitle}</h3>
      <div className="room-info-badge">
        {isPrivate ? 'PRIVATE 🔒 | ' : 'PUBLIC | '}
        {playerCount}/{maxPlayers}명
      </div>
    </div>
  );
}
