import { useModalShake } from '../../../hooks/useModalShake';
import type { ItemInventory } from '../../../constants/itemTypes';

interface InventoryItemsModalProps {
  open: boolean;
  items: ItemInventory;
  onClose: () => void;
}

const ITEM_ROWS: Array<{ key: keyof ItemInventory; icon: string; name: string; rare?: boolean }> = [
  { key: 'paint', icon: '🎨', name: '페인트' },
  { key: 'lightning', icon: '⚡', name: '번개' },
  { key: 'timeReduce', icon: '⏱️', name: '시간감소' },
  { key: 'revealLength', icon: '📏', name: '글자수' },
  { key: 'revealPrev', icon: '🔍', name: '앞글자' },
  { key: 'scribble', icon: '✏️', name: '낙서', rare: true },
  { key: 'blankBreak', icon: '🔨', name: '빈칸깨기', rare: true },
  { key: 'buildCharge', icon: '🔧', name: '빌드+', rare: true },
];

export function InventoryItemsModal({ open, items, onClose }: InventoryItemsModalProps) {
  const { shaking, triggerShake } = useModalShake();
  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={triggerShake}>
      <div
        className={`modal-content inventory-items-modal${shaking ? ' modal-shake-error' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-center pixel-text-primary inventory-items-modal-title">내 아이템</h3>
        <div className="inventory-items-list">
          {ITEM_ROWS.map((row) => (
            <div className="inventory-items-row" key={row.key}>
              <span className="inventory-items-name">
                {row.rare ? '⭐ ' : ''}
                {row.icon} {row.name}
              </span>
              <span className="inventory-items-count">{items[row.key]}개</span>
            </div>
          ))}
        </div>
        <div className="inventory-items-actions">
          <button type="button" className="pixel-btn pixel-btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
