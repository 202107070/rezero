import { loadAudioSettings as readAudioSettings, saveAudioSettings as writeAudioSettings } from '../../services/clientPrefsStore';
import { DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../../types/audioSettings';

export function loadAudioSettings(): AudioSettings {
  return readAudioSettings();
}

export function saveAudioSettings(settings: AudioSettings) {
  writeAudioSettings({
    lobbyMusic: settings.lobbyMusic ?? DEFAULT_AUDIO_SETTINGS.lobbyMusic,
    battleMusic: settings.battleMusic ?? DEFAULT_AUDIO_SETTINGS.battleMusic,
  });
}
