/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AudioSettings } from '../../types/audioSettings';
import { isGameMusicEnabled } from '../../types/audioSettings';
import { loadAudioSettings } from './audioSettings';

type WaveType = OscillatorType;
type BattleMode = 'normal' | 'urgent';
type MusicKind = 'none' | 'lobby' | 'room' | 'battle' | 'result' | 'practice' | 'build';
type SfxType =
  | 'lightning'
  | 'paint'
  | 'scribble'
  | 'blankBreak'
  | 'timeReduce'
  | 'revealLength'
  | 'revealPrev'
  | 'default';

const NOTE: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
};

interface MelodyStep {
  freq: number;
  dur: number;
  wave: WaveType;
  gain: number;
}

const LOBBY_LOOP: MelodyStep[] = [
  { freq: NOTE.C4, dur: 0.7, wave: 'sine', gain: 0.12 },
  { freq: NOTE.E4, dur: 0.5, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.G4, dur: 0.7, wave: 'sine', gain: 0.12 },
  { freq: NOTE.A4, dur: 0.5, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.G4, dur: 0.8, wave: 'sine', gain: 0.11 },
  { freq: NOTE.E4, dur: 0.5, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.F4, dur: 0.6, wave: 'sine', gain: 0.1 },
  { freq: NOTE.D4, dur: 0.9, wave: 'triangle', gain: 0.1 },
];

const ROOM_LOOP: MelodyStep[] = [
  { freq: NOTE.D4, dur: 0.42, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.F4, dur: 0.42, wave: 'sine', gain: 0.09 },
  { freq: NOTE.A4, dur: 0.55, wave: 'triangle', gain: 0.11 },
  { freq: NOTE.G4, dur: 0.42, wave: 'sine', gain: 0.09 },
  { freq: NOTE.F4, dur: 0.42, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.A4, dur: 0.7, wave: 'sine', gain: 0.1 },
];

const BATTLE_NORMAL: MelodyStep[] = [
  { freq: NOTE.A4, dur: 0.28, wave: 'triangle', gain: 0.11 },
  { freq: NOTE.C5, dur: 0.28, wave: 'square', gain: 0.07 },
  { freq: NOTE.E4, dur: 0.28, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.G4, dur: 0.36, wave: 'sine', gain: 0.11 },
  { freq: NOTE.F4, dur: 0.24, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.E4, dur: 0.24, wave: 'square', gain: 0.06 },
  { freq: NOTE.D4, dur: 0.28, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.E4, dur: 0.42, wave: 'sine', gain: 0.11 },
];

const BATTLE_URGENT: MelodyStep[] = [
  { freq: NOTE.A4, dur: 0.16, wave: 'square', gain: 0.08 },
  { freq: NOTE.C5, dur: 0.16, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.E5, dur: 0.16, wave: 'square', gain: 0.08 },
  { freq: NOTE.D5, dur: 0.16, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.C5, dur: 0.16, wave: 'square', gain: 0.07 },
  { freq: NOTE.A4, dur: 0.16, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.G4, dur: 0.16, wave: 'sine', gain: 0.1 },
  { freq: NOTE.E4, dur: 0.24, wave: 'triangle', gain: 0.11 },
];

const RESULT_LOOP: MelodyStep[] = [
  { freq: NOTE.G4, dur: 0.55, wave: 'sine', gain: 0.12 },
  { freq: NOTE.B4, dur: 0.45, wave: 'triangle', gain: 0.1 },
  { freq: NOTE.D5, dur: 0.55, wave: 'sine', gain: 0.11 },
  { freq: NOTE.C5, dur: 0.4, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.A4, dur: 0.5, wave: 'sine', gain: 0.1 },
  { freq: NOTE.G4, dur: 0.9, wave: 'triangle', gain: 0.11 },
];

const PRACTICE_LOOP: MelodyStep[] = [
  { freq: NOTE.E4, dur: 0.8, wave: 'sine', gain: 0.08 },
  { freq: NOTE.G4, dur: 0.8, wave: 'sine', gain: 0.07 },
  { freq: NOTE.B4, dur: 0.9, wave: 'triangle', gain: 0.08 },
  { freq: NOTE.A4, dur: 1.0, wave: 'sine', gain: 0.07 },
];

function publicAudioUrl(fileName: string): string {
  const relative = `audio/${fileName}`;
  if (typeof window === 'undefined') return `/${relative}`;
  if (window.location.protocol === 'file:') {
    return new URL(relative, window.location.href.replace(/[^/]*$/, '')).href;
  }
  return `${window.location.origin}/${relative}`;
}

