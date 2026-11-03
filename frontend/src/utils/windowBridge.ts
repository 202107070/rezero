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
  // 전체화면: 가로·세로 각각 스케일해 모니터를 꽉 채움 (창모드와 같이 여백 없음)
  const scaleX = mode === 'fullscreen' ? window.innerWidth / DESIGN_WIDTH : 1;
  const scaleY = mode === 'fullscreen' ? window.innerHeight / DESIGN_HEIGHT : 1;

  const safeX = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1;
  const safeY = Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1;
  document.documentElement.style.setProperty('--ui-scale-x', String(safeX));
  document.documentElement.style.setProperty('--ui-scale-y', String(safeY));
  document.documentElement.style.setProperty('--ui-scale', String(Math.min(safeX, safeY)));
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
