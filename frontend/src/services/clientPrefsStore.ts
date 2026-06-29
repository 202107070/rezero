import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../types/audioSettings';
import type { DisplayMode } from '../types/electron';

let displayMode: DisplayMode = 'window';
let audioSettings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

export function loadDisplayMode(): DisplayMode {
  return displayMode;
}

export function saveDisplayMode(mode: DisplayMode): void {
  displayMode = mode;
}

export function loadAudioSettings(): AudioSettings {
  return { ...audioSettings };
}

export function saveAudioSettings(settings: AudioSettings): void {
  audioSettings = { ...settings };
}
