import { useEffect, useState } from 'react';
import { useModalShake } from '../../../hooks/useModalShake';
import type { AudioSettings } from '../../../types/audioSettings';
import type { DisplayMode } from '../../../types/electron';

interface SettingsModalProps {
  open: boolean;
  displayMode: DisplayMode;
  audioSettings: AudioSettings;
  onClose: () => void;
  onConfirm: (displayMode: DisplayMode, audioSettings: AudioSettings) => void;
}

export function SettingsModal({
  open,
  displayMode,
  audioSettings,
  onClose,
  onConfirm,
}: SettingsModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [draftMode, setDraftMode] = useState<DisplayMode>(displayMode);
  const [draftAudio, setDraftAudio] = useState<AudioSettings>(audioSettings);

  useEffect(() => {
    if (open) {
      setDraftMode(displayMode);
      setDraftAudio(audioSettings);
    }
  }, [open, displayMode, audioSettings]);

  if (!open) return null;

  const handleConfirm = () => {
    onConfirm(draftMode, draftAudio);
    onClose();
  };

  const toggleAudio = (key: keyof AudioSettings) => {
    setDraftAudio((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div className={`modal-content settings-modal${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary settings-modal-title">SETTINGS</h3>

        <div className="settings-section">
          <div className="settings-section-label">화면 비율</div>
          <div className="settings-display-mode-row">
            <button
              type="button"
              className={`settings-mode-btn${draftMode === 'window' ? ' active' : ''}`}
              onClick={() => setDraftMode('window')}
            >
              🪟 창 모드
            </button>
            <button
              type="button"
              className={`settings-mode-btn${draftMode === 'fullscreen' ? ' active' : ''}`}
              onClick={() => setDraftMode('fullscreen')}
            >
              🖥️ 전체 화면
            </button>
          </div>
          <div className="settings-mode-hint">
            {draftMode === 'window'
              ? '1280×960 고정 창으로 실행됩니다.'
              : '모니터 전체 화면으로 실행됩니다.'}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-label">음악</div>
          <div className="settings-audio-list">
            <div className="settings-audio-item">
              <div className="settings-audio-copy">
                <span className="settings-audio-name">🎵 로비 음악</span>
                <span className="settings-audio-desc">로비에서 재생되는 차분한 픽셀 BGM</span>
              </div>
              <button
                type="button"
                className={`settings-audio-toggle${draftAudio.lobbyMusic ? ' on' : ''}`}
                onClick={() => toggleAudio('lobbyMusic')}
              >
                {draftAudio.lobbyMusic ? 'ON' : 'OFF'}
              </button>
            </div>
            <div className="settings-audio-item">
              <div className="settings-audio-copy">
                <span className="settings-audio-name">⚔️ 대결 음악</span>
                <span className="settings-audio-desc">배틀 중 긴장감 있는 BGM (잔여 30초 이하 시 변주)</span>
              </div>
              <button
                type="button"
                className={`settings-audio-toggle${draftAudio.battleMusic ? ' on' : ''}`}
                onClick={() => toggleAudio('battleMusic')}
              >
                {draftAudio.battleMusic ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-modal-actions">
          <button type="button" className="pixel-btn pixel-btn-primary" onClick={handleConfirm}>
            확인
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
