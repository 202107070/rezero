/* eslint-disable @typescript-eslint/no-explicit-any */

const SFX = (() => {
  let c: AudioContext | null = null;
  const g = () => {
    if (!c) c = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    if (c!.state === 'suspended') c!.resume();
    return c!;
  };
  const noise = (a: AudioContext, len: number, rate: number) => {
    const b = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * rate));
    return b;
  };
  const pt = (a: AudioContext, n: number, freq: number, type: OscillatorType, gain: number, dur: number) => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, n);
    const gn = a.createGain();
    gn.gain.setValueAtTime(gain, n);
    gn.gain.exponentialRampToValueAtTime(0.001, n + dur);
    o.connect(gn);
    gn.connect(a.destination);
    o.start(n);
    o.stop(n + dur);
  };
  return {
    play(t: string) {
      try {
        const a = g();
        const n = a.currentTime;
        if (t === 'lightning') {
          const s = a.createBufferSource();
          s.buffer = noise(a, 0.5, 0.04);
          const gn = a.createGain();
          gn.gain.setValueAtTime(1.2, n);
          gn.gain.exponentialRampToValueAtTime(0.001, n + 0.5);
          s.connect(gn);
          gn.connect(a.destination);
          s.start(n);
          pt(a, n + 0.02, 80, 'sine', 0.6, 0.5);
          pt(a, n + 0.08, 55, 'sine', 0.5, 0.5);
          pt(a, n + 0.15, 30, 'triangle', 0.4, 0.6);
        } else if (t === 'paint') {
          const s1 = a.createBufferSource();
          s1.buffer = noise(a, 0.15, 0.02);
          const g1 = a.createGain();
          g1.gain.setValueAtTime(0.8, n);
          g1.gain.exponentialRampToValueAtTime(0.001, n + 0.15);
          s1.connect(g1);
          g1.connect(a.destination);
          s1.start(n);
          pt(a, n, 400, 'square', 0.3, 0.1);
          pt(a, n + 0.04, 250, 'sawtooth', 0.25, 0.12);
          pt(a, n + 0.08, 150, 'triangle', 0.3, 0.15);
          pt(a, n + 0.13, 80, 'sine', 0.2, 0.18);
        } else if (t === 'scribble') {
          for (let i = 0; i < 8; i++) {
            const d = 0.02 + Math.random() * 0.04;
            pt(a, n + i * 0.04, 800 + Math.random() * 3000, 'sawtooth', 0.08, d);
          }
          const s2 = a.createBufferSource();
          s2.buffer = noise(a, 0.25, 0.01);
          const g2 = a.createGain();
          g2.gain.setValueAtTime(0.3, n);
          g2.gain.exponentialRampToValueAtTime(0.001, n + 0.25);
          s2.connect(g2);
          g2.connect(a.destination);
          s2.start(n);
        } else if (t === 'blankBreak') {
          pt(a, n, 180, 'triangle', 0.7, 0.08);
          pt(a, n + 0.03, 120, 'sine', 0.6, 0.12);
          pt(a, n + 0.06, 70, 'triangle', 0.55, 0.18);
          const s3 = a.createBufferSource();
          s3.buffer = noise(a, 0.12, 0.03);
          const g3 = a.createGain();
          g3.gain.setValueAtTime(0.4, n);
          g3.gain.exponentialRampToValueAtTime(0.001, n + 0.12);
          s3.connect(g3);
          g3.connect(a.destination);
          s3.start(n);
        } else if (t === 'timeReduce') {
          pt(a, n, 1200, 'square', 0.3, 0.04);
          pt(a, n + 0.05, 900, 'square', 0.25, 0.04);
          pt(a, n + 0.1, 600, 'square', 0.2, 0.06);
          pt(a, n + 0.18, 300, 'square', 0.35, 0.12);
        } else if (t === 'revealLength' || t === 'revealPrev') {
          pt(a, n, 440, 'sine', 0.2, 0.15);
          pt(a, n + 0.08, 554, 'sine', 0.18, 0.15);
          pt(a, n + 0.16, 659, 'sine', 0.22, 0.2);
          pt(a, n + 0.24, 880, 'triangle', 0.2, 0.3);
        } else {
          pt(a, n, 660, 'sine', 0.15, 0.08);
          pt(a, n + 0.06, 880, 'sine', 0.2, 0.12);
        }
      } catch {
        /* mute */
      }
    },
  };
})();

const BGM = (() => {
  let c: AudioContext | null = null;
  let playing = false;
  let nodes: OscillatorNode[] = [];
  let mode = 'normal';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const g = () => {
    if (!c) c = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    if (c!.state === 'suspended') c!.resume();
    return c!;
  };
  const stopAll = () => {
    nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* ignore */
      }
    });
    nodes = [];
  };
  const mkOsc = (type: OscillatorType, freq: number, gain: number, start: number, dur: number) => {
    const a = g();
    const osc = a.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    const gn = a.createGain();
    gn.gain.setValueAtTime(0, start);
    gn.gain.linearRampToValueAtTime(gain * 0.06, start + 0.05);
    gn.gain.setValueAtTime(gain * 0.06, start + dur - 0.05);
    gn.gain.linearRampToValueAtTime(0, start + dur);
    gn.connect(a.destination);
    osc.connect(gn);
    osc.start(start);
    osc.stop(start + dur + 0.1);
    nodes.push(osc);
  };
  const normalMelody = (t: number) => {
    const notes = [262, 294, 330, 349, 392, 349, 330, 294, 262, 330, 392, 440, 392, 330, 294, 262];
    notes.forEach((n, i) => mkOsc('triangle', n, 0.6, t + i * 0.35, 0.3));
    for (let i = 0; i < 8; i++) mkOsc('sine', 131, 0.3, t + i * 0.7, 0.6);
    return notes.length * 0.35;
  };
  const urgentMelody = (t: number) => {
    const notes = [440, 415, 440, 523, 587, 523, 440, 349, 330, 349, 392, 440, 523, 587, 659, 523];
    notes.forEach((n, i) => mkOsc('square', n, 0.5, t + i * 0.16, 0.12));
    for (let i = 0; i < 16; i++) mkOsc('triangle', 110, 0.35, t + i * 0.16, 0.14);
    return notes.length * 0.16;
  };
  const loop = () => {
    if (!playing) return;
    stopAll();
    const a = g();
    const t = a.currentTime + 0.05;
    const len = mode === 'urgent' ? urgentMelody(t) : normalMelody(t);
    timer = setTimeout(loop, (len - 0.04) * 1000);
  };
  return {
    start(m?: string) {
      mode = m || 'normal';
      if (!playing) {
        playing = true;
        g();
        loop();
      }
    },
    setMode(m: string) {
      mode = m;
    },
    stop() {
      playing = false;
      stopAll();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
})();

export { SFX, BGM };
