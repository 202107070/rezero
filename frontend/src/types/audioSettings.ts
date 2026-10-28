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

export function isGameMusicEnabled(_settings?: AudioSettings | null): boolean {
  // 페이지 BGM 제거: 아이템 SFX만 유지
  return false;
}

export function normalizeAudioSettings(settings: Partial<AudioSettings> | null | undefined): AudioSettings {
  if (typeof settings?.gameMusic === 'boolean') {
    return { gameMusic: settings.gameMusic };
  }
  return {
    gameMusic: Boolean(settings?.lobbyMusic || settings?.battleMusic),
  };
}