const PAGE_TRACK_FILES: Record<Exclude<MusicKind, 'none'>, string[]> = {
  lobby: ['lobby.wav', 'lobby.ogg', 'lobby.mp3'].map(publicAudioUrl),
  room: ['room.ogg', 'room.wav', 'room.mp3'].map(publicAudioUrl),
  battle: ['battle.wav', 'battle.ogg', 'battle.mp3'].map(publicAudioUrl),
  result: ['result.wav', 'result.ogg', 'result.mp3'].map(publicAudioUrl),
  practice: ['practice.wav', 'practice.ogg', 'practice.mp3'].map(publicAudioUrl),
  build: ['build.wav', 'build.ogg', 'build.mp3'].map(publicAudioUrl),
};

const BATTLE_URGENT_FILES = ['battle-urgent.wav', 'battle-urgent.ogg', 'battle-urgent.mp3'].map(
  publicAudioUrl,
);

function sniffAudioMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 12) {
    const riff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const wave = bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45;
    if (riff && wave) return 'audio/wav';
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return 'audio/ogg';
  }
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'audio/mpeg';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  return null;
}

type FilePlayStatus = 'played' | 'missing' | 'aborted';

const BUILD_LOOP: MelodyStep[] = [
  { freq: NOTE.C4, dur: 0.28, wave: 'triangle', gain: 0.09 },
  { freq: NOTE.G4, dur: 0.22, wave: 'sine', gain: 0.08 },
  { freq: NOTE.E4, dur: 0.28, wave: 'triangle', gain: 0.08 },
  { freq: NOTE.C5, dur: 0.22, wave: 'sine', gain: 0.08 },
  { freq: NOTE.A4, dur: 0.28, wave: 'triangle', gain: 0.08 },
  { freq: NOTE.G4, dur: 0.36, wave: 'sine', gain: 0.09 },
];

declare global {
  interface Window {
    __rezeroGameAudio?: GameAudioEngine;
  }
}

class GameAudioEngine {
  private context: AudioContext | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private activeMusic: MusicKind = 'none';
  private battleMode: BattleMode = 'normal';
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private loopGeneration = 0;
  private musicNodes: OscillatorNode[] = [];
  private filePlayer: HTMLAudioElement | null = null;
  private fileObjectUrl: string | null = null;
  private filePlayToken = 0;

