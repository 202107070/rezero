"""8-bit style looping BGM for rezero pages (A minor family)."""
from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
A4 = 440.0

NOTE = {
    "A2": 110.00,
    "B2": 123.47,
    "C3": 130.81,
    "D3": 146.83,
    "E3": 164.81,
    "F3": 174.61,
    "G3": 196.00,
    "A3": 220.00,
    "B3": 246.94,
    "C4": 261.63,
    "D4": 293.66,
    "E4": 329.63,
    "F4": 349.23,
    "G4": 392.00,
    "A4": 440.00,
    "B4": 493.88,
    "C5": 523.25,
    "D5": 587.33,
    "E5": 659.25,
    "F5": 698.46,
    "G5": 783.99,
    "A5": 880.00,
}


def n(name: str) -> float:
    return NOTE[name]


def env(length: int, attack=0.01, decay=0.08, sustain=0.55, release=0.12) -> np.ndarray:
    a = max(1, int(SR * attack))
    d = max(1, int(SR * decay))
    r = max(1, int(SR * release))
    s = max(1, length - a - d - r)
    if a + d + r > length:
        a = max(1, length // 8)
        d = max(1, length // 8)
        r = max(1, length // 6)
        s = max(1, length - a - d - r)
    e = np.concatenate(
        [
            np.linspace(0, 1, a, endpoint=False),
            np.linspace(1, sustain, d, endpoint=False),
            np.full(s, sustain),
            np.linspace(sustain, 0, r, endpoint=False),
        ]
    )
    if len(e) < length:
        e = np.pad(e, (0, length - len(e)))
    return e[:length]


def osc(kind: str, freq: float, length: int, duty=0.5) -> np.ndarray:
    t = np.arange(length) / SR
    phase = (t * freq) % 1.0
    if kind == "square":
        return np.where(phase < duty, 1.0, -1.0)
    if kind == "tri":
        return 4.0 * np.abs(phase - 0.5) - 1.0
    if kind == "saw":
        return 2.0 * phase - 1.0
    if kind == "sine":
        return np.sin(2 * math.pi * freq * t)
    raise ValueError(kind)


def noise(length: int) -> np.ndarray:
    rng = np.random.default_rng(7)
    x = rng.uniform(-1, 1, length)
    # cheap lowpass for snare-ish
    kernel = np.ones(8) / 8
    return np.convolve(x, kernel, mode="same")


def note_tone(kind: str, freq: float, beats: float, bpm: float, vol: float, duty=0.5, **adsr) -> np.ndarray:
    length = int(SR * (60.0 / bpm) * beats)
    if freq <= 0:
        return np.zeros(length)
    wave_ = osc(kind, freq, length, duty=duty) * env(length, **adsr) * vol
    return wave_


def rest(beats: float, bpm: float) -> np.ndarray:
    return np.zeros(int(SR * (60.0 / bpm) * beats))


def seq(parts: list[np.ndarray]) -> np.ndarray:
    return np.concatenate(parts) if parts else np.zeros(1)


def mix(*tracks: np.ndarray) -> np.ndarray:
    n = max(len(t) for t in tracks)
    out = np.zeros(n)
    for t in tracks:
        out[: len(t)] += t
    peak = np.max(np.abs(out)) or 1.0
    return np.clip(out / peak * 0.86, -1, 1)


def kick(beats: float, bpm: float, vol=0.9) -> np.ndarray:
    length = int(SR * (60.0 / bpm) * beats)
    t = np.arange(length) / SR
    freq = 110 * np.exp(-t * 18)
    body = np.sin(2 * math.pi * np.cumsum(freq) / SR)
    click = osc("square", 180, length, 0.3) * np.exp(-t * 40) * 0.15
    return (body * np.exp(-t * 8) + click) * vol * env(length, 0.001, 0.04, 0.2, 0.08)


def hat(beats: float, bpm: float, vol=0.22) -> np.ndarray:
    length = int(SR * (60.0 / bpm) * beats)
    t = np.arange(length) / SR
    h = noise(length) * np.exp(-t * 28) * vol
    return h


def snare(beats: float, bpm: float, vol=0.45) -> np.ndarray:
    length = int(SR * (60.0 / bpm) * beats)
    t = np.arange(length) / SR
    nse = noise(length) * np.exp(-t * 14)
    tone = osc("tri", 190, length) * np.exp(-t * 12) * 0.35
    return (nse + tone) * vol


def write_wav(path: Path, audio: np.ndarray) -> None:
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    print(f"wrote {path.name} ({len(audio)/SR:.1f}s)")


def pattern_from(notes: list[tuple[str, float]], bpm: float, kind: str, vol: float, **kw) -> np.ndarray:
    chunks = []
    for name, beats in notes:
        if name == "-":
            chunks.append(rest(beats, bpm))
        else:
            chunks.append(note_tone(kind, n(name), beats, bpm, vol, **kw))
    return seq(chunks)


def drums_basic(bars: int, bpm: float, urgent=False) -> np.ndarray:
    parts = []
    for bar in range(bars):
        k = kick(0.5, bpm)
        h = hat(0.5, bpm, 0.18 if not urgent else 0.26)
        s = snare(0.5, bpm, 0.42 if not urgent else 0.5)
        r = rest(0.5, bpm)
        # 4/4: k . k . | s . h h  simplified as 8 eighths
        line = [k, h, k if urgent or bar % 2 else r, h, s, h, k if urgent else r, h]
        parts.append(seq(line))
    return seq(parts)


def compose_battle() -> np.ndarray:
    bpm = 142
    bass = pattern_from(
        [("A2", 1), ("A2", 0.5), ("C3", 0.5), ("E3", 1), ("D3", 0.5), ("C3", 0.5)] * 8
        + [("F3", 1), ("F3", 0.5), ("A2", 0.5), ("G3", 1), ("E3", 0.5), ("D3", 0.5)] * 4,
        bpm,
        "square",
        0.28,
        duty=0.28,
        attack=0.004,
        decay=0.06,
        sustain=0.45,
        release=0.05,
    )
    lead = pattern_from(
        [
            ("A4", 0.5),
            ("C5", 0.5),
            ("E5", 0.5),
            ("D5", 0.25),
            ("C5", 0.25),
            ("A4", 0.5),
            ("G4", 0.5),
            ("A4", 1),
            ("E4", 0.5),
            ("G4", 0.5),
            ("A4", 0.5),
            ("C5", 0.5),
            ("B4", 0.5),
            ("A4", 0.5),
            ("G4", 1),
        ]
        * 4
        + [
            ("C5", 0.5),
            ("D5", 0.5),
            ("E5", 1),
            ("D5", 0.5),
            ("C5", 0.5),
            ("A4", 1),
            ("G4", 0.5),
            ("A4", 0.5),
            ("C5", 1),
            ("B4", 0.5),
            ("G4", 0.5),
            ("A4", 2),
        ]
        * 2,
        bpm,
        "square",
        0.22,
        duty=0.18,
        attack=0.006,
        decay=0.08,
        sustain=0.5,
        release=0.1,
    )
    arp = pattern_from(
        [("A3", 0.25), ("C4", 0.25), ("E4", 0.25), ("A4", 0.25)] * 24
        + [("F3", 0.25), ("A3", 0.25), ("C4", 0.25), ("F4", 0.25)] * 8
        + [("G3", 0.25), ("B3", 0.25), ("D4", 0.25), ("G4", 0.25)] * 8,
        bpm,
        "tri",
        0.16,
        attack=0.002,
        decay=0.04,
        sustain=0.35,
        release=0.04,
    )
    drums = drums_basic(16, bpm, urgent=False)
    pad = pattern_from(
        [("A3", 4), ("C4", 4), ("A3", 4), ("G3", 4)] * 2,
        bpm,
        "sine",
        0.12,
        attack=0.2,
        decay=0.3,
        sustain=0.7,
        release=0.4,
    )
    return mix(bass, lead, arp, drums, pad)


def compose_urgent() -> np.ndarray:
    bpm = 172
    bass = pattern_from(
        [("A2", 0.5), ("A2", 0.5), ("C3", 0.5), ("A2", 0.5), ("D3", 0.5), ("C3", 0.5), ("E3", 0.5), ("C3", 0.5)] * 12,
        bpm,
        "square",
        0.3,
        duty=0.22,
        attack=0.002,
        decay=0.04,
        sustain=0.4,
        release=0.03,
    )
    lead = pattern_from(
        [
            ("E5", 0.25),
            ("A5", 0.25),
            ("G5", 0.25),
            ("E5", 0.25),
            ("D5", 0.25),
            ("E5", 0.25),
            ("C5", 0.25),
            ("A4", 0.25),
            ("E5", 0.5),
            ("D5", 0.25),
            ("C5", 0.25),
            ("B4", 0.5),
            ("A4", 0.5),
        ]
        * 8,
        bpm,
        "square",
        0.24,
        duty=0.12,
        attack=0.003,
        decay=0.05,
        sustain=0.45,
        release=0.04,
    )
    arp = pattern_from(
        [("A4", 0.125), ("C5", 0.125), ("E5", 0.125), ("A5", 0.125)] * 64,
        bpm,
        "tri",
        0.14,
        attack=0.001,
        decay=0.02,
        sustain=0.3,
        release=0.02,
    )
    drums = drums_basic(16, bpm, urgent=True)
    return mix(bass, lead, arp, drums)


def compose_result() -> np.ndarray:
    bpm = 104
    bass = pattern_from(
        [("A2", 2), ("C3", 2), ("F3", 2), ("G3", 2)] * 4,
        bpm,
        "tri",
        0.26,
        attack=0.02,
        decay=0.12,
        sustain=0.6,
        release=0.15,
    )
    lead = pattern_from(
        [
            ("A4", 1),
            ("C5", 1),
            ("E5", 1.5),
            ("D5", 0.5),
            ("C5", 1),
            ("B4", 1),
            ("A4", 1),
            ("G4", 1),
            ("A4", 0.5),
            ("C5", 0.5),
            ("E5", 1),
            ("G5", 1),
            ("E5", 1),
            ("D5", 1),
            ("C5", 2),
        ]
        * 2,
        bpm,
        "square",
        0.2,
        duty=0.35,
        attack=0.01,
        decay=0.1,
        sustain=0.55,
        release=0.2,
    )
    arp = pattern_from(
        [("A3", 0.5), ("C4", 0.5), ("E4", 0.5), ("A4", 0.5)] * 16,
        bpm,
        "sine",
        0.18,
        attack=0.01,
        decay=0.08,
        sustain=0.5,
        release=0.1,
    )
    drums = drums_basic(16, bpm, urgent=False) * 0.55
    return mix(bass, lead, arp, drums)


def compose_practice() -> np.ndarray:
    bpm = 88
    pad = pattern_from(
        [("A3", 4), ("F3", 4), ("G3", 4), ("E3", 4)] * 2,
        bpm,
        "sine",
        0.22,
        attack=0.4,
        decay=0.4,
        sustain=0.75,
        release=0.6,
    )
    arp = pattern_from(
        [("A3", 0.5), ("C4", 0.5), ("E4", 0.5), ("A4", 0.5), ("E4", 0.5), ("C4", 0.5), ("A3", 0.5), ("E3", 0.5)] * 8,
        bpm,
        "tri",
        0.2,
        attack=0.02,
        decay=0.12,
        sustain=0.45,
        release=0.12,
    )
    lead = pattern_from(
        [
            ("E4", 2),
            ("A4", 2),
            ("G4", 1.5),
            ("E4", 0.5),
            ("C4", 2),
            ("D4", 2),
            ("E4", 3),
            ("-", 1),
            ("A4", 1),
            ("C5", 1),
            ("B4", 2),
            ("A4", 2),
            ("G4", 2),
            ("E4", 2),
        ],
        bpm,
        "square",
        0.14,
        duty=0.4,
        attack=0.03,
        decay=0.15,
        sustain=0.5,
        release=0.25,
    )
    return mix(pad, arp, lead)


def compose_build() -> np.ndarray:
    bpm = 118
    bass = pattern_from(
        [("A2", 1), ("E3", 0.5), ("A2", 0.5), ("F3", 1), ("E3", 0.5), ("D3", 0.5)] * 8,
        bpm,
        "square",
        0.24,
        duty=0.3,
        attack=0.006,
        decay=0.07,
        sustain=0.5,
        release=0.06,
    )
    lead = pattern_from(
        [
            ("A4", 0.5),
            ("-", 0.25),
            ("C5", 0.25),
            ("A4", 0.5),
            ("G4", 0.5),
            ("A4", 1),
            ("E4", 0.5),
            ("G4", 0.5),
            ("A4", 0.5),
            ("C5", 0.5),
            ("D5", 0.5),
            ("C5", 0.5),
            ("A4", 1),
        ]
        * 4,
        bpm,
        "square",
        0.2,
        duty=0.25,
        attack=0.008,
        decay=0.09,
        sustain=0.5,
        release=0.1,
    )
    arp = pattern_from(
        [("C4", 0.25), ("E4", 0.25), ("A4", 0.25), ("E4", 0.25)] * 32,
        bpm,
        "tri",
        0.15,
        attack=0.004,
        decay=0.05,
        sustain=0.4,
        release=0.04,
    )
    drums = drums_basic(12, bpm, urgent=False) * 0.7
    return mix(bass, lead, arp, drums)


def main() -> None:
    out = Path(__file__).resolve().parents[1] / "public" / "audio"
    out.mkdir(parents=True, exist_ok=True)
    write_wav(out / "battle.wav", compose_battle())
    write_wav(out / "battle-urgent.wav", compose_urgent())
    write_wav(out / "result.wav", compose_result())
    write_wav(out / "practice.wav", compose_practice())
    write_wav(out / "build.wav", compose_build())


if __name__ == "__main__":
    main()
