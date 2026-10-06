import { useEffect, useState } from 'react';
import { getEquippedTitle, type TitleData } from '../../../constants/titleTypes';
import { useModalShake } from '../../../hooks/useModalShake';
import { apiRequest } from '../../../services/apiClient';
import { getRatingScore, getTitles } from '../../../services/userService';
import type { CodeHistoryEntry } from '../../../types/lobby';
import { normalizeCodeHistoryEntry } from '../../../utils/codeHistoryUtils';
import { getTierByRating, getTierIconByTier } from '../../../utils/tierUtils';
import { MatchStoryModal } from '../MatchStoryModal/MatchStoryModal';
import { TitleModal } from '../TitleModal/TitleModal';

type MyInfoTab = 'stats' | 'story' | 'titles';

export interface MyInfoPublicUser {
  name: string;
  userId?: string;
  rank?: string;
  title?: string | null;
}

interface MyInfoModalProps {
  open: boolean;
  mode?: 'self' | 'public';
  publicUser?: MyInfoPublicUser | null;
  titleData: TitleData;
  codeHistory: CodeHistoryEntry[];
  selectedIndex: number;
  selectedProblemIndex: number;
  selectedIds: string[];
  onClose: () => void;
  onTitleDataChange: (data: TitleData) => void;
  onSelectEntry: (index: number) => void;
  onSelectProblem: (index: number) => void;
  onToggleSelection: (historyId: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onAnalyzeEntry?: (entry: CodeHistoryEntry) => void;
  onAiAnalyze?: (userId: string, userName: string) => void;
}

export function MyInfoModal({
  open,
  mode = 'self',
  publicUser = null,
  titleData,
  codeHistory,
  selectedIndex,
  selectedProblemIndex,
  selectedIds,
  onClose,
  onTitleDataChange,
  onSelectEntry,
  onSelectProblem,
  onToggleSelection,
  onSelectAll,
  onDeleteSelected,
  onAnalyzeEntry,
}: MyInfoModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [tab, setTab] = useState<MyInfoTab>('stats');
  const [publicCard, setPublicCard] = useState<{
    ratingScore: number;
    totalWins: number;
    totalGames: number;
    entries: CodeHistoryEntry[];
  } | null>(null);
  const [publicStoryIndex, setPublicStoryIndex] = useState(0);
  const [publicProblemIndex, setPublicProblemIndex] = useState(0);
  const isSelf = mode === 'self';

  useEffect(() => {
    if (open) setTab('stats');
  }, [open, mode, publicUser?.name]);

  useEffect(() => {
    if (!open || isSelf || !publicUser?.userId) {
      setPublicCard(null);
      return;
    }
    let cancelled = false;
    void apiRequest<{
      ratingScore?: number;
      totalWins?: number;
      totalGames?: number;
      entries?: unknown[];
    }>(`/users/${encodeURIComponent(publicUser.userId)}/public-card`)
      .then((data) => {
        if (cancelled) return;
        const entries = (data.entries || [])
          .map(normalizeCodeHistoryEntry)
          .filter((entry): entry is CodeHistoryEntry => Boolean(entry));
        setPublicCard({
          ratingScore: Number(data.ratingScore) || 1000,
          totalWins: Number(data.totalWins) || 0,
          totalGames: Number(data.totalGames) || 0,
          entries,
        });
        setPublicStoryIndex(0);
        setPublicProblemIndex(0);
      })
      .catch(() => {
        if (!cancelled) setPublicCard(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isSelf, publicUser?.userId]);

  if (!open) return null;

  const stats = getTitles().stats;
  const wins = isSelf ? Number(stats.totalWins) || 0 : publicCard?.totalWins || 0;
  const games = isSelf ? Number(stats.totalGames) || 0 : publicCard?.totalGames || 0;
  const losses = Math.max(0, games - wins);
  const winrate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0;
  const rating = isSelf ? getRatingScore() : publicCard?.ratingScore || 1000;
  const tier = isSelf
    ? getTierByRating(rating)
    : publicUser?.rank && publicUser.rank !== '-'
      ? publicUser.rank
      : getTierByRating(rating);
  const displayName = isSelf ? '' : publicUser?.name || 'UNKNOWN';
  const equipped = isSelf ? getEquippedTitle(titleData) : null;

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div
        className={`modal-content my-info-modal${shaking ? ' modal-shake-error' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-center pixel-text-primary" style={{ marginBottom: '8px', fontSize: '22px' }}>
          {isSelf ? '내 정보' : '프로필'}
        </h3>

        {!isSelf && (
          <div className="my-info-public-header">
            <div className="my-info-public-name">{displayName}</div>
            <div className="my-info-public-meta">
              <span>
                {getTierIconByTier(tier)} {tier}
              </span>
            </div>
          </div>
        )}

        {isSelf && (
          <>
            <div className="d-flex gap-2 mb-2" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className={`tab-btn ${tab === 'stats' ? 'active' : ''}`}
                onClick={() => setTab('stats')}
              >
                전적
              </button>
              <button
                type="button"
                className={`tab-btn ${tab === 'story' ? 'active' : ''}`}
                onClick={() => setTab('story')}
              >
                매치 스토리
              </button>
              <button
                type="button"
                className={`tab-btn ${tab === 'titles' ? 'active' : ''}`}
                onClick={() => setTab('titles')}
              >
                칭호
              </button>
            </div>

            {tab === 'stats' && (
              <div className="pixel-card my-info-stats-panel">
                <div className="my-info-stat-row">
                  <span>승</span>
                  <strong>{wins}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>패</span>
                  <strong>{losses}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>승률</span>
                  <strong>{winrate}%</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>레이팅</span>
                  <strong>{rating}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>티어</span>
                  <strong>
                    {getTierIconByTier(tier)} {tier}
                  </strong>
                </div>
                {equipped && (
                  <div className="my-info-stat-row">
                    <span>칭호</span>
                    <span className={`title-badge rarity-${equipped.rarity}`}>
                      {equipped.icon} {equipped.name}
                    </span>
                  </div>
                )}
              </div>
            )}

            {tab === 'story' && (
              <div className="my-info-embed">
                <MatchStoryModal
                  open
                  embedded
                  codeHistory={codeHistory}
                  selectedIndex={selectedIndex}
                  selectedProblemIndex={selectedProblemIndex}
                  selectedIds={selectedIds}
                  onClose={onClose}
                  onSelectEntry={onSelectEntry}
                  onSelectProblem={onSelectProblem}
                  onToggleSelection={onToggleSelection}
                  onSelectAll={onSelectAll}
                  onDeleteSelected={onDeleteSelected}
                  onAnalyzeEntry={onAnalyzeEntry}
                />
              </div>
            )}

            {tab === 'titles' && (
              <div className="my-info-embed">
                <TitleModal
                  open
                  embedded
                  titleData={titleData}
                  onClose={onClose}
                  onTitleDataChange={onTitleDataChange}
                />
              </div>
            )}
          </>
        )}

        {!isSelf && (
          <>
            <div className="d-flex gap-2 mb-2" style={{ justifyContent: 'center' }}>
              <button
                type="button"
                className={`tab-btn ${tab === 'stats' ? 'active' : ''}`}
                onClick={() => setTab('stats')}
              >
                전적
              </button>
              <button
                type="button"
                className={`tab-btn ${tab === 'story' ? 'active' : ''}`}
                onClick={() => setTab('story')}
              >
                매치 스토리
              </button>
            </div>

            {tab === 'stats' && (
              <div className="pixel-card my-info-stats-panel">
                <div className="my-info-stat-row">
                  <span>승</span>
                  <strong>{wins}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>패</span>
                  <strong>{losses}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>승률</span>
                  <strong>{winrate}%</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>레이팅</span>
                  <strong>{rating}</strong>
                </div>
                <div className="my-info-stat-row">
                  <span>티어</span>
                  <strong>
                    {getTierIconByTier(tier)} {tier}
                  </strong>
                </div>
              </div>
            )}

            {tab === 'story' && (
              <div className="my-info-embed">
                <MatchStoryModal
                  open
                  embedded
                  readOnly
                  codeHistory={publicCard?.entries || []}
                  selectedIndex={publicStoryIndex}
                  selectedProblemIndex={publicProblemIndex}
                  selectedIds={[]}
                  onClose={onClose}
                  onSelectEntry={(index) => {
                    setPublicStoryIndex(index);
                    setPublicProblemIndex(0);
                  }}
                  onSelectProblem={setPublicProblemIndex}
                  onToggleSelection={() => undefined}
                  onSelectAll={() => undefined}
                  onDeleteSelected={() => undefined}
                />
              </div>
            )}
          </>
        )}

        {(tab === 'stats' || !isSelf) && (
          <div className="d-flex justify-content-end mt-3" style={{ gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
