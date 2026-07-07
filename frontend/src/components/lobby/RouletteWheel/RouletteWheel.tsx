import { ROULETTE_COST, ROULETTE_ITEMS, ROULETTE_SEG_COLORS } from '../../../constants/itemTypes';
import { useModalShake } from '../../../hooks/useModalShake';

interface RouletteWheelProps {
  open: boolean;
  gold: number;
  spinning: boolean;
  result: string | null;
  wheelDeg: number;
  onClose: () => void;
  onSpin: () => void;
}

const SEG_ANGLE = 360 / ROULETTE_ITEMS.length;

export function RouletteWheel({ open, gold, spinning, result, wheelDeg, onClose, onSpin }: RouletteWheelProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  const handleClose = () => {
    if (!spinning) onClose();
  };

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div
        className={`modal-content roulette-modal${shaking ? ' modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="roulette-close-x" onClick={handleClose} aria-label="닫기">
          ×
        </button>
        <h3 className="text-center pixel-text-primary roulette-modal-title">
          🎰 아이템 룰렛
        </h3>
        <div className="roulette-modal-info">
          보유 골드: {gold.toLocaleString()} G | 1회: {ROULETTE_COST} G
        </div>
        <div className="roulette-wheel-wrap">
          <div className="roulette-arrow" />
          <div
            className="roulette-wheel"
            style={{
              transform: `rotate(${wheelDeg}deg)`,
              background: `conic-gradient(${ROULETTE_SEG_COLORS.map((c, i) => `${c} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`).join(',')})`,
            }}
          >
            {ROULETTE_ITEMS.map((item, idx) => {
              const angle = idx * SEG_ANGLE + SEG_ANGLE / 2;
              const r = 100;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(-50%,-50%) rotate(${angle}deg) translateY(-${r}px)`,
                    fontSize: '22px',
                    textShadow: '1px 1px 0 #000',
                    pointerEvents: 'none',
                  }}
                >
                  {item.icon}
                </div>
              );
            })}
            <div className="roulette-center">🎰</div>
          </div>
        </div>
        <div className={`roulette-result${result ? ` ${result.includes('꽝') ? 'is-fail' : 'is-win'}` : ''}`}>
          {result ?? ''}
        </div>
        <div className="roulette-actions">
          <button
            type="button"
            className="pixel-btn roulette-spin-btn"
            style={{ background: '#E67E22', color: '#000', textShadow: 'none', borderColor: '#D35400' }}
            onClick={() => {
              if (gold < ROULETTE_COST || spinning) {
                triggerShake();
                return;
              }
              onSpin();
            }}
            disabled={spinning}
          >
            {spinning ? '돌리는 중...' : `🎰 돌리기 (${ROULETTE_COST}G)`}
          </button>
        </div>
      </div>
    </div>
  );
}
