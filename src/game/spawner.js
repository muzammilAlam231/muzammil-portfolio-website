/* ════════════════════════════════════════════════════════════════
   SPAWNER — obstacle/coin/power-up pools + the difficulty director.

   HOW SPAWNING WORKS (tune here):
   - `aheadZ` marks the furthest point of spawned track (negative z).
     Every frame it drifts toward the player with the world; while it
     is nearer than SPAWN.horizon, the director places the next
     PATTERN at it and pushes it back out.
   - A pattern is a hand-authored template (walls/barriers/overheads/
     freights + a coin layout). Templates declare a minimum difficulty
     tier; tier = floor(distance / SPAWN.tierEvery), capped at 5.
   - The gap between patterns shrinks from gapEasy → gapHard with tier.
   - Everything is pooled: meshes are created once and recycled, so
     there is zero allocation (and zero GC hitching) during play.

   ⚠ MODEL SWAP POINT: the build*() functions make low-poly stand-ins
   from primitives — swap their bodies for GLTF models, keep the
   data (halfW / halfLen / y0 / y1) identical.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LANES, SPAWN, POWERUPS, LOW, COLORS } from './config.js';
import { mats } from './world.js';
import { holoMat, neonMat, glowTexture } from './materials.js';

export const active = {
  obstacles: [],
  coins: [],
  powerups: [],
};

let scene;
let aheadZ = -40;
let nextPowerAt = 140;
const pools = { wall: [], barrier: [], overhead: [], freight: [], coin: [], powerup: {} };

/* ────────────────────────────────────────────────────────────
   MESH BUILDERS (low-poly placeholders)
   ──────────────────────────────────────────────────────────── */
function buildWall() {
  const g = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.86, 2.3, 0.12), mats.dangerField);
  panel.position.y = 1.25;
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), mats.holo);
  holo.position.set(0, 1.25, 0.08);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.08, 0.2), mats.danger);
  const frameT = frame.clone(); frameT.position.y = 2.42;
  const frameB = frame.clone(); frameB.position.y = 0.08;
  const postL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 0.2), mats.danger);
  postL.position.set(-0.95, 1.25, 0);
  const postR = postL.clone(); postR.position.x = 0.95;
  const warn = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.04, 6, 16), mats.dangerGlow);
  warn.rotation.x = Math.PI / 2;
  warn.position.set(0, 2.1, 0.15);
  g.add(panel, holo, frameT, frameB, postL, postR, warn);
  return g;
}

function buildBarrier() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.82, 0.34), mats.steelLight);
  body.position.y = 0.5;
  const holoTop = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.06, 0.36), mats.holo);
  holoTop.position.y = 0.96;
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), mats.dangerField);
  stripe.position.set(0, 0.55, 0.2);
  const feetGeo = new THREE.BoxGeometry(0.1, 0.12, 0.28);
  const f1 = new THREE.Mesh(feetGeo, mats.steel); f1.position.set(-0.7, 0.06, 0);
  const f2 = f1.clone(); f2.position.x = 0.7;
  g.add(body, holoTop, stripe, f1, f2);
  return g;
}

function buildOverhead() {
  const g = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.5), mats.steelLight);
  bar.position.y = 1.28;
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 0.54), mats.danger);
  glow.position.y = 0.98;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 0.45), mats.dangerField);
  field.position.set(0, 1.05, 0.28);
  const postGeo = new THREE.BoxGeometry(0.08, 1.6, 0.08);
  const pL = new THREE.Mesh(postGeo, mats.neonFaint); pL.position.set(-0.92, 0.8, 0);
  const pR = pL.clone(); pR.position.x = 0.92;
  g.add(bar, glow, field, pL, pR);
  return g;
}

function buildFreight() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.1, 1), mats.steel);
  body.position.y = 1.15;
  const holoSide = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.8), mats.holo);
  holoSide.position.set(0, 1.15, 0.52);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 1), mats.neonFaint);
  trim.position.y = 2.24;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.1), mats.danger);
  const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), mats.dangerGlow);
  g.add(body, holoSide, trim, nose, beacon);
  g.userData.stretch = [body, trim, holoSide];
  g.userData.front = [nose, beacon];
  return g;
}

