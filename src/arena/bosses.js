/* ════════════════════════════════════════════════════════════════
   NEON ARENA — boss AI (Pulse / Razor / Titan)
   ════════════════════════════════════════════════════════════════ */
import { BOSSES, GROUND_Y, W } from './config.js';
import { resolveHit } from './combat.js';
import { sfx } from './audio.js';

export function createBoss(index) {
  const def = BOSSES[index];
  return {
    index,
    def,
    name: def.name,
    x: W * 0.72,
    y: GROUND_Y,
    vx: 0,
    w: def.width,
    h: def.height,
    facing: -1,
    hp: def.maxHp,
    maxHp: def.maxHp,
    state: 'idle', // idle | walk | telegraph | attack | recover | hurt | dead
    stateT: 0,
    invuln: 0,
    flash: 0,
    dead: false,
    color: def.color,
    thinkT: 0.6,
    attackKey: null,
    attack: null,
    hitLanded: false,
    hitCount: 0,
    telegraphFlash: 0,
  };
}

export function updateBoss(b, player, dt) {
  if (!b || b.dead) return;

  b.flash = Math.max(0, b.flash - dt);
  b.invuln = Math.max(0, b.invuln - dt);
  b.telegraphFlash = Math.max(0, b.telegraphFlash - dt);
  b.facing = player.x >= b.x ? 1 : -1;

  if (b.state === 'hurt') {
    b.stateT -= dt;
    b.x += b.vx * dt;
    b.vx *= 0.88;
    if (b.stateT <= 0) {
      b.state = 'idle';
      b.vx = 0;
      b.thinkT = 0.25;
    }
    clampBoss(b);
    return;
  }

  if (b.state === 'telegraph') {
    b.stateT -= dt;
    b.telegraphFlash = 0.15;
    if (b.stateT <= 0) beginAttack(b);
    clampBoss(b);
    return;
  }

  if (b.state === 'attack') {
    b.stateT -= dt;
    tickAttack(b, player, dt);
    if (b.stateT <= 0) {
      b.state = 'recover';
      b.stateT = b.attack?.recover || 0.4;
      b.attack = null;
    }
    b.x += b.vx * dt;
    b.vx *= 0.9;
    clampBoss(b);
    return;
  }

  if (b.state === 'recover') {
    b.stateT -= dt;
    if (b.stateT <= 0) {
      b.state = 'idle';
      b.thinkT = 0.35 / b.def.aggression;
    }
    clampBoss(b);
    return;
  }

  // Idle / approach
  b.thinkT -= dt;
  const dist = Math.abs(player.x - b.x);
  const preferred = b.def.id === 'razor' ? 90 : b.def.id === 'titan' ? 130 : 100;

  if (dist > preferred + 20) {
    b.state = 'walk';
    b.vx = b.facing * b.def.speed;
    b.x += b.vx * dt;
  } else if (dist < preferred - 40 && b.def.id !== 'razor') {
    b.state = 'walk';
    b.vx = -b.facing * b.def.speed * 0.6;
    b.x += b.vx * dt;
  } else {
    b.state = 'idle';
    b.vx = 0;
  }

  if (b.thinkT <= 0 && dist < preferred + 80) {
    pickAttack(b, dist);
  }

  clampBoss(b);
}

function pickAttack(b, dist) {
  const keys = Object.keys(b.def.attacks);
  let key = keys[Math.floor(Math.random() * keys.length)];
  if (b.def.id === 'pulse') key = dist > 90 ? 'slam' : 'punch';
  if (b.def.id === 'razor') key = dist > 100 ? 'dash' : 'flurry';
  if (b.def.id === 'titan') key = dist > 120 ? 'shockwave' : 'grab';

  const atk = b.def.attacks[key];
  b.attackKey = key;
  b.state = 'telegraph';
  b.stateT = atk.telegraph;
  b.attack = { ...atk, key, t: 0, phase: 'windup' };
  b.hitLanded = false;
  b.hitCount = 0;
  sfx.telegraph();
}

function beginAttack(b) {
  const atk = b.attack;
  b.state = 'attack';
  b.stateT = atk.windup + atk.active + 0.01;
  atk.t = 0;
  atk.phase = 'windup';
  if (atk.dash) b.vx = b.facing * atk.dash;
}

function tickAttack(b, player, dt) {
  const a = b.attack;
  if (!a) return;
  a.t += dt;

  if (a.phase === 'windup' && a.t >= a.windup) {
    a.phase = 'active';
    a.t = 0;
  }

  if (a.phase === 'active') {
    const hits = a.hits || 1;
    const interval = a.active / hits;
    const which = Math.min(hits - 1, Math.floor(a.t / interval));
    if (which >= b.hitCount) {
      b.hitCount = which + 1;
      const res = resolveHit(b, player, { damage: a.dmg, range: a.range, chip: 0.3 });
      if (res.hit) {
        if (res.blocked) sfx.block();
        else {
          sfx.hit();
          sfx.hurt();
        }
        if (res.killed) {
          player.dead = true;
          player.state = 'dead';
          sfx.ko();
        }
      }
    }
    if (a.t >= a.active) {
      a.phase = 'done';
    }
  }
}

function clampBoss(b) {
  b.x = Math.max(b.w / 2 + 20, Math.min(W - b.w / 2 - 20, b.x));
  b.y = GROUND_Y;
}
