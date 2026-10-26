export interface AudioSettings {
  gameMusic: boolean;
  /** @deprecated 이전 저장값 호환 */
  lobbyMusic?: boolean;
  /** @deprecated 이전 저장값 호환 */
  battleMusic?: boolean;
}

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  gameMusic: false,
};

export function isGameMusicEnabled(settings: AudioSettings | null | undefined): boolean {
  if (!settings) return false;
  if (typeof settings.gameMusic === 'boolean') return settings.gameMusic;
  return Boolean(settings.lobbyMusic || settings.battleMusic);
}

export function normalizeAudioSettings(settings: Partial<AudioSettings> | null | undefined): AudioSettings {
  if (typeof settings?.gameMusic === 'boolean') {
    return { gameMusic: settings.gameMusic };
  }
  return {
    gameMusic: Boolean(settings?.lobbyMusic || settings?.battleMusic),
  };
}