  private ensureContext(): AudioContext {
    if (!this.context) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const context = new Ctx() as AudioContext;
      const master = context.createGain();
      const musicBus = context.createGain();
      const sfxBus = context.createGain();
      const filter = context.createBiquadFilter();

      master.gain.value = 0.9;
      musicBus.gain.value = 0.38;
      sfxBus.gain.value = 0.55;
      filter.type = 'lowpass';
      filter.frequency.value = 4800;
      filter.Q.value = 0.7;

      musicBus.connect(filter);
      sfxBus.connect(filter);
      filter.connect(master);
      master.connect(context.destination);

      this.context = context;
      this.musicBus = musicBus;
      this.sfxBus = sfxBus;
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  private disposeFilePlayer() {
    if (this.filePlayer) {
      try {
        this.filePlayer.pause();
        this.filePlayer.removeAttribute('src');
        this.filePlayer.load();
      } catch {
        /* ignore */
      }
    }
    this.filePlayer = null;
    if (this.fileObjectUrl) {
      URL.revokeObjectURL(this.fileObjectUrl);
      this.fileObjectUrl = null;
    }
  }

  private stopFilePlayer() {
    this.filePlayToken += 1;
    this.disposeFilePlayer();
  }

  private trackUrls(kind: Exclude<MusicKind, 'none'>): string[] {
    if (kind === 'battle' && this.battleMode === 'urgent') {
      return [...BATTLE_URGENT_FILES, ...PAGE_TRACK_FILES.battle];
    }
    return PAGE_TRACK_FILES[kind];
  }

  private playFromSrc(src: string, token: number, objectUrl: string | null = null): Promise<boolean> {
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.46;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        audio.oncanplay = null;
        audio.onloadeddata = null;
        audio.onerror = null;
        resolve(ok);
      };
      const startPlayback = () => {
        if (settled) return;
        audio.oncanplay = null;
        audio.onloadeddata = null;
        if (token !== this.filePlayToken) {
          finish(false);
          return;
        }
        this.disposeFilePlayer();
        this.filePlayer = audio;
        this.fileObjectUrl = objectUrl;
        void audio.play().then(() => finish(true)).catch(() => finish(false));
      };
      audio.oncanplay = startPlayback;
      audio.onloadeddata = startPlayback;
      audio.onerror = () => finish(false);
      audio.src = src;
    });
  }

  private async tryPlayFileTrack(kind: Exclude<MusicKind, 'none'>): Promise<FilePlayStatus> {
    const token = ++this.filePlayToken;
    const urls = this.trackUrls(kind);
    let sawFile = false;

    for (const url of urls) {
      if (token !== this.filePlayToken) return 'aborted';
      try {
        const probe = await fetch(url, { method: 'HEAD' });
        if (!probe.ok) {
          const getProbe = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-15' } });
          if (!getProbe.ok) continue;
        }
        sawFile = true;
        if (await this.playFromSrc(url, token)) return 'played';
        if (token !== this.filePlayToken) return 'aborted';

        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        if (token !== this.filePlayToken) return 'aborted';
        const mime = sniffAudioMime(new Uint8Array(buf));
        if (!mime) continue;
        const objectUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
        const played = await this.playFromSrc(objectUrl, token, objectUrl);
        if (played) return 'played';
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* try next candidate */
      }
    }
    if (token !== this.filePlayToken) return 'aborted';
    return sawFile ? 'aborted' : 'missing';
  }

  private clearMusicPlayback() {
    this.loopGeneration += 1;
    this.stopFilePlayer();
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
    this.musicNodes.forEach((node) => {
      try {
        node.stop();
        node.disconnect();
      } catch {
        /* ignore */
      }
    });
    this.musicNodes = [];
  }

  resetAllMusic() {
    this.clearMusicPlayback();
    this.activeMusic = 'none';
  }

  private stopAllMusic() {
    this.resetAllMusic();
  }

  private playTone(
    time: number,
    freq: number,
    wave: WaveType,
    gain: number,
    duration: number,
    destination: GainNode,
    track = false,
  ) {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gn = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);
    gn.gain.setValueAtTime(0.0001, time);
    gn.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), time + 0.02);
    gn.gain.setValueAtTime(gain, time + duration - 0.04);
    gn.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gn);
    gn.connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    if (track) this.musicNodes.push(osc);
  }

  private getLoopSteps(kind: MusicKind) {
    if (kind === 'lobby') return LOBBY_LOOP;
    if (kind === 'room') return ROOM_LOOP;
    if (kind === 'result') return RESULT_LOOP;
    if (kind === 'practice') return PRACTICE_LOOP;
    if (kind === 'build') return BUILD_LOOP;
    return this.battleMode === 'urgent' ? BATTLE_URGENT : BATTLE_NORMAL;
  }

  private scheduleMusicLoop(kind: MusicKind) {
    if (this.activeMusic !== kind || !this.musicBus) return;

    this.clearMusicPlayback();
    const generation = this.loopGeneration;
    const steps = this.getLoopSteps(kind);
    const ctx = this.ensureContext();
    const start = ctx.currentTime + 0.06;
    let cursor = 0;

    steps.forEach((step) => {
      this.playTone(start + cursor, step.freq, step.wave, step.gain, step.dur, this.musicBus!, true);
      cursor += step.dur;
    });

    const loopMs = Math.ceil(cursor * 1000);
    this.loopTimer = setTimeout(() => {
      if (generation !== this.loopGeneration || this.activeMusic !== kind) return;
      this.scheduleMusicLoop(kind);
    }, loopMs);
  }

  private beginMusic(kind: Exclude<MusicKind, 'none'>) {
    if (!isGameMusicEnabled(loadAudioSettings())) {
      if (this.activeMusic === kind) this.stopAllMusic();
      return;
    }

    if (this.activeMusic === kind && this.filePlayer && !this.filePlayer.paused) return;

    this.stopAllMusic();
    this.activeMusic = kind;
    this.ensureContext();
    const attempt = this.filePlayToken + 1;
    void this.tryPlayFileTrack(kind).then((status) => {
      if (status === 'played') return;
      if (this.filePlayToken !== attempt) return;
      if (this.activeMusic !== kind || !isGameMusicEnabled(loadAudioSettings())) return;
      if (status === 'missing') this.scheduleMusicLoop(kind);
    });
  }

  startLobbyMusic() {
    this.beginMusic('lobby');
  }

  stopLobbyMusic() {
    if (this.activeMusic !== 'lobby') return;
    this.stopAllMusic();
  }

  startRoomMusic() {
    this.beginMusic('room');
  }

  startResultMusic() {
    this.beginMusic('result');
  }

  startPracticeMusic() {
    this.beginMusic('practice');
  }

  startBuildMusic() {
    this.beginMusic('build');
  }

  startBattleMusic(mode: BattleMode = 'normal') {
    this.battleMode = mode;
    this.beginMusic('battle');
  }

  setBattleMode(mode: BattleMode) {
    if (this.battleMode === mode) return;
    this.battleMode = mode;
    if (this.activeMusic !== 'battle' || !isGameMusicEnabled(loadAudioSettings())) return;
    this.activeMusic = 'none';
    this.beginMusic('battle');
  }

  stopBattleMusic() {
    if (this.activeMusic !== 'battle') return;
    this.stopAllMusic();
  }

  applySettings(settings: AudioSettings) {
    if (!isGameMusicEnabled(settings) && this.activeMusic !== 'none') {
      this.stopAllMusic();
    }
  }

  playSfx(type: SfxType | string) {
    try {
      const ctx = this.ensureContext();
      if (!this.sfxBus) return;
      const t = ctx.currentTime;
      const bus = this.sfxBus;
      const tone = (freq: number, wave: WaveType, gain: number, dur: number, delay = 0) => {
        this.playTone(t + delay, freq, wave, gain, dur, bus, false);
      };
      const noiseBurst = (len: number, gain: number, decay: number, delay = 0) => {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * decay));
        }
        const source = ctx.createBufferSource();
        const gn = ctx.createGain();
        source.buffer = buffer;
        gn.gain.setValueAtTime(gain, t + delay);
        gn.gain.exponentialRampToValueAtTime(0.0001, t + delay + len);
        source.connect(gn);
        gn.connect(bus);
        source.start(t + delay);
        source.stop(t + delay + len);
      };

      switch (type) {
        case 'lightning':
          // 부드러운 천둥 (거친 고음 beep 완화)
          noiseBurst(0.28, 0.18, 0.08);
          tone(120, 'sine', 0.12, 0.22, 0.02);
          tone(70, 'triangle', 0.14, 0.32, 0.06);
          tone(180, 'sine', 0.08, 0.16, 0.12);
          break;
        case 'paint':
          noiseBurst(0.12, 0.22, 0.02);
          tone(520, 'triangle', 0.16, 0.08);
          tone(330, 'sine', 0.14, 0.1, 0.06);
          tone(220, 'triangle', 0.12, 0.14, 0.12);
          break;
        case 'scribble':
          for (let i = 0; i < 6; i += 1) {
            tone(700 + Math.random() * 1800, 'square', 0.05, 0.03, i * 0.035);
          }
          noiseBurst(0.18, 0.12, 0.015, 0.02);
          break;
        case 'blankBreak':
          tone(220, 'square', 0.2, 0.06);
          tone(165, 'triangle', 0.18, 0.1, 0.05);
          tone(110, 'sine', 0.16, 0.16, 0.1);
          noiseBurst(0.1, 0.15, 0.03, 0.04);
          break;
        case 'timeReduce':
          tone(880, 'square', 0.12, 0.05);
          tone(660, 'square', 0.1, 0.05, 0.06);
          tone(440, 'square', 0.1, 0.07, 0.12);
          tone(330, 'triangle', 0.14, 0.12, 0.18);
          break;
        case 'revealLength':
        case 'revealPrev':
          tone(523, 'sine', 0.14, 0.1);
          tone(659, 'sine', 0.13, 0.1, 0.1);
          tone(784, 'triangle', 0.14, 0.14, 0.2);
          tone(988, 'sine', 0.12, 0.2, 0.3);
          break;
        default:
          tone(660, 'triangle', 0.12, 0.08);
          tone(880, 'sine', 0.1, 0.1, 0.08);
          break;
      }
    } catch {
      /* mute */
    }
  }
}

