/* ════════════════════════════════════════════════════════════════
   NEON ARENA — hitboxes + damage resolution
   ════════════════════════════════════════════════════════════════ */

export function aabb(x, y, w, h) {
  return { x, y, w, h };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function bodyBox(f) {
  return aabb(f.x - f.w / 2, f.y - f.h, f.w, f.h);
}

export function attackBox(f, range, heightRatio = 0.55) {
  const h = f.h * heightRatio;
  const y = f.y - f.h * 0.75;
  if (f.facing > 0) return aabb(f.x + f.w * 0.15, y, range, h);
  return aabb(f.x - f.w * 0.15 - range, y, range, h);
}

/** Returns { hit, blocked, damage, killed } */
export function resolveHit(attacker, defender, { damage, range, chip = 0.25 }) {
  if (!defender || defender.dead || defender.invuln > 0) return { hit: false };
  if (defender.state === 'dodge') return { hit: false };

  const atk = attackBox(attacker, range);
  const def = bodyBox(defender);
  if (!overlaps(atk, def)) return { hit: false };

  const dirToAtk = Math.sign(attacker.x - defender.x) || attacker.facing;
  const isBlocking = defender.state === 'block' && defender.facing === dirToAtk;

  if (isBlocking) {
    const dmg = damage * chip;
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.flash = 0.12;
    defender.vx += attacker.facing * 50;
    return { hit: true, blocked: true, damage: dmg, killed: defender.hp <= 0 };
  }

  defender.hp = Math.max(0, defender.hp - damage);
  defender.state = 'hurt';
  defender.stateT = 0.28;
  defender.flash = 0.18;
  defender.vx = attacker.facing * 200;
  defender.invuln = 0.12;
  return { hit: true, blocked: false, damage, killed: defender.hp <= 0 };
}
