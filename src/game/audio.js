/* ════════════════════════════════════════════════════════════════
   AUDIO — zero-asset WebAudio synth SFX + mute toggle.

   Every sound is generated (oscillators + noise), so the game ships
   no audio files at all. If you want background music later, drop a
   loop into /public/audio and wire it in initAudio() — royalty-free
   sources: Pixabay Music, FreePD, incompetech (Kevin MacLeod).
   ════════════════════════════════════════════════════════════════ */

let ctx = null;
let master = null;
let muted = localStorage.getItem('gridrun-muted') === '1';

/** must be called from a user gesture (browser autoplay policy) */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('gridrun-muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
export const isMuted = () => muted;

/* ── tiny synth helpers ── */
function tone({ type = 'sine', from = 440, to = from, dur = 0.15, vol = 0.3, delay = 0 }) {
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

function noise({ dur = 0.2, vol = 0.25, freq = 1200, delay = 0 }) {
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

/* ── game vocabulary ── */
export const sfx = {
  jump: () => tone({ type: 'square', from: 240, to: 520, dur: 0.14, vol: 0.16 }),
  land: () => noise({ dur: 0.08, vol: 0.12, freq: 500 }),
  slide: () => noise({ dur: 0.18, vol: 0.14, freq: 900 }),
  lane: () => tone({ type: 'sine', from: 340, to: 300, dur: 0.06, vol: 0.08 }),
  /** pitch rises with the current coin streak — feels great */
  coin: (streak = 0) => tone({ type: 'sine', from: 880 + Math.min(streak, 12) * 60, to: 1300 + Math.min(streak, 12) * 60, dur: 0.09, vol: 0.14 }),
  power: () => {
    tone({ type: 'square', from: 520, to: 520, dur: 0.09, vol: 0.12 });
    tone({ type: 'square', from: 660, to: 660, dur: 0.09, vol: 0.12, delay: 0.09 });
    tone({ type: 'square', from: 880, to: 880, dur: 0.12, vol: 0.12, delay: 0.18 });
  },
  near: () => noise({ dur: 0.12, vol: 0.1, freq: 2400 }),
  zone: () => {
    tone({ type: 'sine', from: 660, to: 990, dur: 0.25, vol: 0.1 });
    tone({ type: 'sine', from: 990, to: 1320, dur: 0.3, vol: 0.08, delay: 0.12 });
  },
  shieldPop: () => tone({ type: 'triangle', from: 700, to: 180, dur: 0.3, vol: 0.2 }),
  crash: () => {
    noise({ dur: 0.4, vol: 0.35, freq: 700 });
    tone({ type: 'sawtooth', from: 160, to: 40, dur: 0.5, vol: 0.3 });
  },
};
