import { ATTACK_ITEM_KEYS, BATTLE_ITEM_DEFS, type ItemKey } from '../../constants/itemTypes';
import { useModalShake } from '../../hooks/useModalShake';
import type { ItemInventory } from '../../types/battle';

const ATTACK_ITEMS = BATTLE_ITEM_DEFS.filter((item) => ATTACK_ITEM_KEYS.includes(item.key)).map((item) => ({
  type: item.key,
  icon: item.icon,
  name: item.name,
  desc:
    item.key === 'paint'
      ? '상대 코드 화면에 페인트 스플래시'
      : item.key === 'lightning'
        ? '번개로 상대 화면 방해'
        : item.key === 'timeReduce'
          ? '상대 제한시간 15초 감소'
          : '상대 코드에 직접 낙서',
  rare: item.rare,
}));

interface ItemSelectModalProps {
  inventory: ItemInventory;
  onSelect: (type: ItemKey) => void;
  onClose: () => void;
  allowedTypes?: ItemKey[];
}

export default function ItemSelectModal({ inventory, onSelect, onClose, allowedTypes }: ItemSelectModalProps) {
  const { shaking, triggerShake } = useModalShake();
  const allowedSet = allowedTypes ? new Set(allowedTypes) : null;
  const visibleItems = ATTACK_ITEMS.filter((item) => !allowedSet || allowedSet.has(item.type));

  return (
    <div className="item-modal-overlay" onClick={triggerShake}>
      <div className={`item-modal-box${shaking ? ' modal-shake-error' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="item-modal-title">⚡ 아이템 선택</div>
        {visibleItems.map((item) => (
          <div
            key={item.type}
            className="item-option"
            onClick={() => {
              if (inventory[item.type] > 0) {
                onSelect(item.type);
                return;
              }
              triggerShake();
            }}
            style={{
              opacity: inventory[item.type] <= 0 ? 0.4 : 1,
              filter: inventory[item.type] <= 0 ? 'grayscale(1)' : undefined,
              background: item.rare ? 'linear-gradient(135deg, rgba(247,213,29,0.12), rgba(231,110,85,0.08))' : '',
              borderColor: item.rare ? 'var(--px-warning)' : '',
            }}
          >
            <div className="item-icon">{item.icon}</div>
            <div className="item-info">
              <div className="item-name">{item.rare ? '⭐ ' : ''}{item.name}</div>
              <div className="item-desc">{item.desc}</div>
            </div>
            <div className="item-count-badge" style={{ background: item.rare ? 'rgba(247,213,29,0.2)' : '' }}>
              {inventory[item.type]}회
            </div>
          </div>
        ))}
        <div className="item-modal-close">
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
