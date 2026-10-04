'use client';
import { useEffect, useRef } from 'react';

// Original procedural score: each minigame has its own seeded melody,
// chord progression, tempo, bass line and instrumental arrangement.
export function musicScore(track: string) {
  let seed = 2166136261;
  for (const char of track)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const key = seed >>> 0;
  const random = () => {
    seed = Math.imul(seed, 1664525) + 1013904223;
    return (seed >>> 0) / 4294967296;
  };
  const calm = !track.startsWith('mini:');
  const scales = [
    [0, 2, 4, 7, 9],
    [0, 2, 5, 7, 9],
    [0, 3, 5, 7, 10],
  ];
  const scale = scales[key % scales.length];
  const motif = Array.from({ length: 32 }, (_, i) =>
    i % 8 === 0
      ? 0
      : scale[Math.floor(random() * scale.length)] + (random() > 0.77 ? 12 : 0),
  );
  return {
    calm,
    bpm: calm ? 82 : 108 + (key % 37),
    root: (calm ? 48 : 50) + (key % 12),
    motif,
    chords: [0, [5, 7, 9][key % 3], [9, 5, 2][(key >>> 3) % 3], 7],
    wave: (['sine', 'triangle', 'triangle', 'sine'] as OscillatorType[])[
      key % 4
    ],
    rhythm: key % 4,
  };
}

export function useMusic(track: string, volume: number, active: boolean) {
  const settings = useRef({ track, volume });
  settings.current = { track, volume };
  const resumeRef = useRef<() => void>(() => {});
  useEffect(() => {
    let ctx: AudioContext | undefined, bus: GainNode | undefined;
    let next = 0,
      step = 0,
      current = '',
      score = musicScore(track);
    const voices = new Set<OscillatorNode>();
    const unlock = () => {
      try {
        ctx ??= new AudioContext();
        if (!bus) {
          bus = ctx.createGain();
          bus.gain.value = 0;
          bus.connect(ctx.destination);
        }
        void ctx.resume().catch(() => {});
      } catch {
        /* Audio is optional when a device has no output. */
      }
    };
    resumeRef.current = unlock;
    const note = (
      midi: number,
      at: number,
      duration: number,
      gain: number,
      wave: OscillatorType,
      drop = false,
    ) => {
      if (!ctx || !bus) return;
      const osc = ctx.createOscillator(),
        envelope = ctx.createGain();
      osc.type = wave;
      const hz = 440 * 2 ** ((midi - 69) / 12);
      osc.frequency.setValueAtTime(hz, at);
      if (drop) osc.frequency.exponentialRampToValueAtTime(35, at + duration);
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(gain, at + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      osc.connect(envelope).connect(bus);
      voices.add(osc);
      osc.onended = () => {
        voices.delete(osc);
        osc.disconnect();
        envelope.disconnect();
      };
      osc.start(at);
      osc.stop(at + duration + 0.02);
    };
    const timer = window.setInterval(() => {
      if (!ctx || !bus || ctx.state !== 'running') return;
      bus.gain.setTargetAtTime(
        Math.max(0, Math.min(1, settings.current.volume)) * 0.55,
        ctx.currentTime,
        0.15,
      );
      if (current !== settings.current.track) {
        // Retire the old arrangement instead of layering two tracks.
        voices.forEach((osc) => {
          try {
            osc.stop(ctx!.currentTime + 0.04);
          } catch {}
        });
        current = settings.current.track;
        score = musicScore(current);
        step = 0;
        next = ctx.currentTime + 0.06;
      }
      if (next < ctx.currentTime) next = ctx.currentTime + 0.025;
      const eighth = 30 / score.bpm;
      while (next < ctx.currentTime + 0.18) {
        const bar = Math.floor(step / 8),
          beat = step % 8;
        const chord = score.root + score.chords[Math.floor(bar / 2) % 4];
        if (beat === 0)
          [0, 4, 7].forEach((n) =>
            note(chord + n, next, eighth * 7.8, 0.022, 'sine'),
          );
        if (beat % 2 === 0)
          note(
            chord - 12 + (beat === 6 ? 7 : 0),
            next,
            eighth * 1.6,
            0.08,
            'triangle',
          );
        if (!score.calm || beat % 2 === 0) {
          const variation = Math.floor(bar / 8) % 2 === 1 ? 7 : 0;
          note(
            score.root +
              12 +
              score.motif[(step + score.rhythm * 3) % 32] +
              variation,
            next,
            eighth * 0.9,
            score.calm ? 0.04 : 0.055,
            score.wave,
          );
        }
        if (beat === 0 || (!score.calm && beat === 4))
          note(43, next, 0.16, 0.095, 'sine', true);
        if (!score.calm && beat % 2 === 1)
          note(100 + score.rhythm, next, 0.035, 0.008, 'square');
        next += eighth;
        step++;
      }
    }, 65);
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      resumeRef.current = () => {};
      void ctx?.close();
    };
  }, []);
  useEffect(() => {
    if (active) resumeRef.current();
  }, [active]);
}
