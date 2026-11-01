import { DESIGN_HEIGHT, DESIGN_WIDTH } from '../constants/layout';
import { loadDisplayMode as readDisplayMode, saveDisplayMode as writeDisplayMode } from '../services/clientPrefsStore';
import type { DisplayMode } from '../types/electron';

export function loadDisplayMode(): DisplayMode {
  return readDisplayMode();
}

export function saveDisplayMode(mode: DisplayMode) {
  writeDisplayMode(mode);
}

export function updateUiScale() {
  const mode = loadDisplayMode();
  const scale =
    mode === 'fullscreen'
      ? Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT)
      : 1;

  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  document.documentElement.style.setProperty('--ui-scale-x', String(safeScale));
  document.documentElement.style.setProperty('--ui-scale-y', String(safeScale));
  document.documentElement.style.setProperty('--ui-scale', String(safeScale));
}

export function applyDisplayModeToDom(mode: DisplayMode) {
  const root = document.documentElement;
  root.classList.toggle('display-fullscreen', mode === 'fullscreen');
  root.classList.toggle('display-window', mode === 'window');
  updateUiScale();
  if (mode === 'fullscreen') {
    requestAnimationFrame(() => updateUiScale());
    window.setTimeout(() => updateUiScale(), 150);
  }
}

export async function applyDisplayMode(mode: DisplayMode) {
  saveDisplayMode(mode);
  applyDisplayModeToDom(mode);
  await window.electronAPI?.setDisplayMode(mode);
}

export async function quitApp() {
  if (window.electronAPI?.quitApp) {
    await window.electronAPI.quitApp();
    return;
  }
  window.close();
}
