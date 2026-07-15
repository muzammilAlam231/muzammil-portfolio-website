/* ════════════════════════════════════════════════════════════════
   DEMO BOT — fair play, strong dodging + active coin hunting.
   Same rules/speed as the player; only the inputs are automated.
   ════════════════════════════════════════════════════════════════ */
import { LANES } from './config.js';
import { active } from './spawner.js';
import { player, moveLane, tryJump, trySlide } from './player.js';

function overlapsLane(o, lane) {
  return Math.abs(o.x - LANES[lane]) < o.halfW + player.halfW + 0.05;
}

function laneOfX(x) {
  let best = 1;
  let dBest = Infinity;
  for (let i = 0; i < 3; i++) {
    const d = Math.abs(LANES[i] - x);
    if (d < dBest) {
      dBest = d;
      best = i;
    }
  }
  return best;
}

/** Obstacles still ahead that occupy this lane (z increases toward the player). */
function laneThreats(lane) {
  return active.obstacles.filter(
    (o) => !o.ghost && !o.passed && o.z < 4 && o.z > -70 && overlapsLane(o, lane)
  );
}

function soonestThreat(lane) {
  const t = laneThreats(lane);
  if (!t.length) return null;
  t.sort((a, b) => b.z - a.z);
  return t[0];
}

/** Rough seconds until the front of the obstacle reaches the player */
function eta(o, speed) {
  const front = o.z + o.halfLen;
  return -front / Math.max(8, speed);
}

function canOccupy(lane, untilZ) {
  return !laneThreats(lane).some((o) => o.z + o.halfLen > untilZ - 1.5 && o.z - o.halfLen < 2);
}

function stepToward(target, runTime) {
  if (target === player.lane) return false;
  moveLane(target > player.lane ? 1 : -1, runTime);
  return true;
}

function coinScore(lane, speed) {
  let score = 0;
  for (const c of active.coins) {
    if (c.taken || c.z > 1.2 || c.z < -45) continue;
    if (laneOfX(c.x) !== lane) continue;
    // Prefer nearer coins; bonus for jump-height coins if we're about to jump
    const near = 1 - Math.min(1, -c.z / 40);
    score += 2.2 * near;
    if (c.y > 1.2) score += 0.6 * near;
  }
  for (const p of active.powerups) {
    if (p.taken || p.z > 1.2 || p.z < -45) continue;
    if (laneOfX(p.x) !== lane) continue;
    const near = 1 - Math.min(1, -p.z / 40);
    score += (p.kind === 'magnet' ? 8 : p.kind === 'shield' ? 6 : 4) * near;
  }
  // Penalize upcoming hard blocks
  const th = soonestThreat(lane);
  if (th) {
    const t = eta(th, speed);
    if (t < 1.6) {
      if (th.type === 'wall' || th.type === 'freight') score -= 20;
      else score -= 6;
    } else if (t < 2.8) score -= 3;
  }
  return score;
}

let coolJump = 0;
let coolSlide = 0;
let coolLane = 0;
let preferLane = 1;

export function resetBot() {
  coolJump = coolSlide = coolLane = 0;
  preferLane = 1;
}

export function updateBot(dt, runTime, speed = 16) {
  coolJump = Math.max(0, coolJump - dt);
  coolSlide = Math.max(0, coolSlide - dt);
  coolLane = Math.max(0, coolLane - dt);
  if (player.dead) return;

  const lane = player.lane;
  const threat = soonestThreat(lane);
  const tHit = threat ? eta(threat, speed) : 99;

  /* ── 1. Survive ── */
  if (threat && tHit < 2.4) {
    if (threat.type === 'barrier') {
      // Jump in a window that clears the barrier and snags arc coins
      if (tHit < 1.15 && tHit > 0.12 && coolJump <= 0 && player.grounded && !player.sliding) {
        tryJump();
        coolJump = 0.35;
        return;
      }
      // Too late / busy — try adjacent lane
      if (tHit < 0.55 && coolLane <= 0) {
        for (const l of [lane - 1, lane + 1, lane - 2, lane + 2]) {
          if (l < 0 || l > 2) continue;
          if (canOccupy(l, threat.z - 2)) {
            preferLane = l;
            if (stepToward(l, runTime)) coolLane = 0.12;
            return;
          }
        }
      }
    } else if (threat.type === 'overhead') {
      if (tHit < 1.05 && tHit > 0.08 && coolSlide <= 0) {
        trySlide();
        coolSlide = 0.55;
        return;
      }
      if (tHit < 0.5 && coolLane <= 0) {
        for (const l of [lane - 1, lane + 1]) {
          if (l < 0 || l > 2) continue;
          if (canOccupy(l, threat.z - 2)) {
            preferLane = l;
            if (stepToward(l, runTime)) coolLane = 0.12;
            return;
          }
        }
      }
    } else {
      // wall / freight — must leave lane early
      if (coolLane <= 0 && tHit < 2.2) {
        let best = -1;
        let bestScore = -1e9;
        for (const l of [0, 1, 2]) {
          if (l === lane) continue;
          if (!canOccupy(l, threat.z - threat.halfLen - 2)) continue;
          const s = coinScore(l, speed) + (Math.abs(l - lane) === 1 ? 1 : 0);
          if (s > bestScore) {
            bestScore = s;
            best = l;
          }
        }
        if (best < 0) {
          // Force any other lane
          best = lane === 1 ? 0 : 1;
        }
        preferLane = best;
        if (stepToward(best, runTime)) coolLane = 0.1;
        return;
      }
    }
  }

  // Emergency slide/jump if something is basically on top of us
  if (threat && tHit < 0.35) {
    if (threat.type === 'overhead' && coolSlide <= 0) {
      trySlide();
      coolSlide = 0.5;
      return;
    }
    if (threat.type === 'barrier' && coolJump <= 0 && player.grounded) {
      tryJump();
      coolJump = 0.3;
      return;
    }
  }

  /* ── 2. Finish moving toward preferred escape / hunt lane ── */
  if (preferLane !== lane && coolLane <= 0) {
    // Don't step into an instant wall
    const next = preferLane > lane ? lane + 1 : lane - 1;
    const block = soonestThreat(next);
    if (!block || eta(block, speed) > 1.1 || block.type === 'barrier' || block.type === 'overhead') {
      if (stepToward(preferLane, runTime)) {
        coolLane = 0.1;
        return;
      }
    } else {
      preferLane = lane;
    }
  }

  /* ── 3. Hunt coins / power-ups ── */
  if (coolLane > 0 || player.sliding) return;
  // Don't wander while a hard threat is mid-range
  if (threat && (threat.type === 'wall' || threat.type === 'freight') && tHit < 2.8) return;

  let bestLane = lane;
  let best = coinScore(lane, speed);
  for (const l of [0, 1, 2]) {
    if (l === lane) continue;
    // Path must not require walking through an imminent wall
    const midThreat = soonestThreat(l);
    if (midThreat && (midThreat.type === 'wall' || midThreat.type === 'freight') && eta(midThreat, speed) < 1.3) {
      continue;
    }
    const s = coinScore(l, speed);
    if (s > best + 0.4) {
      best = s;
      bestLane = l;
    }
  }

  if (bestLane !== lane) {
    preferLane = bestLane;
    if (stepToward(bestLane, runTime)) coolLane = 0.1;
  }
}
