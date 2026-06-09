import type { CodeHistoryEntry } from '../../../types/lobby';
import { getSolution } from '../../../utils/codeHistoryUtils';

interface MatchStoryModalProps {
  open: boolean;
  codeHistory: CodeHistoryEntry[];
  selectedIndex: number;
  selectedProblemIndex: number;
  selectedIds: string[];
  onClose: () => void;
  onSelectEntry: (index: number) => void;
  onSelectProblem: (index: number) => void;
  onToggleSelection: (historyId: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
}

export function MatchStoryModal({
  open,
  codeHistory,
  selectedIndex,
  selectedProblemIndex,
  selectedIds,
  onClose,
  onSelectEntry,
  onSelectProblem,
  onToggleSelection,
  onSelectAll,
  onDeleteSelected,
}: MatchStoryModalProps) {
  if (!open) return null;

  const selectedHistory = codeHistory[selectedIndex] || null;
  const selectedProblems = selectedHistory?.problems || [];
  const selectedProblem = selectedProblems[selectedProblemIndex] || selectedProblems[0] || null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content match-story-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '6px', fontSize: '22px' }}>
          MY CODE HISTORY
        </h3>
        {codeHistory.length === 0 ? (
          <div className="pixel-card" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
            저장된 코드가 없습니다.
          </div>
        ) : (
          <div className="match-story-layout">
            <div className="pixel-card match-story-list">
              {codeHistory.map((entry, idx) => (
                <button
                  key={`${entry.submittedAt}-${idx}`}
                  type="button"
                  className="profile-btn w-100 text-start"
                  style={{
                    marginBottom: '6px',
                    background: selectedIds.includes(entry.historyId)
                      ? 'rgba(231, 110, 85, 0.35)'
                      : selectedIndex === idx
                        ? 'var(--px-primary)'
                        : 'var(--px-surface-light)',
                    borderColor: selectedIds.includes(entry.historyId) ? 'var(--px-danger)' : undefined,
                  }}
                  onClick={() => onSelectEntry(idx)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '14px' }}>
                      #{idx + 1}
                      {entry.roomId ? ` · ROOM ${entry.roomId}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelection(entry.historyId);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        margin: 0,
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: selectedIds.includes(entry.historyId) ? 'var(--px-danger)' : '#ddd',
                      }}
                      aria-label={selectedIds.includes(entry.historyId) ? '선택 해제' : '선택'}
                    >
                      {selectedIds.includes(entry.historyId) ? '☑' : '☐'}
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>{new Date(entry.submittedAt).toLocaleString()}</div>
                  <div style={{ fontSize: '12px', marginTop: '2px', color: 'var(--px-warning)' }}>
                    {(entry.problems?.length || entry.codes?.length || 1)}문제
                  </div>
                </button>
              ))}
            </div>
            <div className="pixel-card match-story-detail">
              <div className="pixel-card-header match-story-detail-header">
                <span style={{ color: 'var(--px-warning)' }}>📋 {selectedProblem?.title || '문제'}</span>
              </div>
              <div className="match-story-meta">
                <div>언어: {selectedHistory?.lang || 'UNKNOWN'}</div>
                <div>제출 시각: {selectedHistory ? new Date(selectedHistory.submittedAt).toLocaleString() : '-'}</div>
                <div className="match-story-question">{selectedProblem?.question || '문제 설명이 없습니다.'}</div>
              </div>
              <div className="match-story-problem-tabs">
                {selectedProblems.length > 1 ? (
                  selectedProblems.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`match-story-problem-tab${selectedProblemIndex === idx ? ' active' : ''}`}
                      onClick={() => onSelectProblem(idx)}
                    >
                      문제 {idx + 1}
                    </button>
                  ))
                ) : (
                  <span className="match-story-problem-tab-placeholder">문제 1</span>
                )}
              </div>
              <div className="pixel-card-header match-story-detail-subheader">
                <span style={{ color: 'var(--px-success)' }}>✅ 정답 / 해설</span>
              </div>
              <div className="match-story-grid">
                <div className="match-answer-box">
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: '14px',
                      color: 'var(--px-text)',
                    }}
                  >
                    {getSolution(selectedProblem)}
                  </pre>
                </div>
                <div className="match-explain-box">{selectedProblem?.explanation || '해설이 없습니다.'}</div>
              </div>
            </div>
          </div>
        )}
        <div className="d-flex justify-content-between align-items-center gap-2">
          <div style={{ color: '#999', fontSize: '14px' }}>선택됨: {selectedIds.length}개</div>
          <div className="d-flex gap-2 justify-content-end">
            <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '120px' }} onClick={onSelectAll}>
              {codeHistory.length > 0 && selectedIds.length === codeHistory.length ? '선택 해제' : '전체 선택'}
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-danger"
              style={{ minWidth: '120px' }}
              onClick={onDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              선택 삭제
            </button>
            <button type="button" className="pixel-btn pixel-btn-secondary" style={{ minWidth: '120px' }} onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
