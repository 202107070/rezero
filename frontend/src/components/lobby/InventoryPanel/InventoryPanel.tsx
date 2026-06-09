import { ROULETTE_COST, type ItemInventory } from '../../../constants/itemTypes';

interface InventoryPanelProps {
  gold: number;
  items: ItemInventory;
  onOpenRoulette: () => void;
}

const ITEM_ROWS: Array<{ key: keyof ItemInventory; icon: string; name: string; rare?: boolean }> = [
  { key: 'paint', icon: '🎨', name: '페인트' },
  { key: 'lightning', icon: '⚡', name: '번개' },
  { key: 'timeReduce', icon: '⏱️', name: '시간감소' },
  { key: 'revealLength', icon: '📏', name: '글자수' },
  { key: 'revealPrev', icon: '🔍', name: '앞글자' },
  { key: 'scribble', icon: '✏️', name: '낙서', rare: true },
  { key: 'blankBreak', icon: '🔨', name: '빈칸깨기', rare: true },
];

export function InventoryPanel({ gold, items, onOpenRoulette }: InventoryPanelProps) {
  return (
    <div className="inventory-panel">
      <div style={{ flexShrink: 0 }}>
        <div className="inventory-title">💰 아이템 &amp; 골드</div>
        <div className="gold-row">
          <span className="gold-label">보유 골드</span>
          <span className="gold-val">{gold.toLocaleString()} G</span>
        </div>
      </div>
      <div className="inventory-scroll">
        {ITEM_ROWS.map((row) => (
          <div className="item-row" key={row.key}>
            <span className="item-name">
              {row.rare ? '⭐ ' : ''}
              {row.icon} {row.name}
            </span>
            <span className="item-count">{items[row.key]}개</span>
          </div>
        ))}
        <div className="item-hint">1회 {ROULETTE_COST.toLocaleString()}G / ⭐레어 낮은 확률</div>
      </div>
      <div className="inventory-roulette-footer">
        <button type="button" className="inventory-roulette-btn" onClick={onOpenRoulette}>
          🎰 룰렛 ({ROULETTE_COST.toLocaleString()}G)
        </button>
      </div>
    </div>
  );
}
