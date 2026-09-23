import { useEffect, useState } from 'react';
import { getEquippedTitle, TITLE_DEFS, type TitleData } from '../../../constants/titleTypes';
import { useModalShake } from '../../../hooks/useModalShake';
import { getUserPresence } from '../../../services/friendStore';
import { getRatingScore, getTitles } from '../../../services/userService';
import type { CodeHistoryEntry } from '../../../types/lobby';
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
}

function presenceText(userName: string) {
  const presence = getUserPresence(userName);
  if (!presence || presence.status === 'offline') return '오프라인';
  if (presence.status === 'practice') return '연습 모드';
  if (presence.status === 'build') return '빌드 시스템';
  if (presence.status === 'battle') {
    return presence.roomId ? `${presence.roomId}번 방 · 게임 중` : '게임 중';
  }
  if (presence.status === 'result') {
    return presence.roomId ? `${presence.roomId}번 방 · 결과` : '결과창';
  }
  if (presence.status === 'room') {
    if (presence.roomId) {
      return presence.roomTitle
        ? `${presence.roomId}번 방 · ${presence.roomTitle}`
        : `${presence.roomId}번 방`;
    }
    return '대기방';
  }
  return '온라인 (로비)';
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
}: MyInfoModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const [tab, setTab] = useState<MyInfoTab>('stats');
  const isSelf = mode === 'self';

  useEffect(() => {
    if (open) setTab('stats');
  }, [open, mode, publicUser?.name]);

  if (!open) return null;

  const stats = (isSelf ? getTitles() : titleData).stats;
  const wins = Number(stats.totalWins) || 0;
  const games = Number(stats.totalGames) || 0;
  const losses = Math.max(0, games - wins);
  const winrate = games > 0 ? Math.round((wins / games) * 1000) / 10 : 0;
  const rating = isSelf ? getRatingScore() : 1000;
  const tier = isSelf
    ? getTierByRating(rating)
    : publicUser?.rank && publicUser.rank !== '-'
      ? publicUser.rank
      : getTierByRating(rating);
  const displayName = isSelf ? '' : publicUser?.name || 'UNKNOWN';
  const publicTitle = publicUser?.title
    ? TITLE_DEFS.find((t) => t.id === publicUser.title) || null
    : null;
  const equipped = isSelf ? getEquippedTitle(titleData) : publicTitle;

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
              <span className="my-info-presence-badge">{presenceText(displayName)}</span>
            </div>
            {equipped && (
              <span className={`title-badge rarity-${equipped.rarity}`}>
                {equipped.icon} {equipped.name}
              </span>
            )}
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
          <div className="pixel-card my-info-stats-panel" style={{ marginTop: '8px' }}>
            <div className="my-info-stat-row">
              <span>상태</span>
              <strong>{presenceText(displayName)}</strong>
            </div>
            <div className="my-info-stat-row">
              <span>티어</span>
              <strong>
                {getTierIconByTier(tier)} {tier}
              </strong>
            </div>
            <div style={{ color: '#888', fontSize: '13px', marginTop: '8px', textAlign: 'center' }}>
              상대 전적·매치 스토리는 공개되지 않습니다.
            </div>
          </div>
        )}

        {(tab === 'stats' || !isSelf) && (
          <div className="d-flex justify-content-end mt-3">
            <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
