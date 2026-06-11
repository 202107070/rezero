export interface AudioSettings {
  lobbyMusic: boolean;
  battleMusic: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  lobbyMusic: false,
  battleMusic: false,
};
