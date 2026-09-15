import { useEffect } from 'react';
import { useModalShake } from '../../../hooks/useModalShake';
import type { RoomCreateFieldKey } from '../../../utils/roomCreateValidation';

interface RoomCreateModalProps {
  open: boolean;
  playerMode: string;
  gameMode: string;
  roomTitle: string;
  difficulty: string;
  language: string;
  roomVisibility: 'public' | 'private';
  roomPwd: string;
  problemCount: string;
  shakeError: boolean;
  missingFields: RoomCreateFieldKey[];
  validationMessage: string;
  onClose: () => void;
  onConfirm: () => void;
  onPlayerModeChange: (mode: string) => void;
  onGameModeChange: (mode: string) => void;
  onRoomTitleChange: (value: string) => void;
  onDifficultyChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onRoomVisibilityChange: (value: 'public' | 'private') => void;
  onRoomPwdChange: (value: string) => void;
  onProblemCountChange: (value: string) => void;
}

const FIELD_FOCUS_IDS: Record<RoomCreateFieldKey, string> = {
  playerMode: 'room-create-player-mode',
  roomTitle: 'room-create-title',
  difficulty: 'room-create-difficulty',
  language: 'room-create-language',
  gameMode: 'room-create-game-mode',
  problemCount: 'room-create-problem-count',
  roomPwd: 'room-create-pwd',
};

function fieldClass(base: string, missing: boolean) {
  return missing ? `${base} is-invalid` : base;
}

export function RoomCreateModal({
  open,
  playerMode,
  gameMode,
  roomTitle,
  difficulty,
  language,
  roomVisibility,
  roomPwd,
  problemCount,
  shakeError,
  missingFields,
  validationMessage,
  onClose,
  onConfirm,
  onPlayerModeChange,
  onGameModeChange,
  onRoomTitleChange,
  onDifficultyChange,
  onLanguageChange,
  onRoomVisibilityChange,
  onRoomPwdChange,
  onProblemCountChange,
}: RoomCreateModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const missingSet = new Set(missingFields);

  useEffect(() => {
    if (!open || missingFields.length === 0) return;
    const first = missingFields[0];
    const id = FIELD_FOCUS_IDS[first];
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.focus();
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 50);
  }, [open, missingFields]);

  if (!open) return null;

  const handleVisibilityChange = (value: 'public' | 'private') => {
    onRoomVisibilityChange(value);
    if (value === 'public') onRoomPwdChange('');
  };

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div
        className={`modal-content ${shakeError || shaking ? 'modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '16px', fontSize: '22px' }}>
          CREATE ROOM
        </h3>
        <div
          id="room-create-player-mode"
          tabIndex={-1}
          className={`d-flex justify-content-between gap-3 mb-4 room-create-player-mode ${
            missingSet.has('playerMode') ? 'is-invalid' : ''
          }`}
        >
          {['1/1', '1/N'].map((mode) => (
            <div
              key={mode}
              className={`mode-select-btn ${playerMode === mode ? 'active' : ''}`}
              onClick={() => onPlayerModeChange(mode)}
            >
              {mode}
            </div>
          ))}
        </div>
        <div className={`input-row mb-3 ${missingSet.has('roomTitle') ? 'is-invalid' : ''}`}>
          <span className="input-label">방 제목</span>
          <input
            id="room-create-title"
            type="text"
            className={fieldClass('modal-input-new', missingSet.has('roomTitle'))}
            value={roomTitle}
            onChange={(e) => onRoomTitleChange(e.target.value)}
            autoFocus
            aria-invalid={missingSet.has('roomTitle')}
          />
        </div>
        <div className="modal-row mb-3">
          <select
            id="room-create-difficulty"
            className={fieldClass('modal-select-new', missingSet.has('difficulty'))}
            value={difficulty}
            onChange={(e) => onDifficultyChange(e.target.value)}
            aria-invalid={missingSet.has('difficulty')}
          >
            <option value="" disabled>
              난이도
            </option>
            <option value="쉬움">쉬움</option>
            <option value="보통">보통</option>
            <option value="어려움">어려움</option>
          </select>
          <select
            id="room-create-language"
            className={fieldClass('modal-select-new', missingSet.has('language'))}
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            aria-invalid={missingSet.has('language')}
          >
            <option value="" disabled>
              언어
            </option>
            <option value="JAVA">JAVA</option>
            <option value="PYTHON">PYTHON</option>
            <option value="C++">C++</option>
            <option value="HTML">HTML</option>
            <option value="CSS">CSS</option>
            <option value="RANDOM">🎲 랜덤</option>
          </select>
        </div>
        <div className="modal-row mb-3">
          <select
            id="room-create-game-mode"
            className={fieldClass('modal-select-new', missingSet.has('gameMode'))}
            value={gameMode}
            onChange={(e) => onGameModeChange(e.target.value)}
            aria-invalid={missingSet.has('gameMode')}
          >
            <option value="" disabled>
              모드
            </option>
            <option value="normal">일반</option>
            <option value="item">아이템</option>
          </select>
          <select
            id="room-create-problem-count"
            className={fieldClass('modal-select-new', missingSet.has('problemCount'))}
            value={problemCount}
            onChange={(e) => onProblemCountChange(e.target.value)}
            aria-invalid={missingSet.has('problemCount')}
          >
            <option value="" disabled>
              문제 수
            </option>
            {['3', '4', '5', '6', '7', '8', '9', '10'].map((n) => (
              <option key={n} value={n}>
                문제 {n}개
              </option>
            ))}
          </select>
        </div>
        <div className={`room-visibility-row mb-4 ${roomVisibility === 'private' ? 'is-private' : ''}`}>
          <select
            className="modal-select-new"
            value={roomVisibility}
            onChange={(e) => handleVisibilityChange(e.target.value as 'public' | 'private')}
          >
            <option value="public">공개</option>
            <option value="private">비공개</option>
          </select>
          {roomVisibility === 'private' && (
            <input
              id="room-create-pwd"
              type="password"
              className={fieldClass('modal-pwd-compact', missingSet.has('roomPwd'))}
              placeholder="비밀번호"
              value={roomPwd}
              onChange={(e) => onRoomPwdChange(e.target.value)}
              aria-invalid={missingSet.has('roomPwd')}
            />
          )}
        </div>
        {validationMessage && (
          <p className="room-create-validation-msg" role="alert">
            {validationMessage}
          </p>
        )}
        <div className="d-flex justify-content-end gap-3">
          <button type="button" className="pixel-btn pixel-btn-primary" style={{ minWidth: '120px' }} onClick={onConfirm}>
            생성
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '120px' }} onClick={onClose}>
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
