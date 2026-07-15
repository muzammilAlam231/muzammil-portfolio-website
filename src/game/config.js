/* ════════════════════════════════════════════════════════════════
   GRID RUN — every tuning knob in one place.
   Change difficulty, feel and pacing here without touching logic.
   ════════════════════════════════════════════════════════════════ */

export const LANES = [-2.2, 0, 2.2]; // lane center x positions

export const RUN = {
  baseSpeed: 14,        // world units/sec at run start
  maxSpeed: 32,         // hard cap
  accelPerMeter: 0.011, // speed gained per meter travelled
  attractSpeed: 6,      // idle scroll speed on the start screen
};

export const PLAYER = {
  x: 0,
  z: 0,                // player stays at z=0; the world flows past
  laneSnap: 14,        // higher = snappier lane changes
  jumpVel: 13.2,
  gravity: -36,
  fastFall: -30,       // extra downward kick when pressing down mid-air
  slideTime: 0.62,     // seconds
  standH: 1.65,        // collider heights
  slideH: 0.55,
  halfW: 0.45,
  halfZ: 0.38,
  jumpBuffer: 0.12,    // seconds a jump press is remembered before landing
};

export const SPAWN = {
  horizon: -170,        // obstacles materialise this far ahead
  killZ: 12,            // ...and recycle once this far behind
  gapEasy: 30,          // meters between patterns at the start...
  gapHard: 13,          // ...shrinking to this at max difficulty
  tierEvery: 240,       // meters per difficulty tier (0..5)
  coinValue: 25,
  powerupEvery: [170, 260], // min/max meters between power-up spawns
};

export const POWERUPS = {
  magnet: { time: 8, color: '#37e6ff', label: 'MAGNET', radius: 5.5, pull: 26 },
  shield: { time: 7, color: '#ffffff', label: 'SHIELD' },
  multi:  { time: 10, color: '#ffb03a', label: '×2 SCORE' },
};

export const COMBO = {
  decay: 3.5,        // seconds until the combo resets
  maxSteps: 10,      // combo steps counted toward the multiplier
  stepBonus: 0.1,    // each step adds +0.1× (so up to 2.0×)
  nearMissWindow: 0.45, // lane change within this window before a pass = near miss
};

/* Zones recolor the world — first four cycle by distance, then CORE locks in */
export const ZONES = [
  { name: 'LIME SECTOR', color: '#b8ff3c' },
  { name: 'CYAN SECTOR', color: '#37e6ff' },
  { name: 'MAGENTA SECTOR', color: '#ff3ec8' },
  { name: 'AMBER SECTOR', color: '#ffb03a' },
  { name: 'CORE SECTOR', color: '#e9e9ec', final: true },
];
export const ZONE_LENGTH = 420; // meters per sector before CORE
/** After this many meters the run locks into CORE SECTOR (final) */
export const FINAL_AT = ZONE_LENGTH * 4; // past Lime→Cyan→Magenta→Amber

/** Clear CORE with enough score + data bits to win the run */
export const WIN = {
  score: 40000,
  coins: 75,
};

/** Watchable bot walkthrough — faster scoring so a clear finishes in a few minutes */
export const DEMO = {
  speedMult: 2.15,
  scoreMult: 9,
  magnetBoost: true,
};

export const COLORS = {
  bg: 0x050508,
  danger: 0xff5148,
  dangerDim: 0x64211e,
  steel: 0x16161c,
  steelLight: 0x22222b,
  white: 0xe9e9ec,
  coin: '#ffd948',      // fixed gold — never follows zone accent
  coinRing: '#fff4c8',
};

/* Low-power heuristic — mirrors the portfolio's */
export const LOW =
  matchMedia('(pointer: coarse)').matches ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  (navigator.deviceMemory || 8) <= 4;

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
