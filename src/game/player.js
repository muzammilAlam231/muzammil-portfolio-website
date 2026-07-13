/* ════════════════════════════════════════════════════════════════
   PLAYER — cybernetic runner rig + movement.

   Visual stack (inside → out):
     · dark glass chassis (MeshPhysicalMaterial)
     · phosphor chest band + holo visor
     · wireframe shell (EdgesGeometry + wireShell shader)
     · foot energy rings (torus, additive)
     · exhaust trail spawned each frame (effects.js)

   ⚠ MODEL SWAP POINT: replace buildRig() with a GLTF; keep the
   group pivot at the feet and the same collider exports on `player`.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LANES, PLAYER } from './config.js';
import { world } from './world.js';
import { glassMat, holoMat, neonMat, wireShellMat, shieldBubbleMat, magnetRingMat } from './materials.js';
import { sfx } from './audio.js';
import { burstFX, emitTrail, shockwave } from './effects.js';

export const player = {
  group: null,
  lane: 1,
  x: 0,
  y: 0,
  vy: 0,
  lean: 0,
  grounded: true,
  sliding: false,
  slideT: 0,
  jumpBufferT: 0,
  laneChangedAt: -9,
  dead: false,
  get height() { return this.sliding ? PLAYER.slideH : PLAYER.standH; },
  halfW: PLAYER.halfW,
  halfZ: PLAYER.halfZ,
};

let rig = {};
let runT = 0;
let footRingL, footRingR;
let wireShell, shieldMesh, magnetMesh;

export function initPlayer(scene) {
  player.group = buildRig();
  scene.add(player.group);
  resetPlayer();
}

function buildRig() {
  const g = new THREE.Group();
  const glass = glassMat();

  /* core chassis */
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.68, 0.36), glass);
  body.position.y = 0.95;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, 0.38), neonMat('#b8ff3c'));
  chest.position.y = 1.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.32), glass);
  head.position.y = 1.5;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.08), holoMat('#37e6ff', 0.95));
  visor.position.set(0, 1.51, -0.15);

  const legGeo = new THREE.BoxGeometry(0.16, 0.58, 0.18);
  const legL = new THREE.Mesh(legGeo, glass);
  const legR = new THREE.Mesh(legGeo, glass);
  legL.position.set(-0.16, 0.29, 0);
  legR.position.set(0.16, 0.29, 0);

  const armGeo = new THREE.BoxGeometry(0.11, 0.48, 0.14);
  const armL = new THREE.Mesh(armGeo, glass);
  const armR = new THREE.Mesh(armGeo, glass);
  armL.position.set(-0.4, 0.96, 0);
  armR.position.set(0.4, 0.96, 0);

  /* wireframe shell — the "holographic outline" look */
  const shellGeo = new THREE.BoxGeometry(0.72, 1.55, 0.48);
  wireShell = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeo, 18),
    wireShellMat('#37e6ff')
  );
  wireShell.position.y = 0.88;

  /* foot energy rings */
  const ringGeo = new THREE.TorusGeometry(0.22, 0.025, 6, 18);
  footRingL = new THREE.Mesh(ringGeo, neonMat('#b8ff3c', 0.85));
  footRingR = footRingL.clone();
  footRingL.rotation.x = Math.PI / 2;
  footRingR.rotation.x = Math.PI / 2;
  footRingL.position.set(-0.16, 0.04, 0);
  footRingR.position.set(0.16, 0.04, 0);

  shieldMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), shieldBubbleMat());
  shieldMesh.position.y = 0.95;
  shieldMesh.visible = false;

  magnetMesh = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 8, 32), magnetRingMat('#37e6ff'));
  magnetMesh.rotation.x = Math.PI / 2;
  magnetMesh.position.y = 1.0;
  magnetMesh.visible = false;

  g.add(body, chest, head, visor, legL, legR, armL, armR, wireShell, footRingL, footRingR, shieldMesh, magnetMesh);
  rig = { body, chest, head, visor, legL, legR, armL, armR, wireShell, footRingL, footRingR, shieldMesh, magnetMesh };
  return g;
}

export function resetPlayer() {
  player.lane = 1;
  player.x = 0;
  player.y = 0;
  player.vy = 0;
  player.lean = 0;
  player.grounded = true;
  player.sliding = false;
  player.slideT = 0;
  player.jumpBufferT = 0;
  player.dead = false;
  player.group.rotation.set(0, 0, 0);
  player.group.scale.set(1, 1, 1);
  player.group.position.set(0, 0, 0);
  player.group.visible = true;
}

export function moveLane(dir, runTime) {
  if (player.dead) return;
  const next = Math.min(2, Math.max(0, player.lane + dir));
  if (next === player.lane) return;
  player.lane = next;
  player.laneChangedAt = runTime;
  sfx.lane();
  burstFX({ x: player.x, y: 0.5, z: 0, color: world.accent.getStyle(), n: 6, speed: 3, up: 1.5, lifeS: 0.35, sizeMul: 0.6 });
}

export function tryJump() {
  if (player.dead) return;
  if (player.grounded) doJump();
  else player.jumpBufferT = PLAYER.jumpBuffer;
}
function doJump() {
  player.vy = PLAYER.jumpVel;
  player.grounded = false;
  if (player.sliding) endSlide();
  sfx.jump();
  burstFX({ x: player.x, y: 0.15, z: 0, color: '#37e6ff', n: 10, speed: 4, up: 2, lifeS: 0.45, sizeMul: 0.8 });
}

