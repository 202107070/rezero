import { useEffect, useState } from 'react';
import { useModalShake } from '../../../hooks/useModalShake';
import type { RoomFilterState } from '../../../types/roomFilter';
import { EMPTY_ROOM_FILTER } from '../../../types/roomFilter';
import { cloneRoomFilter, toggleFilterValue } from '../../../utils/roomFilterUtils';

interface RoomFilterModalProps {
  open: boolean;
  filter: RoomFilterState;
  onClose: () => void;
  onApply: (filter: RoomFilterState) => void;
}

type FilterCategoryKey = keyof RoomFilterState;

interface FilterOption {
  id: string;
  label: string;
}

interface FilterCategory {
  key: FilterCategoryKey;
  label: string;
  options: FilterOption[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  {
    key: 'playerModes',
    label: '인원 방식',
    options: [
      { id: '1/1', label: '1/1' },
      { id: '1/N', label: '1/N' },
    ],
  },
  {
    key: 'difficulties',
    label: '난이도',
    options: [
      { id: '쉬움', label: '쉬움' },
      { id: '보통', label: '보통' },
      { id: '어려움', label: '어려움' },
    ],
  },
  {
    key: 'languages',
    label: '언어',
    options: [
      { id: 'JAVA', label: 'JAVA' },
      { id: 'PYTHON', label: 'PYTHON' },
      { id: 'C++', label: 'C++' },
      { id: 'HTML', label: 'HTML' },
      { id: 'CSS', label: 'CSS' },
      { id: 'RANDOM', label: '🎲 랜덤' },
    ],
  },
  {
    key: 'problemCounts',
    label: '문제 수',
    options: ['3', '4', '5', '6', '7', '8', '9', '10'].map((n) => ({
      id: n,
      label: `${n}문제`,
    })),
  },
  {
    key: 'gameModes',
    label: '게임 모드',
    options: [
      { id: 'normal', label: '일반' },
      { id: 'item', label: '아이템' },
    ],
  },
  {
    key: 'visibility',
    label: '공개 설정',
    options: [
      { id: 'public', label: '공개' },
      { id: 'private', label: '비공개' },
    ],
  },
];

export function RoomFilterModal({ open, filter, onClose, onApply }: RoomFilterModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [draft, setDraft] = useState<RoomFilterState>(EMPTY_ROOM_FILTER);

  useEffect(() => {
    if (open) setDraft(cloneRoomFilter(filter));
  }, [open, filter]);

  if (!open) return null;

  const handleToggle = (key: FilterCategoryKey, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [key]: toggleFilterValue(prev[key] as string[], value) as RoomFilterState[FilterCategoryKey],
    }));
  };

  const handleApply = () => {
    onApply(cloneRoomFilter(draft));
    onClose();
  };

  const handleReset = () => {
    setDraft(EMPTY_ROOM_FILTER);
  };

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div className={`modal-content room-filter-modal${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary room-filter-title">FILTER</h3>
        <div className="room-filter-body">
          {FILTER_CATEGORIES.map((category) => (
            <div className="room-filter-category" key={category.key}>
              <div className="room-filter-category-label">{category.label}</div>
              <div className="room-filter-options">
                {category.options.map((option) => {
                  const selected = (draft[category.key] as string[]).includes(option.id);
                  return (
                    <label key={option.id} className={`room-filter-option ${selected ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => handleToggle(category.key, option.id)}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="room-filter-actions">
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={handleReset}>
            초기화
          </button>
          <button type="button" className="pixel-btn pixel-btn-primary" onClick={handleApply}>
            적용
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
