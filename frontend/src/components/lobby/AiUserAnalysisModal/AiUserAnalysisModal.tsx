import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalShake } from '../../../hooks/useModalShake';
import { ApiError, apiRequest } from '../../../services/apiClient';

interface AiUserAnalysisModalProps {
  open: boolean;
  userId: string;
  userName: string;
  historyId?: string;
  onClose: () => void;
}

interface AiAnalysisResponse {
  displayName?: string;
  source?: string;
  analysis?: string;
  roomId?: string;
  lang?: string;
  historyId?: string;
  summary?: {
    totalWins?: number;
    losses?: number;
    winrate?: number;
    ratingScore?: number;
    favoriteLang?: string | null;
    strongestWinLang?: string | null;
    avgSolveTimeSec?: number;
    solveRate?: number;
    recentMatchCount?: number;
    roomId?: string;
    lang?: string;
    problemCount?: number;
    axes?: Array<{ label: string; value: number; detail?: string; why?: string }>;
  };
}

function clampPercent(value: number | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function RadarChart({
  axes,
}: {
  axes: Array<{ label: string; value: number; detail: string; why?: string }>;
}) {
  const [hover, setHover] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const size = 460;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 132;
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
    const scale = clampPercent(axis.value) / 100;
    return {
      label: axis.label,
      x: cx + Math.cos(angle) * radius * scale,
      y: cy + Math.sin(angle) * radius * scale,
      lx: cx + Math.cos(angle) * (radius + 48),
      ly: cy + Math.sin(angle) * (radius + 48),
      gx: cx + Math.cos(angle) * radius,
      gy: cy + Math.sin(angle) * radius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  const grid = [0.35, 0.65, 1];
  const active = hover == null ? null : points[hover.index];
  const activeAxis = hover == null ? null : axes[hover.index];
  return (
    <div className="ai-radar-wrap">
    <svg className="ai-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="분석 그래프">
      {grid.map((scale) => (
        <polygon
          key={scale}
          fill="none"
          stroke="#3d4a44"
          strokeWidth="1"
          points={axes
            .map((_, index) => {
              const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
              return `${cx + Math.cos(angle) * radius * scale},${cy + Math.sin(angle) * radius * scale}`;
            })
            .join(' ')}
        />
      ))}
      {points.map((point) => (
        <line key={point.label} x1={cx} y1={cy} x2={point.gx} y2={point.gy} stroke="#3d4a44" />
      ))}
      <polygon points={polygon} fill="rgba(46, 204, 113, 0.35)" stroke="#2ecc71" strokeWidth="2" />
      {points.map((point, index) => (
        <g
          key={`${point.label}-label`}
          onMouseEnter={(event) => setHover({ index, x: event.clientX, y: event.clientY })}
          onMouseMove={(event) => setHover({ index, x: event.clientX, y: event.clientY })}
          onMouseLeave={() => setHover(null)}
        >
          <circle cx={point.lx} cy={point.ly} r="22" fill="transparent" />
          <text x={point.lx} y={point.ly} textAnchor="middle" className="ai-radar-label">
            {point.label}
          </text>
        </g>
      ))}
    </svg>
    {hover &&
      active &&
      activeAxis &&
      createPortal(
        <div
          className="ai-radar-tip is-on"
          style={{
            left: Math.min(hover.x + 16, window.innerWidth - 280),
            top: Math.min(hover.y + 18, window.innerHeight - 140),
          }}
          role="status"
        >
          <strong>{active.label}</strong>
          <span>{activeAxis.detail}</span>
          {(activeAxis.why || '')
            .split('\n')
            .filter(Boolean)
            .map((line) => (
              <p key={line}>{line}</p>
            ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function AiUserAnalysisModal({ open, userId, userName, historyId, onClose }: AiUserAnalysisModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiAnalysisResponse | null>(null);

  useEffect(() => {
    if (!open || (!userId && !historyId)) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setResult(null);
    void apiRequest<AiAnalysisResponse>('/users/ai-analysis', {
      method: 'POST',
      body: JSON.stringify(historyId ? { historyId } : { userId }),
    })
      .then((payload) => {
        if (cancelled) return;
        setResult(payload);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'AI 분석을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, userId, historyId]);

  if (!open) return null;

  const summary = result?.summary;

  return (
    <div className="modal-overlay" onClick={triggerShake} style={{ zIndex: 6000 }}>
      <div
        className={`modal-content ai-analysis-modal${shaking ? ' modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '10px', fontSize: '20px' }}>
          AI 분석
        </h3>
        <div className="ai-analysis-subtitle">
          {historyId
            ? `${result?.roomId ? `${result.roomId}번 방` : userName}${
                result?.lang || result?.summary?.lang ? ` · ${result.lang || result.summary?.lang}` : ''
              }`
            : result?.displayName || userName}
        </div>

        {loading && (
          <div className="ai-analysis-loading">
            <div className="ai-analysis-countdown">잠시만 기다려주세요.</div>
            <div className="ai-analysis-spinner" aria-hidden="true" />
          </div>
        )}

        {!loading && error && <div className="ai-analysis-error">{error}</div>}

        {!loading && !error && result && (
          <>
            {summary && (
              <RadarChart
                axes={
                  summary.axes && summary.axes.length > 0
                    ? summary.axes.map((axis) => ({
                        label: axis.label,
                        value: clampPercent(axis.value),
                        detail: axis.detail || '',
                        why: axis.why || '',
                      }))
                    : [
                        {
                          label: '정답',
                          value: clampPercent(summary.solveRate ?? summary.winrate),
                          detail: `${summary.roomId ? `${summary.roomId}번 방` : userName}`,
                          why: '이 방의 답안만 정답과 비교한 비율입니다.\n다른 방의 승패는 이 그래프에 넣지 않습니다.',
                        },
                      ]
                }
              />
            )}
          </>
        )}

        <div className="text-center" style={{ marginTop: '14px' }}>
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose} disabled={loading}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
