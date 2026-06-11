/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AudioSettings } from '../../types/audioSettings';
import { loadAudioSettings } from './audioSettings';

type WaveType = OscillatorType;
type BattleMode = 'normal' | 'urgent';
type MusicKind = 'none' | 'lobby' | 'battle';
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
  { freq: NOTE.C4, dur: 0.45, wave: 'triangle', gain: 0.18 },
  { freq: NOTE.E4, dur: 0.45, wave: 'triangle', gain: 0.18 },
  { freq: NOTE.G4, dur: 0.45, wave: 'triangle', gain: 0.2 },
  { freq: NOTE.C5, dur: 0.6, wave: 'sine', gain: 0.16 },
  { freq: NOTE.A4, dur: 0.45, wave: 'triangle', gain: 0.17 },
  { freq: NOTE.F4, dur: 0.45, wave: 'triangle', gain: 0.17 },
  { freq: NOTE.D4, dur: 0.6, wave: 'sine', gain: 0.16 },
  { freq: NOTE.G4, dur: 0.75, wave: 'triangle', gain: 0.18 },
];

const BATTLE_NORMAL: MelodyStep[] = [
  { freq: NOTE.E4, dur: 0.22, wave: 'square', gain: 0.12 },
  { freq: NOTE.G4, dur: 0.22, wave: 'square', gain: 0.12 },
  { freq: NOTE.B4, dur: 0.22, wave: 'square', gain: 0.13 },
  { freq: NOTE.E5, dur: 0.28, wave: 'triangle', gain: 0.14 },
  { freq: NOTE.D5, dur: 0.22, wave: 'square', gain: 0.12 },
  { freq: NOTE.B4, dur: 0.22, wave: 'square', gain: 0.12 },
  { freq: NOTE.G4, dur: 0.22, wave: 'square', gain: 0.11 },
  { freq: NOTE.E4, dur: 0.34, wave: 'triangle', gain: 0.13 },
];

const BATTLE_URGENT: MelodyStep[] = [
  { freq: NOTE.E5, dur: 0.13, wave: 'square', gain: 0.14 },
  { freq: NOTE.D5, dur: 0.13, wave: 'square', gain: 0.13 },
  { freq: NOTE.E5, dur: 0.13, wave: 'square', gain: 0.14 },
  { freq: NOTE.G5, dur: 0.13, wave: 'square', gain: 0.15 },
  { freq: NOTE.E5, dur: 0.13, wave: 'square', gain: 0.14 },
  { freq: NOTE.B4, dur: 0.13, wave: 'square', gain: 0.13 },
  { freq: NOTE.G4, dur: 0.13, wave: 'square', gain: 0.12 },
  { freq: NOTE.E4, dur: 0.2, wave: 'triangle', gain: 0.14 },
];

declare global {
  interface Window {
    __rezeroGameAudio?: GameAudioEngine;
  }
}

class GameAudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;

  private activeMusic: MusicKind = 'none';
  private battleMode: BattleMode = 'normal';
  private loopTimer: ReturnType<typeof setTimeout> | null = null;
  private loopGeneration = 0;
  private musicNodes: OscillatorNode[] = [];

  private ensureContext() {
    if (!this.context) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.musicBus = this.context.createGain();
      this.sfxBus = this.context.createGain();
      this.filter = this.context.createBiquadFilter();

      this.master.gain.value = 0.9;
      this.musicBus.gain.value = 0.38;
      this.sfxBus.gain.value = 0.55;
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 4800;
      this.filter.Q.value = 0.7;

      this.musicBus.connect(this.filter);
      this.sfxBus.connect(this.filter);
      this.filter.connect(this.master);
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      void this.context.resume();
    }
    return this.context;
  }

  private clearMusicPlayback() {
    this.loopGeneration += 1;
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
    const settings = loadAudioSettings();
    const enabled = kind === 'lobby' ? settings.lobbyMusic : settings.battleMusic;
    if (!enabled) {
      if (this.activeMusic === kind) this.stopAllMusic();
      return;
    }

    if (this.activeMusic === kind) return;

    this.stopAllMusic();
    this.activeMusic = kind;
    this.ensureContext();
    this.scheduleMusicLoop(kind);
  }

  startLobbyMusic() {
    this.beginMusic('lobby');
  }

  stopLobbyMusic() {
    if (this.activeMusic !== 'lobby') return;
    this.stopAllMusic();
  }

  startBattleMusic(mode: BattleMode = 'normal') {
    this.battleMode = mode;
    this.beginMusic('battle');
  }

  setBattleMode(mode: BattleMode) {
    if (this.battleMode === mode) return;
    this.battleMode = mode;
    if (this.activeMusic !== 'battle' || !loadAudioSettings().battleMusic) return;
    this.scheduleMusicLoop('battle');
  }

  stopBattleMusic() {
    if (this.activeMusic !== 'battle') return;
    this.stopAllMusic();
  }

  applySettings(settings: AudioSettings) {
    if (!settings.lobbyMusic && this.activeMusic === 'lobby') {
      this.stopAllMusic();
    }
    if (!settings.battleMusic && this.activeMusic === 'battle') {
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
          noiseBurst(0.35, 0.35, 0.05);
          tone(90, 'sawtooth', 0.2, 0.18, 0.02);
          tone(55, 'sine', 0.18, 0.28, 0.08);
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
