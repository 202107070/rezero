import type { Room } from '../../../types/lobby';
import { EmptyRoomCard, RoomCard } from '../RoomCard/RoomCard';

const ROOMS_PER_PAGE = 4;

interface RoomListProps {
  rooms: Room[];
  currentPage: number;
  filterSummary: string;
  onPageChange: (page: number) => void;
  onJoinRoom: (room: Room) => void;
  onCreateRoom: () => void;
  onOpenFilter: () => void;
  onPractice: () => void;
}

export function RoomList({
  rooms,
  currentPage,
  filterSummary,
  onPageChange,
  onJoinRoom,
  onCreateRoom,
  onOpenFilter,
  onPractice,
}: RoomListProps) {
  const totalPages = Math.max(1, Math.ceil(rooms.length / ROOMS_PER_PAGE));
  const paginatedRooms = rooms.slice(currentPage * ROOMS_PER_PAGE, (currentPage + 1) * ROOMS_PER_PAGE);

  return (
    <div className="pixel-card d-flex flex-column room-list-card">
      <div className="room-list-toolbar">
        <button type="button" className="pixel-btn pixel-btn-secondary room-filter-btn" onClick={onOpenFilter}>
          필터
        </button>
        <span className="room-filter-label">{filterSummary}</span>
      </div>
      <div className="room-list-grid">
        {Array.from({ length: ROOMS_PER_PAGE }, (_, i) => {
          const room = paginatedRooms[i];
          if (room) return <RoomCard key={room.id} room={room} onJoin={onJoinRoom} />;
          return <EmptyRoomCard key={`empty-${i}`} index={i} />;
        })}
      </div>
      <div className="text-center" style={{ marginTop: 'auto', paddingTop: '4px' }}>
        <div className="pagination-box">
          <span
            className={`page-arrow ${currentPage <= 0 ? 'disabled' : ''}`}
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          >
            ◀
          </span>
          <span style={{ color: '#ddd', fontSize: '20px' }}>
            {currentPage + 1} / {totalPages}
          </span>
          <span
            className={`page-arrow ${currentPage >= totalPages - 1 ? 'disabled' : ''}`}
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          >
            ▶
          </span>
        </div>
      </div>
      <div className="lobby-actions">
        <button type="button" className="pixel-btn pixel-btn-primary" onClick={onCreateRoom}>
          방만들기
        </button>
        <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onPractice}>
          연습모드
        </button>
      </div>
    </div>
  );
}
