/* ════════════════════════════════════════════════════════════════
   AUDIO — WebAudio synth SFX + score-tier BGM + mute toggle.

   BGM files live in /public/audio and switch by score:
     < 10000  → bgm-till-10000.mp3  (loops)
     < 20000  → bgm-till-15000.mp3  (loops)
     ≥ 20000  → bgm-after-15000.mp3 (loops)
   ════════════════════════════════════════════════════════════════ */

const BGM_VOL = 0.38;
const SFX_MASTER = 0.5;

const BGM_TRACKS = [
  { maxScore: 10000, src: './audio/bgm-till-10000.mp3' },
  { maxScore: 20000, src: './audio/bgm-till-15000.mp3' },
  { maxScore: Infinity, src: './audio/bgm-after-15000.mp3' },
];

let ctx = null;
let master = null;
let muted = localStorage.getItem('gridrun-muted') === '1';

/** @type {HTMLAudioElement[]} */
const bgmPool = BGM_TRACKS.map((t) => {
  const a = new Audio(t.src);
  a.loop = true;
  a.preload = 'auto';
  a.volume = 0;
  return a;
});

let bgmIndex = -1;
let bgmPlaying = false;

function trackForScore(score) {
  const s = Math.max(0, Number(score) || 0);
  for (let i = 0; i < BGM_TRACKS.length; i++) {
    if (s < BGM_TRACKS[i].maxScore) return i;
  }
  return BGM_TRACKS.length - 1;
}

function applyBgmVolume() {
  bgmPool.forEach((a, i) => {
    a.volume = !muted && bgmPlaying && i === bgmIndex ? BGM_VOL : 0;
  });
}

async function playTrack(index, { restart = false } = {}) {
  if (index < 0 || index >= bgmPool.length) return;
  const next = bgmPool[index];
  if (bgmIndex === index && !restart) {
    applyBgmVolume();
    if (next.paused && bgmPlaying && !muted) {
      try {
        await next.play();
      } catch {
        /* autoplay blocked until gesture */
      }
    }
    return;
  }

  if (bgmIndex >= 0 && bgmIndex !== index) {
    const prev = bgmPool[bgmIndex];
    prev.pause();
    prev.currentTime = 0;
    prev.volume = 0;
  }

  bgmIndex = index;
  if (restart) next.currentTime = 0;
  applyBgmVolume();
  if (!bgmPlaying || muted) return;
  try {
    await next.play();
  } catch {
    /* ignore */
  }
}

/** must be called from a user gesture (browser autoplay policy) */
export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : SFX_MASTER;
  master.connect(ctx.destination);

  bgmPool.forEach((a) => {
    a.load();
  });
}

/** Start (or restart) BGM for a new run at score 0 */
export function startBgm() {
  bgmPlaying = true;
  playTrack(trackForScore(0), { restart: true });
}

/** Keep the correct looping track for the current score */
export function updateBgm(score) {
  if (!bgmPlaying) return;
  playTrack(trackForScore(score));
}

export function pauseBgm() {
  if (bgmIndex >= 0) bgmPool[bgmIndex].pause();
}

export function resumeBgm() {
  if (!bgmPlaying || muted || bgmIndex < 0) return;
  applyBgmVolume();
  bgmPool[bgmIndex].play().catch(() => {});
}

export function stopBgm() {
  bgmPlaying = false;
  bgmPool.forEach((a) => {
    a.pause();
    a.currentTime = 0;
    a.volume = 0;
  });
  bgmIndex = -1;
}

export function toggleMute() {
  muted = !muted;
  localStorage.setItem('gridrun-muted', muted ? '1' : '0');
  if (master) master.gain.value = muted ? 0 : SFX_MASTER;
  applyBgmVolume();
  if (muted) {
    bgmPool.forEach((a) => a.pause());
  } else if (bgmPlaying && bgmIndex >= 0) {
    bgmPool[bgmIndex].play().catch(() => {});
  }
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
