import { ROULETTE_COST, ROULETTE_ITEMS, ROULETTE_SEG_COLORS } from '../../../constants/itemTypes';

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
  if (!open) return null;

  const handleClose = () => {
    if (!spinning) onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', padding: '24px' }}>
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '8px', fontSize: '22px' }}>
          🎰 아이템 룰렛
        </h3>
        <div style={{ marginBottom: '8px', fontSize: '14px', color: 'var(--px-warning)', textAlign: 'center' }}>
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
        {result && (
          <div
            style={{
              textAlign: 'center',
              marginBottom: '10px',
              color: result.includes('꽝') ? 'var(--px-danger)' : 'var(--px-success)',
              fontSize: '18px',
              textShadow: '2px 2px 0 #000',
            }}
          >
            {result}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <button
            type="button"
            className="pixel-btn"
            style={{ background: '#E67E22', color: '#000', textShadow: 'none', borderColor: '#D35400' }}
            onClick={onSpin}
            disabled={gold < ROULETTE_COST || spinning}
          >
            {spinning ? '돌리는 중...' : `🎰 돌리기 (${ROULETTE_COST}G)`}
          </button>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={handleClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