export function trySlide() {
  if (player.dead) return;
  if (!player.grounded) {
    player.vy = Math.min(player.vy, 0) + PLAYER.fastFall * 0.5;
    return;
  }
  player.sliding = true;
  player.slideT = PLAYER.slideTime;
  sfx.slide();
  burstFX({ x: player.x, y: 0.3, z: 0, color: world.accent.getStyle(), n: 8, speed: 5, spread: 1.5, lifeS: 0.3, sizeMul: 0.5 });
}
function endSlide() {
  player.sliding = false;
  player.slideT = 0;
}

export function updatePlayer(dt, speed) {
  if (player.dead) {
    player.group.rotation.x -= dt * 7;
    player.group.position.y = Math.max(0.2, player.group.position.y - dt * 1.4);
    return;
  }

  const targetX = LANES[player.lane];
  const k = 1 - Math.pow(0.0001, dt * (PLAYER.laneSnap / 14));
  const prevX = player.x;
  player.x += (targetX - player.x) * k;
  player.lean = (player.x - targetX) * 0.4 + (player.x - prevX) * 2.5;

  if (!player.grounded) {
    player.vy += PLAYER.gravity * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      sfx.land();
      squash();
      shockwave(player.x, 0, world.accent);
      burstFX({ x: player.x, y: 0.08, z: 0, color: world.accent.getStyle(), n: 12, speed: 4, spread: 1.4, lifeS: 0.4, sizeMul: 0.9 });
      if (player.jumpBufferT > 0) doJump();
    }
  }
  player.jumpBufferT -= dt;

  if (player.sliding) {
    player.slideT -= dt;
    if (player.slideT <= 0) endSlide();
  }

  const g = player.group;
  g.position.set(player.x, player.y, 0);
  g.rotation.z = -player.lean * 0.55;
  g.rotation.y = -player.lean * 0.4;

  runT += dt * (6 + speed * 0.35);
  const stride = player.grounded && !player.sliding ? 1 : 0.2;
  rig.legL.rotation.x = Math.sin(runT) * 0.9 * stride;
  rig.legR.rotation.x = Math.sin(runT + Math.PI) * 0.9 * stride;
  rig.armL.rotation.x = Math.sin(runT + Math.PI) * 0.7 * stride;
  rig.armR.rotation.x = Math.sin(runT) * 0.7 * stride;
  const bob = player.grounded && !player.sliding ? Math.abs(Math.sin(runT)) * 0.06 : 0;
  rig.body.position.y = 0.95 + bob;
  rig.head.position.y = 1.5 + bob * 1.2;
  rig.visor.position.y = 1.51 + bob * 1.2;
  rig.wireShell.position.y = 0.88 + bob;

  /* foot rings spin faster with speed */
  const spin = dt * (8 + speed * 0.6);
  rig.footRingL.rotation.z += spin;
  rig.footRingR.rotation.z -= spin;
  const ringScale = 0.85 + Math.min(speed / 30, 1) * 0.35;
  rig.footRingL.scale.setScalar(ringScale);
  rig.footRingR.scale.setScalar(ringScale);

  if (player.sliding) {
    g.scale.y += (0.42 - g.scale.y) * Math.min(1, dt * 18);
    g.rotation.x += (-0.5 - g.rotation.x) * Math.min(1, dt * 14);
  } else {
    g.scale.y += (unsquash - g.scale.y) * Math.min(1, dt * 10);
    g.rotation.x += ((player.grounded ? 0 : -0.18) - g.rotation.x) * Math.min(1, dt * 10);
  }

  /* exhaust trail */
  if (player.grounded && !player.sliding) {
    emitTrail(player.x - player.lean * 0.1, player.y, 0.2, world.accent, speed);
  }
}

/** toggle shield / magnet VFX shells */
export function updatePowerVisuals(power) {
  const shieldOn = power.shield > 0;
  const magnetOn = power.magnet > 0;
  rig.shieldMesh.visible = shieldOn;
  rig.magnetMesh.visible = magnetOn;
  if (shieldOn) {
    rig.shieldMesh.material.uniforms.uStrength.value = 0.55 + Math.sin(performance.now() * 0.008) * 0.15;
    rig.shieldMesh.rotation.y += 0.02;
  }
  if (magnetOn) {
    rig.magnetMesh.material.uniforms.uStrength.value = 0.65;
    rig.magnetMesh.rotation.z += 0.04;
  }
}

let unsquash = 1;
function squash() {
  unsquash = 0.86;
  setTimeout(() => (unsquash = 1), 90);
}

export function killPlayer() {
  player.dead = true;
  sfx.crash();
  burstFX({ x: player.x, y: 1, z: 0, color: '#ff5148', n: 32, speed: 8, up: 5, spread: 1.5, lifeS: 1, sizeMul: 1.6 });
  burstFX({ x: player.x, y: 1, z: 0, color: '#ffffff', n: 14, speed: 6, up: 3, lifeS: 0.6 });
}

export function shieldSave() {
  sfx.shieldPop();
  burstFX({ x: player.x, y: 1, z: 0, color: '#ffffff', n: 22, speed: 7, up: 3.5, spread: 1.4, lifeS: 0.8, sizeMul: 1.2 });
}
