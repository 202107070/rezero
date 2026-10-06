import { useEffect, useState } from 'react';
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
  axes: Array<{ label: string; value: number }>;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 78;
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / axes.length;
    const scale = clampPercent(axis.value) / 100;
    return {
      label: axis.label,
      x: cx + Math.cos(angle) * radius * scale,
      y: cy + Math.sin(angle) * radius * scale,
      lx: cx + Math.cos(angle) * (radius + 36),
      ly: cy + Math.sin(angle) * (radius + 36),
      gx: cx + Math.cos(angle) * radius,
      gy: cy + Math.sin(angle) * radius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');
  const grid = [0.35, 0.65, 1];
  return (
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
      {points.map((point) => (
        <text key={`${point.label}-label`} x={point.lx} y={point.ly} textAnchor="middle" className="ai-radar-label">
          {point.label}
        </text>
      ))}
    </svg>
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
                axes={[
                  { label: '승률', value: clampPercent(summary.winrate) },
                  { label: '해결', value: clampPercent(summary.solveRate) },
                  {
                    label: '레이팅',
                    value: clampPercent(((summary.ratingScore || 0) / 2200) * 100),
                  },
                  {
                    label: '속도',
                    value: clampPercent(100 - Math.min(90, (summary.avgSolveTimeSec || 0) / 2)),
                  },
                  {
                    label: '경험',
                    value: clampPercent(((summary.totalWins || 0) + (summary.losses || 0)) * 4),
                  },
                  {
                    label: '문제',
                    value: clampPercent((summary.problemCount || summary.recentMatchCount || 0) * 12),
                  },
                ]}
              />
            )}
            {summary && !historyId && (
              <div className="ai-analysis-stats">
                <div>레이팅 {summary.ratingScore ?? '-'} · 승률 {summary.winrate ?? 0}%</div>
                <div>
                  {summary.totalWins ?? 0}승 {summary.losses ?? 0}패 · 최근 {summary.recentMatchCount ?? 0}경기
                </div>
                <div>
                  강점 언어 {summary.strongestWinLang || summary.favoriteLang || '-'} · 해결률{' '}
                  {summary.solveRate ?? 0}%
                </div>
              </div>
            )}
            {historyId && (
              <div className="ai-analysis-stats">
                <div>
                  {(result?.summary?.problemCount ?? 0)}문제 · 언어 {result?.lang || result?.summary?.lang || '-'}
                </div>
              </div>
            )}
            <div className="ai-analysis-body">{result.analysis || '분석 결과가 없습니다.'}</div>
            <div className="ai-analysis-source">
              {result.source === 'saved'
                ? '저장된 분석'
                : result.source === 'cursor'
                  ? 'Cursor AI 분석'
                  : result.source === 'local-fallback'
                    ? '규칙 기반(임시)'
                    : '규칙 기반 분석'}
            </div>
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