function getEngine() {
  if (!window.__rezeroGameAudio) {
    window.__rezeroGameAudio = new GameAudioEngine();
  }
  return window.__rezeroGameAudio;
}

const engine = getEngine();
engine.resetAllMusic();

export function applyAudioSettings(settings: AudioSettings) {
  engine.applySettings(settings);
}

export const LobbyBGM = {
  start: () => engine.startLobbyMusic(),
  stop: () => engine.stopLobbyMusic(),
};

export const RoomBGM = {
  start: () => engine.startRoomMusic(),
  stop: () => engine.resetAllMusic(),
};

export const ResultBGM = {
  start: () => engine.startResultMusic(),
  stop: () => engine.resetAllMusic(),
};

export const PracticeBGM = {
  start: () => engine.startPracticeMusic(),
  stop: () => engine.resetAllMusic(),
};

export const BuildBGM = {
  start: () => engine.startBuildMusic(),
  stop: () => engine.resetAllMusic(),
};

export const BattleBGM = {
  start: (mode?: BattleMode) => engine.startBattleMusic(mode ?? 'normal'),
  setMode: (mode: BattleMode) => engine.setBattleMode(mode),
  stop: () => engine.stopBattleMusic(),
};

export const SFX = {
  play: (type: SfxType | string) => engine.playSfx(type),
};

/** @deprecated Use BattleBGM instead */
export const BGM = BattleBGM;
