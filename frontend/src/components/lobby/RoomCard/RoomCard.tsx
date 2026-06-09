import type { Room } from '../../../types/lobby';
import { parseRoomOccupancy } from '../../../utils/roomUtils';

interface RoomCardProps {
  room: Room;
  onJoin: (room: Room) => void;
}

export function RoomCard({ room, onJoin }: RoomCardProps) {
  const roomLang = room.lang || 'JAVA';
  const roomDiff = room.diff || '보통';
  const roomCount = room.count || '5';
  const { current, max } = parseRoomOccupancy(room);
  const isFull = current >= max;
  const canJoin = room.status === 'WAITING' && !isFull;

  return (
    <div
      className={`room-slot ${isFull ? 'full' : ''} ${room.status === 'STARTED' ? 'started' : ''}`}
      onClick={() => canJoin && onJoin(room)}
    >
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="room-number">{room.id}</span>
        <span className="room-title">{room.title}</span>
      </div>
      <div className="room-info-row">
        <span className="room-players">
          {current}/{max}
        </span>
        <span className={`room-status ${room.status === 'STARTED' ? 'status-started' : 'status-waiting'}`}>
          {room.status}
        </span>
      </div>
      <div className="room-meta-row">
        <span className="room-meta-pill">{roomLang}</span>
        <span className="room-meta-pill">{roomDiff}</span>
        <span className="room-meta-pill">{room.mode || '1/1'}</span>
        <span className="room-meta-pill">{roomCount}문제</span>
      </div>
    </div>
  );
}

export function EmptyRoomCard({ index }: { index: number }) {
  return (
    <div className="room-slot empty" key={`empty-${index}`}>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="room-number">-</span>
        <span className="room-title" style={{ color: '#555', fontSize: '13px' }}>
          EMPTY
        </span>
      </div>
      <div className="room-info-row">
        <span className="room-players">-</span>
        <span className="room-status" style={{ color: '#555' }}>
          -
        </span>
      </div>
      <div className="room-meta-row">
        <span className="room-meta-pill" style={{ color: '#555' }}>
          LANG
        </span>
        <span className="room-meta-pill" style={{ color: '#555' }}>
          DIFF
        </span>
        <span className="room-meta-pill" style={{ color: '#555' }}>
          TIME
        </span>
        <span className="room-meta-pill" style={{ color: '#555' }}>
          CNT
        </span>
      </div>
    </div>
  );
}
