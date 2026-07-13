/* ════════════════════════════════════════════════════════════════
   EFFECTS — bursts, exhaust trail, speed lines, shockwave rings.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { LOW } from './config.js';
import { streakMat, glowTexture } from './materials.js';

const MAX = LOW ? 180 : 400;
const TRAIL_N = LOW ? 24 : 56;
const SPEED_N = LOW ? 0 : 80;

let points, posAttr, colAttr, sizeAttr;
const pos = new Float32Array(MAX * 3);
const col = new Float32Array(MAX * 3);
const size = new Float32Array(MAX);
const vel = new Float32Array(MAX * 3);
const life = new Float32Array(MAX);
const lifeMax = new Float32Array(MAX);
let cursor = 0;

let trailPts, trailPos, trailLife, trailCursor = 0;
let speedPts, speedPos, speedLife, speedCursor = 0;
let shockRing = null;
let shockUniforms = null;

export { glowTexture } from './materials.js';

export function initEffects(scene) {
  const geo = new THREE.BufferGeometry();
  posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  colAttr = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  sizeAttr = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  geo.setAttribute('aSize', sizeAttr);

  points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms: { uMap: { value: glowTexture() } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (240.0 / max(1.0, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a;
          if (a < 0.02) discard;
          gl_FragColor = vec4(vColor * (1.2 + a * 0.8), a);
        }
      `,
    })
  );
  points.frustumCulled = false;
  scene.add(points);

  trailPos = new Float32Array(TRAIL_N * 3);
  trailLife = new Float32Array(TRAIL_N);
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailPts = new THREE.Points(tg, streakMat('#b8ff3c'));
  trailPts.frustumCulled = false;
  scene.add(trailPts);

  if (SPEED_N > 0) {
    speedPos = new Float32Array(SPEED_N * 3);
    speedLife = new Float32Array(SPEED_N);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(speedPos, 3).setUsage(THREE.DynamicDrawUsage));
    speedPts = new THREE.Points(sg, streakMat('#ffffff'));
    speedPts.frustumCulled = false;
    scene.add(speedPts);
  }

  shockUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#b8ff3c') }, uStrength: { value: 0 } };
  shockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.35, 48),
    new THREE.ShaderMaterial({
      uniforms: shockUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec2 vUv;
        void main(){
          float a = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          a *= uStrength * (0.6 + 0.4*sin(uTime*20.0));
          gl_FragColor = vec4(uColor, a);
        }
      `,
    })
  );
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.visible = false;
  scene.add(shockRing);
}

const tmpColor = new THREE.Color();

export function burstFX(opts) {
  const {
    x, y, z, color = '#b8ff3c', n = 8, speed = 4, up = 2, spread = 1, lifeS = 0.6, sizeMul = 1,
  } = opts;
  tmpColor.set(color);
  for (let k = 0; k < n; k++) {
    const i = cursor;
    cursor = (cursor + 1) % MAX;
    const i3 = i * 3;
    pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    vel[i3] = (Math.random() - 0.5) * speed * spread;
    vel[i3 + 1] = Math.random() * speed * 0.6 + up;
    vel[i3 + 2] = (Math.random() - 0.5) * speed * spread;
    col[i3] = tmpColor.r; col[i3 + 1] = tmpColor.g; col[i3 + 2] = tmpColor.b;
    life[i] = lifeMax[i] = lifeS * (0.6 + Math.random() * 0.6);
    size[i] = (0.7 + Math.random()) * sizeMul;
  }
}

export function emitTrail(x, y, z, color, speed) {
  if (speed < 6) return;
  const i = trailCursor;
  trailCursor = (trailCursor + 1) % TRAIL_N;
  const i3 = i * 3;
  trailPos[i3] = x + (Math.random() - 0.5) * 0.35;
  trailPos[i3 + 1] = y + 0.05;
  trailPos[i3 + 2] = z + 0.35 + Math.random() * 0.4;
  trailLife[i] = 0.4 + Math.random() * 0.3;
  trailPts.material.color.set(color);
  trailPts.material.opacity = 0.28 + Math.min(speed / 26, 1) * 0.35;
}

/** horizontal speed lines at the edges when hauling */
export function emitSpeedLines(speed, color) {
  if (!speedPts || speed < 20) return;
  const count = Math.floor((speed - 20) / 4);
  for (let k = 0; k < count; k++) {
    const i = speedCursor;
    speedCursor = (speedCursor + 1) % SPEED_N;
    const i3 = i * 3;
    const side = Math.random() < 0.5 ? -1 : 1;
    speedPos[i3] = side * (4.5 + Math.random() * 8);
    speedPos[i3 + 1] = 0.5 + Math.random() * 3;
    speedPos[i3 + 2] = -2 - Math.random() * 6;
    speedLife[i] = 0.25 + Math.random() * 0.2;
  }
  speedPts.material.color.set(color);
  speedPts.material.opacity = 0.14 + Math.min((speed - 20) / 12, 1) * 0.28;
}

/** landing / coin shockwave ring on the floor */
export function shockwave(x, z, color) {
  if (!shockRing) return;
  shockRing.position.set(x, 0.06, z);
  shockRing.scale.setScalar(0.3);
  shockRing.visible = true;
  shockUniforms.uColor.value.set(color);
  shockUniforms.uStrength.value = 1;
  shockUniforms.uTime.value = 0;
}

export function updateEffects(dt, worldDz, speed = 14) {
  for (let i = 0; i < MAX; i++) {
    if (life[i] <= 0) continue;
    life[i] -= dt;
    const i3 = i * 3;
    if (life[i] <= 0) { pos[i3 + 1] = -999; continue; }
    vel[i3 + 1] -= 12 * dt;
    pos[i3] += vel[i3] * dt;
    pos[i3 + 1] += vel[i3 + 1] * dt;
    pos[i3 + 2] += vel[i3 + 2] * dt + worldDz;
    size[i] *= 1 - dt * 1.1;
  }
  posAttr.needsUpdate = true;
  colAttr.needsUpdate = true;
  sizeAttr.needsUpdate = true;

  const tp = trailPts.geometry.attributes.position;
  for (let i = 0; i < TRAIL_N; i++) {
    if (trailLife[i] <= 0) continue;
    trailLife[i] -= dt;
    const i3 = i * 3;
    if (trailLife[i] <= 0) { trailPos[i3 + 1] = -999; continue; }
    trailPos[i3 + 2] += worldDz * 0.88;
  }
  tp.needsUpdate = true;

  if (speedPts) {
    const sp = speedPts.geometry.attributes.position;
    for (let i = 0; i < SPEED_N; i++) {
      if (speedLife[i] <= 0) continue;
      speedLife[i] -= dt;
      const i3 = i * 3;
      if (speedLife[i] <= 0) { speedPos[i3 + 1] = -999; continue; }
      speedPos[i3 + 2] += worldDz * 1.2 + dt * speed * 0.8;
    }
    sp.needsUpdate = true;
    emitSpeedLines(speed, speedPts.material.color);
  }

  if (shockRing?.visible) {
    shockUniforms.uTime.value += dt;
    shockRing.scale.x += dt * 14;
    shockRing.scale.y = shockRing.scale.x;
    shockUniforms.uStrength.value -= dt * 2.2;
    if (shockUniforms.uStrength.value <= 0) shockRing.visible = false;
  }
}

export function setTrailColor(c) {
  trailPts.material.color.copy(c);
}
