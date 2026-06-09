import { getEquippedTitle, type TitleData } from '../../../constants/titleTypes';

interface ProfilePanelProps {
  titleData: TitleData;
  onOpenMatchStory: () => void;
  onOpenTitles: () => void;
}

export function ProfilePanel({ titleData, onOpenMatchStory, onOpenTitles }: ProfilePanelProps) {
  const equipped = getEquippedTitle(titleData);

  return (
    <div
      className="pixel-card d-flex flex-column justify-content-center align-items-center"
      style={{ padding: '10px', gap: '4px' }}
    >
      <div style={{ alignSelf: 'flex-start' }}>
        <div
          className="pixel-text-success"
          style={{
            fontSize: '16px',
            border: '2px solid var(--px-success)',
            display: 'inline-block',
            padding: '3px 10px',
            width: 'fit-content',
          }}
        >
          PROFILE
        </div>
      </div>
      <div
        style={{
          width: '54px',
          height: '54px',
          background: 'linear-gradient(135deg, #1a1030, #0a0a20)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '22px',
          border: '4px solid var(--px-border)',
          boxShadow: 'var(--px-shadow-hard)',
          color: 'var(--px-primary)',
          textShadow: '2px 2px 0 #000',
        }}
      >
        ME
      </div>
      <h3 style={{ color: '#eee', margin: '2px 0', fontSize: '17px' }}>rocky_user</h3>
      {equipped && (
        <span className={`title-badge rarity-${equipped.rarity}`}>
          {equipped.icon} {equipped.name}
        </span>
      )}
      <div style={{ color: '#999', fontSize: '14px' }}>Lv.42 | 플래티넘 II</div>
      <div style={{ display: 'flex', gap: '4px', marginTop: '3px' }}>
        <button type="button" className="profile-btn" style={{ fontSize: '13px', padding: '4px 9px' }} onClick={onOpenMatchStory}>
          📋 매치 스토리
        </button>
        <button type="button" className="profile-btn" style={{ fontSize: '13px', padding: '4px 9px' }} onClick={onOpenTitles}>
          🏆 칭호
        </button>
      </div>
    </div>
  );
}
