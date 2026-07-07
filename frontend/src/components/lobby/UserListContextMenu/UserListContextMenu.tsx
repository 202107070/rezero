import { useEffect, useRef } from 'react';

export type UserListMenuAction = 'match-story' | 'add-friend' | 'whisper' | 'follow' | 'summon';

const MENU_ITEMS: Array<{ action: UserListMenuAction; label: string }> = [
  { action: 'match-story', label: '매치 스토리' },
  { action: 'add-friend', label: '친구추가' },
  { action: 'whisper', label: '귓속말' },
  { action: 'follow', label: '따라가기' },
  { action: 'summon', label: '소환하기' },
];

interface UserListContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  userName: string;
  hiddenActions?: UserListMenuAction[];
  disabledActions?: UserListMenuAction[];
  actionLabels?: Partial<Record<UserListMenuAction, string>>;
  onSelect: (action: UserListMenuAction, userName: string) => void;
  onClose: () => void;
}

export function UserListContextMenu({
  open,
  x,
  y,
  userName,
  hiddenActions = [],
  disabledActions = [],
  actionLabels = {},
  onSelect,
  onClose,
}: UserListContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', onClose, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const visibleItems = MENU_ITEMS.filter((item) => !hiddenActions.includes(item.action));
  const menuWidth = 168;
  const menuHeight = visibleItems.length * 40 + 8;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="user-list-context-menu"
      style={{ left: clampedX, top: clampedY }}
      role="menu"
      aria-label={`${userName} 유저 메뉴`}
    >
      {visibleItems.map((item) => {
        const disabled = disabledActions.includes(item.action);
        return (
          <button
            key={item.action}
            type="button"
            className={`user-list-context-menu-item${disabled ? ' is-disabled' : ''}`}
            role="menuitem"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              onSelect(item.action, userName);
              onClose();
            }}
          >
            {actionLabels[item.action] ?? item.label}
          </button>
        );
      })}
    </div>
  );
}
