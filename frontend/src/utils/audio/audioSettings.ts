import { loadAudioSettings as readAudioSettings, saveAudioSettings as writeAudioSettings } from '../../services/clientPrefsStore';
import { normalizeAudioSettings, type AudioSettings } from '../../types/audioSettings';

export function loadAudioSettings(): AudioSettings {
  return normalizeAudioSettings(readAudioSettings());
}

export function saveAudioSettings(settings: AudioSettings) {
  writeAudioSettings(normalizeAudioSettings(settings));
}
