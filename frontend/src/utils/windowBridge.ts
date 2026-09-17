import { loadDisplayMode as readDisplayMode, saveDisplayMode as writeDisplayMode } from '../services/clientPrefsStore';
import type { DisplayMode } from '../types/electron';

const REF_WIDTH = 1280;
const REF_HEIGHT = 960;

export function loadDisplayMode(): DisplayMode {
  return readDisplayMode();
}

export function saveDisplayMode(mode: DisplayMode) {
  writeDisplayMode(mode);
}

export function updateUiScale() {
  const mode = loadDisplayMode();

  if (mode === 'fullscreen') {
    // 비율 유지 letterbox — 축별 스트레치로 가장자리가 잘리는 문제 방지
    const scale = Math.min(window.innerWidth / REF_WIDTH, window.innerHeight / REF_HEIGHT);
    const safeScale = Math.max(0.01, Math.floor(scale * 1000) / 1000);
    document.documentElement.style.setProperty('--ui-scale-x', String(safeScale));
    document.documentElement.style.setProperty('--ui-scale-y', String(safeScale));
    document.documentElement.style.setProperty('--ui-scale', String(safeScale));
    return;
  }

  document.documentElement.style.setProperty('--ui-scale-x', '1');
  document.documentElement.style.setProperty('--ui-scale-y', '1');
  document.documentElement.style.setProperty('--ui-scale', '1');
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
