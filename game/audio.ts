let context: AudioContext | undefined;
let master: GainNode | undefined,
  masterMuted = false;
export function setSfxMuted(muted: boolean) {
  masterMuted = muted;
  if (context && master)
    master.gain.setTargetAtTime(muted ? 0 : 1, context.currentTime, 0.015);
}
export function playSfx(kind: string, delta = 0, muted = false) {
  if (muted) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(() => {});
    const c = context;
    if (!master) {
      master = c.createGain();
      master.gain.value = masterMuted ? 0 : 1;
      master.connect(c.destination);
    }
    const note = (
      f: number,
      at: number,
      d = 0.14,
      wave: OscillatorType = 'triangle',
      vol = 0.035,
    ) => {
      const o = c.createOscillator(),
        g = c.createGain();
      o.type = wave;
      o.frequency.setValueAtTime(f, c.currentTime + at);
      o.frequency.exponentialRampToValueAtTime(
        Math.max(35, f * 0.8),
        c.currentTime + at + d,
      );
      g.gain.setValueAtTime(vol, c.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + at + d);
      o.connect(g).connect(master!);
      o.onended = () => {
        o.disconnect();
        g.disconnect();
      };
      o.start(c.currentTime + at);
      o.stop(c.currentTime + at + d);
    };
    if (kind === 'arrival') {
      [150, 190, 250, 330, 440, 660].forEach((f, i) =>
        note(f, i * 0.17, 0.32, 'sine', 0.018),
      );
    } else if (kind === 'turn') {
      [440, 660, 880].forEach((f, i) =>
        note(f, i * 0.1, 0.18, 'triangle', 0.025),
      );
    } else if (kind === 'dice') {
      for (let i = 0; i < 8; i++)
        note(130 + (i % 3) * 45, i * 0.13, 0.05, 'square', 0.013);
      note(990, 1.7, 0.2, 'triangle', 0.035);
    } else if (kind === 'diamond') {
      [660, 880, 1100, 1320, 1760].forEach((f, i) =>
        note(f, i * 0.11, 0.24, 'sine', 0.028),
      );
    } else if (kind === 'vote') {
      [440, 550, 740, 880].forEach((f, i) =>
        note(f, i * 0.075, 0.12, 'sine', 0.024),
      );
    } else if (kind === 'event') {
      for (let i = 0; i < 14; i++)
        note(48 + (i % 4) * 17, i * 0.13, 0.65, 'sawtooth', 0.012);
      [330, 277, 220].forEach((f, i) =>
        note(f, 0.35 + i * 0.2, 0.3, 'triangle', 0.02),
      );
    } else if (kind === 'hazard') {
      for (let i = 0; i < 5; i++)
        note(80 + i * 14, i * 0.08, 0.4, 'sawtooth', 0.022);
      note(210, 0.16, 0.45, 'triangle');
    } else if (kind === 'bank') {
      [523, 659, 784, 1046, 1318].forEach((f, i) => note(f, i * 0.1, 0.22));
      if (delta > 0)
        for (let i = 0; i < 24; i++)
          note(
            [1046, 1318, 1568, 2093][i % 4],
            1 + i * 0.14,
            0.07,
            'sine',
            0.013,
          );
    } else if (kind === 'portal') {
      for (let i = 0; i < 9; i++)
        note(240 + i * 85, i * 0.04, 0.12, 'sine', 0.018);
    } else if (kind === 'diceRoll') {
      for (let i = 0; i < 9; i++)
        note(260 + ((i * 7) % 5) * 70, i * 0.1, 0.05, 'square', 0.011);
    } else if (kind === 'diceHit') {
      note(180, 0, 0.12, 'square', 0.04);
      [880, 1175, 1568].forEach((f, i) =>
        note(f, 0.05 + i * 0.06, 0.18, 'triangle', 0.032),
      );
    } else if (kind === 'count') {
      note(520 + Math.min(10, delta) * 45, 0, 0.07, 'sine', 0.022);
    } else if (kind === 'stomp') {
      note(70, 0, 0.35, 'sawtooth', 0.05);
      note(110, 0.04, 0.25, 'square', 0.03);
      [523, 392].forEach((f, i) => note(f, 0.2 + i * 0.1, 0.14));
    } else if (kind === 'steal') {
      [988, 784, 988, 1319].forEach((f, i) =>
        note(f, i * 0.07, 0.1, 'square', 0.02),
      );
    } else if (kind === 'grow') {
      for (let i = 0; i < 8; i++)
        note(140 + i * 60, i * 0.06, 0.12, 'sawtooth', 0.02);
    } else if (kind === 'shrink') {
      for (let i = 0; i < 8; i++)
        note(1400 - i * 140, i * 0.05, 0.1, 'sine', 0.025);
    } else if (kind === 'villain') {
      [220, 233, 207, 196].forEach((f, i) =>
        note(f, i * 0.18, 0.4, 'sawtooth', 0.025),
      );
      note(98, 0.7, 0.7, 'square', 0.03);
    } else if (kind === 'lastTurns') {
      [392, 392, 523, 659, 784, 1046].forEach((f, i) =>
        note(f, i * 0.12, 0.22, 'square', 0.022),
      );
    } else if (delta > 0 || kind === 'spring') {
      [660, 880, 1100].forEach((f, i) => note(f, i * 0.09, 0.15));
    } else if (delta < 0) {
      [400, 310, 220].forEach((f, i) => note(f, i * 0.11, 0.2));
    } else if (kind === 'step') note(170, 0, 0.04, 'triangle', 0.014);
    else if (kind === 'dig') note(150, 0, 0.045, 'square', 0.018);
    else if (kind === 'stamp') note(210, 0, 0.12, 'triangle', 0.04);
    else if (kind === 'pass') note(730, 0, 0.1);
    else note(440, 0, 0.1);
  } catch {}
}
