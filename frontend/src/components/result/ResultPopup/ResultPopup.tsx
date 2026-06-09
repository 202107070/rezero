import type { TitleDef } from '../../../constants/titleTypes';

interface ResultPopupProps {
  show: boolean;
  mainMsg: string;
  detailLines: string[];
  newTitles: TitleDef[];
  rankBorderColor: string;
  onClose: () => void;
}

export function ResultPopup({
  show,
  mainMsg,
  detailLines,
  newTitles,
  rankBorderColor,
  onClose,
}: ResultPopupProps) {
  if (!show) return null;

  return (
    <div className="result-popup-overlay" onClick={onClose}>
      <div className="result-popup-box" onClick={(e) => e.stopPropagation()} style={{ borderColor: rankBorderColor }}>
        <div className="result-popup-msg" style={mainMsg.includes('꼴등') ? { color: 'var(--px-danger)' } : {}}>
          {mainMsg}
        </div>
        {detailLines.length > 0 && (
          <div className="result-popup-sub">
            {detailLines.map((line, i) => (
              <div
                key={i}
                style={
                  line.includes('연속 우승')
                    ? { color: 'var(--px-warning)', fontSize: '22px', textShadow: '2px 2px 0 #000', marginBottom: '4px' }
                    : { marginBottom: '4px' }
                }
              >
                {line}
              </div>
            ))}
          </div>
        )}
        {newTitles.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '18px', color: 'var(--px-success)', marginBottom: '6px' }}>
              🏆 새로운 칭호 {newTitles.length}개를 획득했습니다!
            </div>
            {newTitles.map((t) => (
              <span key={t.id} className={`result-popup-title rarity-${t.rarity}`}>
                {t.icon} {t.name}
              </span>
            ))}
          </div>
        )}
        <button type="button" className="pixel-btn pixel-btn-primary" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
