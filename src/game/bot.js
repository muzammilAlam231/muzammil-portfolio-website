/* ════════════════════════════════════════════════════════════════
   DEMO BOT — watches upcoming obstacles/coins and steers the runner.
   Used by the walkthrough so visitors can see a clear without playing.
   ════════════════════════════════════════════════════════════════ */
import { LANES } from './config.js';
import { active } from './spawner.js';
import { player, moveLane, tryJump, trySlide } from './player.js';

const LOOK_NEAR = -28;
const LOOK_FAR = 6;

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
      o.z > zMin &&
      o.z < zMax &&
      Math.abs(o.x - x) < o.halfW + 0.55
  );
}

function freeLane(fromLane, zMin, zMax) {
  const order = [fromLane, fromLane - 1, fromLane + 1, 0, 1, 2].filter(
    (l, i, a) => l >= 0 && l <= 2 && a.indexOf(l) === i
  );
  for (const l of order) {
    if (threatsInLane(l, zMin, zMax).length === 0) return l;
  }
  return fromLane;
}

function nearestCoinLane(fromLane) {
  let best = null;
  let bestZ = Infinity;
  for (const c of active.coins) {
    if (c.taken) continue;
    if (c.z < LOOK_NEAR || c.z > 2) continue;
    if (c.z < bestZ) {
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
 */
export function updateBot(dt, runTime) {
  coolJump = Math.max(0, coolJump - dt);
  coolSlide = Math.max(0, coolSlide - dt);
  coolLane = Math.max(0, coolLane - dt);

  if (player.dead) return;

  const lane = player.lane;
  const imminent = threatsInLane(lane, LOOK_NEAR, LOOK_FAR).sort((a, b) => b.z - a.z);
  const closest = imminent[0];

  if (closest && closest.z > -14) {
    if (closest.type === 'barrier' && coolJump <= 0 && player.grounded) {
      tryJump();
      coolJump = 0.55;
      return;
    }
    if (closest.type === 'overhead' && coolSlide <= 0) {
      trySlide();
      coolSlide = 0.7;
      return;
    }
    if ((closest.type === 'wall' || closest.type === 'freight') && coolLane <= 0) {
      const safe = freeLane(lane, LOOK_NEAR, -2);
      if (safe !== lane) {
        moveLane(safe - lane, runTime);
        coolLane = 0.35;
      }
      return;
    }
  }

  // Soft coin chase when the path is clear
  if (coolLane <= 0 && !player.sliding && player.grounded) {
    const coinLane = nearestCoinLane(lane);
    if (coinLane != null && coinLane !== lane) {
      const mid = Math.min(lane, coinLane);
      const blocked = threatsInLane(coinLane, LOOK_NEAR, -4).length > 0;
      if (!blocked) {
        moveLane(coinLane - lane, runTime);
        coolLane = 0.4;
      } else if (mid !== lane && threatsInLane(mid, LOOK_NEAR, -4).length === 0) {
        moveLane(mid - lane, runTime);
        coolLane = 0.35;
      }
    }
  }

  // Grab power-ups in adjacent lanes
  if (coolLane <= 0) {
    for (const p of active.powerups) {
      if (p.taken || p.z < LOOK_NEAR || p.z > 1) continue;
      const pl = laneOfX(p.x);
      if (pl !== lane && threatsInLane(pl, LOOK_NEAR, -3).length === 0) {
        moveLane(pl - lane, runTime);
        coolLane = 0.4;
        break;
      }
    }
  }
}