function buildCoin() {
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: COLORS.coin,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
    })
  );
  halo.scale.set(1.85, 1.85, 1);
  halo.renderOrder = 1;

  const outer = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.065, 8, 22), mats.coinRing);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), mats.coinCore);
  core.renderOrder = 2;
  const g = new THREE.Group();
  g.add(halo, outer, core);
  return g;
}

function buildPowerup(kind) {
  const color = POWERUPS[kind].color;
  const mat = neonMat(color, 0.95);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.set(2.2, 2.2, 1);
  let mesh;
  if (kind === 'magnet') mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.32, 0.08, 48, 8), mat);
  else if (kind === 'shield') mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), mat);
  else mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), mat);
  const g = new THREE.Group();
  g.add(mesh, halo);
  return g;
}

/* ────────────────────────────────────────────────────────────
   POOL PLUMBING
   ──────────────────────────────────────────────────────────── */
const BUILDERS = { wall: buildWall, barrier: buildBarrier, overhead: buildOverhead, freight: buildFreight };

function getObstacle(type) {
  let o = pools[type].find((e) => !e.active);
  if (!o) {
    o = { mesh: BUILDERS[type](), type };
    pools[type].push(o);
    scene.add(o.mesh);
  }
  o.active = true;
  o.passed = false;
  o.ghost = false;
  o.speedF = 1;
  o.mesh.visible = true;
  active.obstacles.push(o);
  return o;
}

function getCoin() {
  let c = pools.coin.find((e) => !e.active);
  if (!c) {
    c = { mesh: buildCoin() };
    pools.coin.push(c);
    scene.add(c.mesh);
  }
  c.active = true;
  c.taken = false;
  c.mesh.visible = true;
  active.coins.push(c);
  return c;
}

function release(entry, list) {
  entry.active = false;
  entry.mesh.visible = false;
  const i = list.indexOf(entry);
  if (i >= 0) list.splice(i, 1);
}

/* ────────────────────────────────────────────────────────────
   PLACEMENT HELPERS — all coords: lane 0..2, z negative = ahead
   ──────────────────────────────────────────────────────────── */
function wall(lane, z) {
  const o = getObstacle('wall');
  Object.assign(o, { x: LANES[lane], z, halfW: 0.95, halfLen: 0.15, y0: 0, y1: 2.4 });
  o.mesh.position.set(o.x, 0, z);
}
function barrier(lane, z) {
  const o = getObstacle('barrier');
  Object.assign(o, { x: LANES[lane], z, halfW: 0.95, halfLen: 0.2, y0: 0, y1: 1.0 });
  o.mesh.position.set(o.x, 0, z);
}
function overhead(lane, z) {
  const o = getObstacle('overhead');
  Object.assign(o, { x: LANES[lane], z, halfW: 0.95, halfLen: 0.28, y0: 0.98, y1: 1.62 });
  o.mesh.position.set(o.x, 0, z);
}
function freight(lane, z, len, slow = false) {
  const o = getObstacle('freight');
  Object.assign(o, { x: LANES[lane], z: z - len / 2, halfW: 0.95, halfLen: len / 2, y0: 0, y1: 2.2 });
  o.speedF = slow ? 0.72 : 1; // slow freights recede slower = longer threat
  o.mesh.position.set(o.x, 0, o.z);
  o.mesh.userData.stretch.forEach((m) => (m.scale.z = len));
  const [nose, beacon] = o.mesh.userData.front;
  nose.position.set(0, 0.35, len / 2);
  beacon.position.set(0, 2.36, len / 2 - 0.5);
  return len;
}

