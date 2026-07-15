/* ════════════════════════════════════════════════════════════════
   DEMO BOT — same physics/rules as the player; only the inputs are AI.
   ════════════════════════════════════════════════════════════════ */
import { LANES } from './config.js';
import { active } from './spawner.js';
import { player, moveLane, tryJump, trySlide } from './player.js';

const LOOK_NEAR = -60;
const LOOK_FAR = 10;

function laneOfX(x) {
  let best = 1;
  let bestD = Infinity;
  for (let i = 0; i < LANES.length; i++) {
    const d = Math.abs(LANES[i] - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function overlapsLane(o, lane) {
  return Math.abs(o.x - LANES[lane]) < o.halfW + player.halfW + 0.12;
}

function threatsInLane(lane, zMin, zMax) {
  return active.obstacles.filter(
    (o) =>
      !o.ghost &&
      !o.passed &&
      o.z + o.halfLen > zMin &&
      o.z - o.halfLen < zMax &&
      overlapsLane(o, lane)
  );
}

function soonest(lane) {
  const list = threatsInLane(lane, LOOK_NEAR, LOOK_FAR);
  if (!list.length) return null;
  list.sort((a, b) => b.z - a.z);
  return list[0];
}

function clearSpan(lane, zLo, zHi) {
  return threatsInLane(lane, zLo, zHi).length === 0;
}

function escapeLane(from, threat) {
  const zHi = threat.z + threat.halfLen + 1;
  const zLo = threat.z - threat.halfLen - 8;
  const ranked = [0, 1, 2]
    .filter((l) => l !== from)
    .sort((a, b) => Math.abs(a - from) - Math.abs(b - from));

  for (const l of ranked) {
    if (clearSpan(l, zLo, zHi)) return l;
  }
  // Least-bad lane
  let best = from;
  let bestN = threatsInLane(from, zLo, zHi).length;
  for (const l of [0, 1, 2]) {
    const n = threatsInLane(l, zLo, zHi).length;
    if (n < bestN) {
      bestN = n;
      best = l;
    }
  }
  return best;
}

function nearestSafePickup(fromLane) {
  const picks = [];
  for (const p of active.powerups) {
    if (!p.taken && p.z > LOOK_NEAR && p.z < 2) picks.push({ z: p.z, lane: laneOfX(p.x), pri: 2 });
  }
  for (const c of active.coins) {
    if (!c.taken && c.z > LOOK_NEAR && c.z < 2) picks.push({ z: c.z, lane: laneOfX(c.x), pri: 1 });
  }
  picks.sort((a, b) => b.pri - a.pri || b.z - a.z);

  for (const p of picks) {
    if (p.lane === fromLane) continue;
    if (!clearSpan(p.lane, LOOK_NEAR, -4)) continue;
    if (Math.abs(p.lane - fromLane) === 2 && !clearSpan(1, LOOK_NEAR, -4)) continue;
    return p.lane;
  }
  return null;
}

let coolJump = 0;
let coolSlide = 0;
let coolLane = 0;

export function resetBot() {
  coolJump = coolSlide = coolLane = 0;
}

export function updateBot(dt, runTime, speed = 16) {
  coolJump = Math.max(0, coolJump - dt);
  coolSlide = Math.max(0, coolSlide - dt);
  coolLane = Math.max(0, coolLane - dt);
  if (player.dead) return;

  const lane = player.lane;
  const threat = soonest(lane);
  const lead = Math.max(12, speed * 1.05);

  if (threat && threat.z > -lead) {
    if (threat.type === 'barrier') {
      // Commit jump when the barrier is about one jump-flight away
      if (threat.z > -Math.max(7, speed * 0.48) && coolJump <= 0 && player.grounded && !player.sliding) {
        tryJump();
        coolJump = 0.4;
        return;
      }
    } else if (threat.type === 'overhead') {
      if (threat.z > -Math.max(7, speed * 0.45) && coolSlide <= 0) {
        trySlide();
        coolSlide = 0.6;
        return;
      }
    } else {
      // wall / freight — change lanes ASAP
      if (coolLane <= 0) {
        const safe = escapeLane(lane, threat);
        if (safe !== lane) {
          moveLane(safe - lane, runTime);
          coolLane = 0.18;
          return;
        }
      }
    }
  }

  // Second-pass: if still in danger and can jump/slide as failsafe
  if (threat && threat.z > -5) {
    if (threat.type === 'barrier' && coolJump <= 0 && player.grounded) {
      tryJump();
      coolJump = 0.4;
      return;
    }
    if (threat.type === 'overhead' && coolSlide <= 0) {
      trySlide();
      coolSlide = 0.55;
      return;
    }
  }

  if (threat && threat.z > -16) return;
  if (coolLane > 0 || player.sliding || !player.grounded) return;

  const target = nearestSafePickup(lane);
  if (target != null) {
    moveLane(target - lane, runTime);
    coolLane = 0.25;
  }
}
