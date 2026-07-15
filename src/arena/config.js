/* ════════════════════════════════════════════════════════════════
   NEON ARENA — tunables
   ════════════════════════════════════════════════════════════════ */

export const W = 960;
export const H = 540;
export const GROUND_Y = 420;
export const GRAVITY = 2200;

export const PLAYER = {
  maxHp: 100,
  maxStamina: 100,
  speed: 280,
  width: 42,
  height: 96,
  lightDmg: 8,
  heavyDmg: 16,
  lightStamina: 0,
  heavyStamina: 28,
  dodgeStamina: 22,
  blockChip: 0.25,
  color: '#b8ff3c',
};

export const BOSSES = [
  {
    id: 'pulse',
    name: 'PULSE',
    maxHp: 120,
    width: 56,
    height: 110,
    speed: 90,
    color: '#5b8cff',
    aggression: 1.1,
    attacks: {
      punch: { dmg: 10, range: 0.55, active: 0.16, recover: 0.45, range: 70, telegraph: 0.35 },
      slam: { dmg: 18, range: 0.7, active: 0.2, recover: 0.7, range: 110, telegraph: 0.55 },
    },
  },
  {
    id: 'razor',
    name: 'RAZOR',
    maxHp: 100,
    width: 40,
    height: 92,
    speed: 200,
    color: '#ff5b8c',
    aggression: 1.45,
    attacks: {
      dash: { dmg: 12, range: 0.25, active: 0.18, recover: 0.35, range: 140, telegraph: 0.28, dash: 320 },
      flurry: { dmg: 6, range: 0.2, active: 0.4, recover: 0.4, range: 60, telegraph: 0.25, hits: 3 },
    },
  },
  {
    id: 'titan',
    name: 'TITAN',
    maxHp: 180,
    width: 72,
    height: 130,
    speed: 70,
    color: '#ffb03a',
    aggression: 1.0,
    attacks: {
      shockwave: { dmg: 14, range: 0.5, active: 0.25, recover: 0.8, range: 200, telegraph: 0.65 },
      grab: { dmg: 22, range: 0.4, active: 0.2, recover: 0.7, range: 80, telegraph: 0.5 },
    },
  },
];