function coinLine(lane, z, n = 6, spacing = 1.7, y = 0.85) {
  for (let i = 0; i < n; i++) {
    const c = getCoin();
    Object.assign(c, { x: LANES[lane], y, z: z - i * spacing, spin: Math.random() * 6 });
    c.mesh.position.set(c.x, c.y, c.z);
  }
  return n * spacing;
}
/** parabola of coins matching a jump over `z` (e.g. above a barrier) */
function coinArc(lane, z, n = 7) {
  const span = 8.4;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const c = getCoin();
    Object.assign(c, {
      x: LANES[lane],
      y: 0.55 + Math.sin(t * Math.PI) * 1.75,
      z: z + span / 2 - t * span,
      spin: Math.random() * 6,
    });
    c.mesh.position.set(c.x, c.y, c.z);
  }
}
/** coins snaking across all three lanes — rewards confident weaving */
function coinZigzag(z, segs = 3) {
  let lane = (Math.random() * 3) | 0;
  let zz = z;
  for (let s = 0; s < segs; s++) {
    coinLine(lane, zz, 4, 1.6);
    zz -= 4 * 1.6 + 2;
    lane = lane === 0 ? 1 : lane === 2 ? 1 : Math.random() < 0.5 ? 0 : 2;
  }
  return z - zz;
}

const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const lanesShuffled = () => [0, 1, 2].sort(() => Math.random() - 0.5);

/* ────────────────────────────────────────────────────────────
   PATTERN TEMPLATES — { minTier, len, place(z) }
   Add / reorder these to reshape the whole game's pacing.
   ──────────────────────────────────────────────────────────── */
const TEMPLATES = [
  {
    minTier: 0, len: 12,
    place(z) { // one firewall + coins in a safe lane
      const [a, b] = lanesShuffled();
      wall(a, z);
      coinLine(b, z + 3, 6);
    },
  },
  {
    minTier: 0, len: 14,
    place(z) { // barrier with a matching coin arc — teaches jumping
      const [a, b] = lanesShuffled();
      barrier(a, z);
      coinArc(a, z);
      if (Math.random() < 0.5) barrier(b, z - 6);
    },
  },
  {
    minTier: 1, len: 12,
    place(z) { // double firewall — one lane through
      const [a, b, c] = lanesShuffled();
      wall(a, z);
      wall(b, z);
      coinLine(c, z + 3, 7);
    },
  },
  {
    minTier: 1, len: 14,
    place(z) { // overhead pair — slide! coins tucked low underneath
      const [a, b] = lanesShuffled();
      overhead(a, z);
      overhead(b, z - 1);
      coinLine(a, z + 1.5, 5, 1.5, 0.35);
    },
  },
  {
    minTier: 1, len: 22,
    place(z) { // data freight blocking a lane
      const [a, b] = lanesShuffled();
      const len = 10 + Math.random() * 6;
      freight(a, z, len);
      coinLine(b, z - 1, 8, 1.8);
    },
  },
  {
    minTier: 2, len: 26,
    place(z) { // zigzag walls — forced weaving
      const order = lanesShuffled();
      wall(order[0], z);
      wall(order[1], z - 8);
      wall(order[2], z - 16);
      coinZigzag(z - 2);
    },
  },
  {
    minTier: 2, len: 16,
    place(z) { // full barrier row — jump or die (arc marks the sweet spot)
      barrier(0, z); barrier(1, z); barrier(2, z);
      coinArc(1, z);
      overhead(pick([0, 2]), z - 7);
    },
  },
  {
    minTier: 3, len: 30,
    place(z) { // twin freights, one slow — thread the moving needle
      const [a, b, c] = lanesShuffled();
      freight(a, z, 12);
      freight(b, z - 6, 12, true);
      coinLine(c, z - 2, 10, 1.9);
    },
  },
  {
    minTier: 3, len: 24,
    place(z) { // slalom: jump, slide, jump in one lane
      const lane = (Math.random() * 3) | 0;
      barrier(lane, z);
      overhead(lane, z - 7);
      barrier(lane, z - 14);
      coinArc(lane, z);
      const free = [0, 1, 2].filter((l) => l !== lane);
      wall(pick(free), z - 7);
    },
  },
  {
    minTier: 4, len: 30,
    place(z) { // the gauntlet
      const [a, b, c] = lanesShuffled();
      wall(a, z);
      overhead(b, z - 1);
      barrier(c, z - 2);
      freight(a, z - 9, 10);
      wall(b, z - 12);
      coinZigzag(z - 3);
      coinArc(c, z - 2);
    },
  },
];

