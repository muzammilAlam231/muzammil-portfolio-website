/* ════════════════════════════════════════════════════════════════
   DEMO BOT — looks ahead, dodges early, chases coins when safe.
   Walkthrough also keeps a permanent shield so a clear always finishes.
   ════════════════════════════════════════════════════════════════ */
import { LANES } from './config.js';
import { active } from './spawner.js';
import { player, moveLane, tryJump, trySlide } from './player.js';

const LOOK_NEAR = -55;
const LOOK_FAR = 8;

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

function threatsInLane(lane, zMin, zMax) {
  const x = LANES[lane];
  return active.obstacles.filter(
    (o) =>
      !o.ghost &&
      !o.passed &&
      o.z + o.halfLen > zMin &&
      o.z - o.halfLen < zMax &&
      Math.abs(o.x - x) < o.halfW + player.halfW + 0.15
  );
}

function soonestThreat(lane, zMin, zMax) {
  const list = threatsInLane(lane, zMin, zMax);
  if (!list.length) return null;
  list.sort((a, b) => b.z - a.z); // closest to player first (highest z toward 0)
  return list[0];
}

function laneClearUntil(lane, zCutoff) {
  return threatsInLane(lane, LOOK_NEAR, zCutoff).length === 0;
}

function bestEscape(fromLane, threatZ) {
  const lookTo = Math.min(-1, threatZ + 2);
  const candidates = [0, 1, 2]
    .filter((l) => l !== fromLane)
    .sort((a, b) => Math.abs(a - fromLane) - Math.abs(b - fromLane));

  for (const l of candidates) {
    if (laneClearUntil(l, lookTo)) return l;
  }
  // Prefer any lane with fewer threats
  let best = fromLane;
  let bestN = threatsInLane(fromLane, LOOK_NEAR, lookTo).length;
  for (const l of [0, 1, 2]) {
    const n = threatsInLane(l, LOOK_NEAR, lookTo).length;
    if (n < bestN) {
      bestN = n;
      best = l;
    }
  }
  return best;
}

function nearestPickupLane(kind) {
  const list = kind === 'coin' ? active.coins : active.powerups;
  let best = null;
  let bestZ = -Infinity;
  for (const c of list) {
    if (c.taken) continue;
    if (c.z < LOOK_NEAR || c.z > 1.5) continue;
    if (c.z > bestZ) {
      bestZ = c.z;
      best = c;
    }
  }
  if (!best) return null;
  return laneOfX(best.x);
}

let coolJump = 0;
let coolSlide = 0;
let coolLane = 0;

export function resetBot() {
  coolJump = coolSlide = coolLane = 0;
}

/**
 * @param {number} dt
 * @param {number} runTime
 * @param {number} speed world speed (for earlier reactions when fast)
 */
export function updateBot(dt, runTime, speed = 16) {
  coolJump = Math.max(0, coolJump - dt);
  coolSlide = Math.max(0, coolSlide - dt);
  coolLane = Math.max(0, coolLane - dt);

  if (player.dead) return;

  const lane = player.lane;
  // React farther out when moving faster (seconds of lead time)
  const lead = Math.max(10, speed * 0.85);
  const reactZ = -lead;
  const threat = soonestThreat(lane, LOOK_NEAR, LOOK_FAR);

  if (threat && threat.z > reactZ) {
    if (threat.type === 'barrier') {
      // Jump early enough to clear the top
      if (threat.z > -speed * 0.55 && coolJump <= 0 && player.grounded && !player.sliding) {
        tryJump();
        coolJump = 0.45;
        return;
      }
    } else if (threat.type === 'overhead') {
      if (threat.z > -speed * 0.5 && coolSlide <= 0 && !player.sliding) {
        trySlide();
        coolSlide = 0.65;
        return;
      }
    } else if (threat.type === 'wall' || threat.type === 'freight') {
      if (coolLane <= 0) {
        const safe = bestEscape(lane, threat.z);
        if (safe !== lane) {
          moveLane(safe - lane, runTime);
          coolLane = 0.22;
          return;
        }
      }
    }
  }

  // Don't chase pickups while a threat is close
  if (threat && threat.z > -18) return;

  if (coolLane > 0 || player.sliding || !player.grounded) return;

  // Power-ups first, then coins — only into clear lanes
  for (const kind of ['power', 'coin']) {
    const target = nearestPickupLane(kind === 'power' ? 'power' : 'coin');
    if (target == null || target === lane) continue;
    if (!laneClearUntil(target, -6)) continue;
    // Stepping through middle lane must also be clear for 2-lane hops
    if (Math.abs(target - lane) === 2 && !laneClearUntil(1, -6)) continue;
    moveLane(target - lane, runTime);
    coolLane = 0.28;
    return;
  }
}
