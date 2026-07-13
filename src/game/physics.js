/* ════════════════════════════════════════════════════════════════
   PHYSICS — exact lane-domain collision, no engine needed.

   Why no cannon-es/Rapier: a lane runner's collisions are axis-
   aligned intervals (x overlap · z overlap · y overlap). Solving
   them directly is exact, branch-cheap, allocation-free and
   perfectly deterministic — a rigid-body engine would only add
   bundle weight and GC pressure between us and 60fps.

   Also detects NEAR MISSES: an obstacle that passes the player
   without collision counts as a close call if the player dodged
   into/out of its lane moments earlier, jumped it with little
   clearance, or slid under it — these feed the combo system.
   ════════════════════════════════════════════════════════════════ */
import { COMBO } from './config.js';
import { active, releaseCoin, releasePowerup } from './spawner.js';

/**
 * Run all overlap tests for this frame.
 * `events`: { onHit(o), onCoin(c), onPower(p), onNearMiss(o) }
 */
export function checkCollisions(player, runTime, events) {
  const px = player.x;
  const py0 = player.y;
  const py1 = player.y + player.height;

  /* ── obstacles ── */
  for (const o of active.obstacles) {
    const zNear = o.z + o.halfLen; // edge closest to the player (z grows toward +)
    const zFar = o.z - o.halfLen;

    // passed the player without touching → near-miss candidate
    if (!o.passed && zFar > player.halfZ) {
      o.passed = true;
      if (!o.ghost && Math.abs(o.x - px) < 2.3) {
        const dodged = runTime - player.laneChangedAt < COMBO.nearMissWindow;
        const jumpedClose = o.type === 'barrier' && py0 > 0 && py0 < o.y1 + 0.5;
        const slidUnder = o.type === 'overhead' && player.sliding;
        if (dodged || jumpedClose || slidUnder) events.onNearMiss(o);
      }
      continue;
    }

    if (o.ghost) continue;
    // z interval overlap with the player's slab at z≈0
    if (zNear < -player.halfZ || zFar > player.halfZ) continue;
    // x interval overlap
    if (Math.abs(o.x - px) >= o.halfW + player.halfW) continue;
    // y interval overlap (with a small grace margin so clean jumps
    // over barriers / slides under bars never clip on edge pixels)
    if (py1 <= o.y0 + 0.04 || py0 >= o.y1 - 0.04) continue;

    events.onHit(o);
    return; // one hit is enough for this frame
  }

  /* ── coins ── */
  for (let i = active.coins.length - 1; i >= 0; i--) {
    const c = active.coins[i];
    if (c.taken) continue;
    if (Math.abs(c.z) > 0.9) continue;
    if (Math.abs(c.x - px) > 0.95) continue;
    if (Math.abs(c.y - (py0 + 0.9)) > 1.25) continue;
    c.taken = true;
    events.onCoin(c);
    releaseCoin(c);
  }

  /* ── power-ups ── */
  for (let i = active.powerups.length - 1; i >= 0; i--) {
    const p = active.powerups[i];
    if (p.taken) continue;
    if (Math.abs(p.z) > 1.0) continue;
    if (Math.abs(p.x - px) > 1.05) continue;
    p.taken = true;
    events.onPower(p);
    releasePowerup(p);
  }
}