/* ────────────────────────────────────────────────────────────
   DIRECTOR
   ──────────────────────────────────────────────────────────── */
export function initSpawner(s) {
  scene = s;
}

export function resetSpawner() {
  [...active.obstacles].forEach((o) => release(o, active.obstacles));
  [...active.coins].forEach((c) => release(c, active.coins));
  [...active.powerups].forEach((p) => release(p, active.powerups));
  aheadZ = -40; // breathing room before the first pattern
  nextPowerAt = 140;
}

function spawnPowerup(z) {
  const kinds = Object.keys(POWERUPS);
  const kind = pick(kinds);
  if (!pools.powerup[kind]) {
    pools.powerup[kind] = { mesh: buildPowerup(kind), kind };
    scene.add(pools.powerup[kind].mesh);
  }
  const p = pools.powerup[kind];
  if (p.active) return; // one of each kind at a time
  p.active = true;
  p.taken = false;
  Object.assign(p, { x: LANES[(Math.random() * 3) | 0], y: 1.15, z });
  p.mesh.visible = true;
  p.mesh.position.set(p.x, p.y, p.z);
  active.powerups.push(p);
}

export function updateSpawner(dz, dt, distance, tier, player, magnetOn) {
  /* 1 · advance + recycle everything (reverse loops: splice-safe, no allocs) */
  for (let i = active.obstacles.length - 1; i >= 0; i--) {
    const o = active.obstacles[i];
    o.z += dz * o.speedF;
    o.mesh.position.z = o.z;
    if (o.z - o.halfLen > SPAWN.killZ) release(o, active.obstacles);
  }
  for (let i = active.coins.length - 1; i >= 0; i--) {
    const c = active.coins[i];
    c.z += dz;
    c.spin += dt * 5;
    if (magnetOn && !c.taken) {
      // magnet: coins within radius get reeled in
      const dx = player.x - c.x, dy = player.y + 0.9 - c.y, dzz = 0 - c.z;
      const d = Math.hypot(dx, dy, dzz);
      if (d < POWERUPS.magnet.radius) {
        const pull = (POWERUPS.magnet.pull * dt) / Math.max(d, 0.001);
        c.x += dx * pull;
        c.y += dy * pull;
        c.z += dzz * pull;
      }
    }
    c.mesh.position.set(c.x, c.y + Math.sin(c.spin) * 0.1, c.z);
    c.mesh.rotation.y = c.spin;
    c.mesh.rotation.x = Math.sin(c.spin * 0.7) * 0.35;
    if (c.z > SPAWN.killZ) release(c, active.coins);
  }
  for (let i = active.powerups.length - 1; i >= 0; i--) {
    const p = active.powerups[i];
    p.z += dz;
    p.mesh.position.set(p.x, p.y + Math.sin(distance * 0.5 + 2) * 0.12, p.z);
    p.mesh.rotation.y += dt * 2.4;
    p.mesh.rotation.x += dt * 0.8;
    if (p.z > SPAWN.killZ) release(p, active.powerups);
  }

  /* 2 · keep the horizon stocked */
  aheadZ += dz;
  while (aheadZ > SPAWN.horizon) {
    const usable = TEMPLATES.filter((t) => t.minTier <= tier);
    const tpl = pick(usable);
    tpl.place(aheadZ);
    const gap = SPAWN.gapEasy + (SPAWN.gapHard - SPAWN.gapEasy) * (tier / 5) + Math.random() * 6;
    /* power-up cadence rides the same cursor */
    if (distance > nextPowerAt) {
      nextPowerAt = distance + SPAWN.powerupEvery[0] + Math.random() * (SPAWN.powerupEvery[1] - SPAWN.powerupEvery[0]);
      spawnPowerup(aheadZ + gap * 0.5);
    }
    aheadZ -= tpl.len + gap;
  }
}

export function releaseCoin(c) {
  release(c, active.coins);
}
export function releasePowerup(p) {
  release(p, active.powerups);
}
