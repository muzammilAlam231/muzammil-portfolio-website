/* ════════════════════════════════════════════════════════════════
   NEON ARENA — player fighter
   ════════════════════════════════════════════════════════════════ */
import { PLAYER, GROUND_Y, W } from './config.js';
import { isDown, consume } from './input.js';
import { resolveHit } from './combat.js';
import { sfx } from './audio.js';

export function createPlayer() {
  return {
    x: W * 0.28,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    w: PLAYER.width,
    h: PLAYER.height,
    facing: 1,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    stamina: PLAYER.maxStamina,
    maxStamina: PLAYER.maxStamina,
    state: 'idle', // idle | walk | light | heavy | block | dodge | hurt | dead
    stateT: 0,
    invuln: 0,
    flash: 0,
    hitLanded: false,
    dead: false,
    color: PLAYER.color,
    attack: null,
  };
}

export function resetPlayer(p) {
  Object.assign(p, createPlayer());
}

export function updatePlayer(p, boss, dt) {
  if (p.dead) return null;

  p.flash = Math.max(0, p.flash - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.stamina = Math.min(p.maxStamina, p.stamina + 18 * dt);

  if (p.state === 'hurt') {
    p.stateT -= dt;
    p.x += p.vx * dt;
    p.vx *= 0.9;
    if (p.stateT <= 0) {
      p.state = 'idle';
      p.vx = 0;
    }
    clampPlayer(p);
    faceBoss(p, boss);
    return null;
  }

  const busy = ['light', 'heavy', 'dodge'].includes(p.state);
  if (busy) {
    p.stateT -= dt;
    advanceAttack(p, boss, dt);
    if (p.stateT <= 0) {
      p.state = 'idle';
      p.attack = null;
      p.hitLanded = false;
    }
    p.x += p.vx * dt;
    p.vx *= 0.85;
    clampPlayer(p);
    return null;
  }

  // Block
  if (isDown('block')) {
    p.state = 'block';
    p.vx = 0;
    faceBoss(p, boss);
    clampPlayer(p);
    return null;
  }

  // Dodge
  if (consume('dodge') && p.stamina >= PLAYER.dodgeStamina) {
    p.stamina -= PLAYER.dodgeStamina;
    p.state = 'dodge';
    p.stateT = 0.28;
    p.invuln = 0.28;
    p.vx = p.facing * 420;
    sfx.dodge();
    clampPlayer(p);
    return null;
  }

  // Attacks
  if (consume('light')) {
    startAttack(p, 'light', {
      dmg: PLAYER.lightDmg,
      range: 58,
      windup: 0.08,
      active: 0.1,
      recover: 0.16,
    });
    sfx.light();
    return null;
  }
  if (consume('heavy') && p.stamina >= PLAYER.heavyStamina) {
    p.stamina -= PLAYER.heavyStamina;
    startAttack(p, 'heavy', {
      dmg: PLAYER.heavyDmg,
      range: 72,
      windup: 0.18,
      active: 0.12,
      recover: 0.28,
    });
    sfx.heavy();
    return null;
  }

  // Move
  let mx = 0;
  if (isDown('left')) mx -= 1;
  if (isDown('right')) mx += 1;
  p.vx = mx * PLAYER.speed;
  p.x += p.vx * dt;
  p.state = mx !== 0 ? 'walk' : 'idle';
  if (mx !== 0) p.facing = mx;
  else faceBoss(p, boss);

  clampPlayer(p);
  return null;
}

function startAttack(p, name, atk) {
  p.state = name;
  p.attack = { ...atk, t: 0, phase: 'windup' };
  p.stateT = atk.windup + atk.active + atk.recover;
  p.hitLanded = false;
  p.vx = p.facing * 40;
}

function advanceAttack(p, boss, dt) {
  if (!p.attack || !boss || boss.dead) return;
  const a = p.attack;
  a.t += dt;
  if (a.phase === 'windup' && a.t >= a.windup) {
    a.phase = 'active';
    a.t = 0;
  } else if (a.phase === 'active') {
    if (!p.hitLanded) {
      const res = resolveHit(p, boss, { damage: a.dmg, range: a.range, chip: PLAYER.blockChip });
      if (res.hit) {
        p.hitLanded = true;
        if (res.blocked) sfx.block();
        else sfx.hit();
        if (res.killed) {
          boss.dead = true;
          boss.state = 'dead';
          sfx.ko();
        }
      }
    }
    if (a.t >= a.active) {
      a.phase = 'recover';
      a.t = 0;
    }
  }
}

function faceBoss(p, boss) {
  if (!boss || boss.dead) return;
  p.facing = boss.x >= p.x ? 1 : -1;
}

function clampPlayer(p) {
  p.x = Math.max(p.w / 2 + 20, Math.min(W - p.w / 2 - 20, p.x));
  p.y = GROUND_Y;
}
