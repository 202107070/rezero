import { STORAGE_KEYS } from '../constants/storageKeys';
import type { DisplayMode } from '../types/electron';

const REF_WIDTH = 1280;
const REF_HEIGHT = 960;

export function loadDisplayMode(): DisplayMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DISPLAY_MODE);
    return stored === 'fullscreen' ? 'fullscreen' : 'window';
  } catch {
    return 'window';
  }
}

export function saveDisplayMode(mode: DisplayMode) {
  localStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, mode);
}

export function updateUiScale() {
  const mode = loadDisplayMode();

  if (mode === 'fullscreen') {
    const scaleX = window.innerWidth / REF_WIDTH;
    const scaleY = window.innerHeight / REF_HEIGHT;
    document.documentElement.style.setProperty('--ui-scale-x', String(scaleX));
    document.documentElement.style.setProperty('--ui-scale-y', String(scaleY));
    document.documentElement.style.setProperty('--ui-scale', String((scaleX + scaleY) / 2));
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
