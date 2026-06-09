import { TITLE_DEFS, getEquippedTitle, saveTitles, type TitleData } from '../../../constants/titleTypes';

interface TitleModalProps {
  open: boolean;
  titleData: TitleData;
  onClose: () => void;
  onTitleDataChange: (data: TitleData) => void;
}

export function TitleModal({ open, titleData, onClose, onTitleDataChange }: TitleModalProps) {
  if (!open) return null;

  const equipped = getEquippedTitle(titleData);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
        <h3 className="text-center pixel-text-warning" style={{ marginBottom: '10px', fontSize: '22px' }}>
          🏆 칭호 관리
        </h3>
        {equipped ? (
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#aaa' }}>장착 중: </span>
            <span className={`title-badge rarity-${equipped.rarity}`}>
              {equipped.icon} {equipped.name}
            </span>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', marginBottom: '10px' }}>장착된 칭호 없음</div>
        )}
        <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
          {TITLE_DEFS.map((td) => {
            const owned = titleData.owned.includes(td.id);
            const isEquipped = titleData.equipped === td.id;
            let cls = `title-item rarity-${td.rarity}`;
            if (isEquipped) cls += ' equipped';
            if (!owned) cls += ' locked';

            return (
              <div key={td.id} className={cls}>
                <div>
                  <span style={{ fontSize: '18px' }}>{td.icon}</span>
                  <span style={{ marginLeft: '6px', color: owned ? '#fff' : '#555' }}>{td.name}</span>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{td.desc}</div>
                </div>
                {owned && (
                  <button
                    type="button"
                    className="profile-btn"
                    style={{ fontSize: '12px', padding: '3px 8px' }}
                    onClick={() => {
                      const next = { ...titleData, equipped: isEquipped ? null : td.id };
                      onTitleDataChange(next);
                      saveTitles(next);
                    }}
                  >
                    {isEquipped ? '해제' : '장착'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="d-flex justify-content-end mt-3">
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
