const CLIPBOARD_EVENTS = ['copy', 'cut', 'paste'] as const;

function blockClipboardEvent(event: Event) {
  event.preventDefault();
}

function blockContextMenu(event: Event) {
  event.preventDefault();
}

function blockDragStart(event: Event) {
  event.preventDefault();
}

function blockKeyboardClipboard(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === 'c' || key === 'v' || key === 'x' || key === 'a') {
    event.preventDefault();
  }
}

export function installClipboardBlockers() {
  for (const name of CLIPBOARD_EVENTS) {
    document.addEventListener(name, blockClipboardEvent);
  }
  document.addEventListener('contextmenu', blockContextMenu);
  document.addEventListener('dragstart', blockDragStart);
  document.addEventListener('keydown', blockKeyboardClipboard);

  return () => {
    for (const name of CLIPBOARD_EVENTS) {
      document.removeEventListener(name, blockClipboardEvent);
    }
    document.removeEventListener('contextmenu', blockContextMenu);
    document.removeEventListener('dragstart', blockDragStart);
    document.removeEventListener('keydown', blockKeyboardClipboard);
  };
}
