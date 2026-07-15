/* ════════════════════════════════════════════════════════════════
   NEON ARENA — WebAudio synth SFX + mute
   ════════════════════════════════════════════════════════════════ */

let ctx = null;
let master = null;
let muted = localStorage.getItem('neonarena-muted') === '1';

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.45;
  master.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('neonarena-muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.45;
  return muted;
}

export const isMuted = () => muted;

function tone({ type = 'sine', from = 440, to = from, dur = 0.15, vol = 0.25, delay = 0 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.2, freq = 1000, delay = 0 }) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, (dur * ctx.sampleRate) | 0);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(flt).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  light: () => tone({ type: 'square', from: 420, to: 280, dur: 0.08, vol: 0.12 }),
  heavy: () => {
    tone({ type: 'sawtooth', from: 180, to: 90, dur: 0.16, vol: 0.18 });
    noise({ dur: 0.1, vol: 0.1, freq: 600 });
  },
  hit: () => noise({ dur: 0.12, vol: 0.22, freq: 900 }),
  block: () => tone({ type: 'triangle', from: 200, to: 140, dur: 0.1, vol: 0.14 }),
  dodge: () => tone({ type: 'sine', from: 600, to: 900, dur: 0.12, vol: 0.1 }),
  hurt: () => tone({ type: 'sawtooth', from: 120, to: 60, dur: 0.2, vol: 0.2 }),
  ko: () => {
    noise({ dur: 0.45, vol: 0.3, freq: 400 });
    tone({ type: 'sawtooth', from: 220, to: 40, dur: 0.55, vol: 0.25 });
  },
  win: () => {
    tone({ type: 'square', from: 520, to: 520, dur: 0.1, vol: 0.12 });
    tone({ type: 'square', from: 660, to: 660, dur: 0.1, vol: 0.12, delay: 0.1 });
    tone({ type: 'square', from: 880, to: 880, dur: 0.2, vol: 0.14, delay: 0.2 });
  },
  telegraph: () => tone({ type: 'sine', from: 880, to: 440, dur: 0.15, vol: 0.08 }),
};
