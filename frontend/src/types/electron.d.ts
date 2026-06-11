export type DisplayMode = 'window' | 'fullscreen';

export interface ElectronAPI {
  setDisplayMode: (mode: DisplayMode) => Promise<void>;
  quitApp: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
