import { STORAGE_KEYS } from '../../constants/storageKeys';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../../types/audioSettings';

export function loadAudioSettings(): AudioSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.AUDIO_SETTINGS);
    if (!stored) return { ...DEFAULT_AUDIO_SETTINGS };
    const parsed = JSON.parse(stored) as Partial<AudioSettings>;
    return {
      lobbyMusic: parsed.lobbyMusic ?? DEFAULT_AUDIO_SETTINGS.lobbyMusic,
      battleMusic: parsed.battleMusic ?? DEFAULT_AUDIO_SETTINGS.battleMusic,
    };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings: AudioSettings) {
  localStorage.setItem(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(settings));
}
