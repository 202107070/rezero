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

export function AiUserAnalysisModal({ open, userId, userName, historyId, onClose }: AiUserAnalysisModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(40);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AiAnalysisResponse | null>(null);

  useEffect(() => {
    if (!open || (!userId && !historyId)) return;
    let cancelled = false;
    setLoading(true);
    setCountdown(40);
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

  useEffect(() => {
    if (!open || !loading) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, loading]);

  if (!open) return null;

  const summary = result?.summary;

  return (
    <div className="modal-overlay" onClick={triggerShake} style={{ zIndex: 4500 }}>
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
            <div className="ai-analysis-countdown">{countdown}</div>
            <div className="ai-analysis-spinner" aria-hidden="true" />
          </div>
        )}

        {!loading && error && <div className="ai-analysis-error">{error}</div>}

        {!loading && !error && result && (
          <>
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
              {result.source === 'cursor'
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
