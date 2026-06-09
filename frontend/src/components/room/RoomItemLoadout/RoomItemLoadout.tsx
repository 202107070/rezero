import {
  BATTLE_ITEM_DEFS,
  type ItemInventory,
  type ItemKey,
} from '../../../constants/itemTypes';

interface RoomItemLoadoutProps {
  inventory: ItemInventory;
  selectedItems: Set<ItemKey>;
  onToggle: (key: ItemKey) => void;
}

export function RoomItemLoadout({ inventory, selectedItems, onToggle }: RoomItemLoadoutProps) {
  return (
    <div className="panel-section room-item-loadout">
      <div className="section-title room-item-loadout-title">아이템 선택</div>
      <div className="room-item-loadout-hint">게임에 가져갈 아이템을 선택하세요</div>
      <div className="room-item-grid">
        {BATTLE_ITEM_DEFS.map((item) => {
          const count = inventory[item.key];
          const isEmpty = count <= 0;
          const isSelected = selectedItems.has(item.key);

          return (
            <button
              key={item.key}
              type="button"
              className={`room-item-slot${isSelected ? ' selected' : ''}${isEmpty ? ' empty' : ''}${item.rare ? ' rare' : ''}`}
              onClick={() => {
                if (!isEmpty) onToggle(item.key);
              }}
              disabled={isEmpty}
              title={isEmpty ? `${item.name} (보유 0)` : item.name}
            >
              <span className="room-item-icon">{item.icon}</span>
              <span className="room-item-label">{item.name}</span>
              <span className="room-item-count">{count}</span>
              {isSelected && <span className="room-item-check">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
