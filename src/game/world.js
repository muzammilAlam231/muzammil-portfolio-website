/* ════════════════════════════════════════════════════════════════
   WORLD — cyber highway: sky dome, reflective runway, lane tubes,
   volumetric beams, horizon ring, speed tunnel, decor chunks.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { COLORS, ZONES, ZONE_LENGTH, LOW, LANES } from './config.js';
import { holoMat, neonMat, streakMat, tickMaterials, coinCoreMat, coinRingMat, dangerFieldMat, glowTexture } from './materials.js';

const CHUNK_LEN = 30;
const CHUNKS = LOW ? 7 : 9;

export const world = {
  group: null,
  zoneIndex: 0,
  accent: new THREE.Color(ZONES[0].color),
  accentTarget: new THREE.Color(ZONES[0].color),
  onZoneChange: null,
  floorUniforms: null,
  wallMats: [],
  laneTubes: [],
};

export const mats = {
  neon: neonMat(ZONES[0].color),
  neonFaint: neonMat(ZONES[0].color, 0.22),
  holo: holoMat(ZONES[0].color, 0.42),
  danger: neonMat('#ff5148'),
  dangerGlow: neonMat('#ff5148', 0.65),
  dangerField: null,
  steel: new THREE.MeshStandardMaterial({
    color: COLORS.steel, metalness: 0.9, roughness: 0.28,
    emissive: 0x0a0a14, emissiveIntensity: 0.35,
  }),
  steelLight: new THREE.MeshStandardMaterial({
    color: COLORS.steelLight, metalness: 0.82, roughness: 0.32,
    emissive: 0x12121c, emissiveIntensity: 0.4,
  }),
  white: neonMat('#e9e9ec', 0.95),
  coinCore: null,
  coinRing: null,
};

let chunks = [];
let stars, starPos, starVel;
let horizonSun, horizonRing;
let skyUniforms;
let beamMats = [];

export function initWorld(scene) {
  world.group = new THREE.Group();
  scene.add(world.group);

  /* lighting */
  scene.add(new THREE.HemisphereLight(0x1a2040, 0x050508, 0.65));
  const key = new THREE.DirectionalLight(0xd8e4ff, 0.45);
  key.position.set(5, 14, 8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x6080ff, 0.18);
  fill.position.set(-6, 6, -4);
  scene.add(fill);
  const rim = new THREE.PointLight(ZONES[0].color, 1.1, 50);
  rim.position.set(0, 3.5, -3);
  scene.add(rim);
  world.rimLight = rim;

  mats.dangerField = dangerFieldMat();
  mats.coinCore = coinCoreMat(COLORS.coin);
  mats.coinRing = coinRingMat(COLORS.coinRing);

  /* ── sky dome ── */
  skyUniforms = {
    uTime: { value: 0 },
    uAccent: { value: world.accent },
    uBg: { value: new THREE.Color(COLORS.bg) },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uAccent;
        uniform vec3 uBg;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 top = uBg * 0.3 + uAccent * 0.04;
          vec3 horizon = uAccent * 0.14;
          vec3 col = mix(horizon, top, smoothstep(-0.05, 0.55, h));
          float stars = step(0.97, fract(sin(dot(vPos.xz, vec2(12.9898, 78.233))) * 43758.5453));
          col += vec3(stars) * 0.35 * smoothstep(0.1, 0.5, h);
          float sweep = sin(atan(vPos.x, vPos.z) * 3.0 + uTime * 0.2) * 0.5 + 0.5;
          col += uAccent * sweep * 0.012 * smoothstep(0.0, 0.25, h);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  sky.position.y = -8;
  scene.add(sky);

  /* ── main runway floor ── */
  world.floorUniforms = {
    uScroll: { value: 0 },
    uTime: { value: 0 },
    uAccent: { value: world.accent },
    uBg: { value: new THREE.Color(COLORS.bg) },
  };
  const floorShader = /* glsl */ `
    uniform float uScroll;
    uniform float uTime;
    uniform vec3 uAccent;
    uniform vec3 uBg;
    varying vec2 vUv;
    varying float vDepth;

    float grid(float v, float w) {
      return smoothstep(0.5 - w, 0.5, abs(fract(v) - 0.5));
    }

    void main() {
      float x = (vUv.x - 0.5) * 42.0;
      float z = vUv.y * 140.0 + uScroll;
      float persp = 1.0 / (1.0 + z * 0.016);
      float px = x * persp;

      vec3 col = uBg * 1.5;

      float g = max(grid(z * persp * 0.48, 0.05), grid(px * 0.52, 0.04));
      col += uAccent * g * (0.08 + persp * 0.14);

      /* bright center runway */
      float center = exp(-abs(px) * 0.55) * 0.16;
      col += uAccent * center * persp;

      /* lane tubes glow */
      float lanes = 0.0;
      lanes += exp(-pow(abs(px) - 3.35 * persp, 2.0) * 8.0) * 0.55;
      lanes += exp(-pow(abs(px) - 1.15 * persp, 2.0) * 10.0) * 0.35;
      lanes += exp(-pow(abs(px), 2.0) * 12.0) * 0.22;
      col += uAccent * lanes;

      float hx = sin(px * 1.1 + z * 0.12) * sin(z * 0.2);
      col += uAccent * abs(hx) * 0.025 * persp;

      float sweep = smoothstep(0.07, 0.0, abs(fract(z * 0.07 - uTime * 0.4) - 0.5));
      col += uAccent * sweep * 0.18 * persp;

      float pulse = smoothstep(0.14, 0.0, abs(fract(z * 0.035 - uTime * 0.18) - 0.5));
      col += uAccent * pulse * 0.07;

      /* reflection shimmer near camera */
      float shimmer = sin(px * 2.0 + uTime * 4.0) * 0.5 + 0.5;
      col += uAccent * shimmer * 0.04 * (1.0 - smoothstep(20.0, 80.0, vDepth));

      float fogF = smoothstep(24.0, 130.0, vDepth);
      col = mix(col, uBg, fogF);
      gl_FragColor = vec4(col, 1.0);
    }
  `;
  const floorVS = /* glsl */ `
    varying vec2 vUv;
    varying float vDepth;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 280, 1, 1),
    new THREE.ShaderMaterial({ uniforms: world.floorUniforms, vertexShader: floorVS, fragmentShader: floorShader })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -105);
  scene.add(floor);

  /* glossy reflection plane beneath runway */
  const refl = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 280, 1, 1),
    new THREE.ShaderMaterial({
      uniforms: world.floorUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: floorVS,
      fragmentShader: /* glsl */ `
        uniform float uScroll;
        uniform float uTime;
        uniform vec3 uAccent;
        varying vec2 vUv;
        varying float vDepth;
        void main() {
          float x = (vUv.x - 0.5) * 42.0;
          float z = vUv.y * 140.0 + uScroll;
          float persp = 1.0 / (1.0 + z * 0.016);
          float px = x * persp;
          float lane = exp(-pow(abs(px) - 3.35 * persp, 2.0) * 6.0);
          lane += exp(-pow(abs(px), 2.0) * 10.0);
          float a = lane * 0.06 * (1.0 - smoothstep(15.0, 90.0, vDepth));
          gl_FragColor = vec4(uAccent * 1.5, a);
        }
      `,
    })
  );
  refl.rotation.x = -Math.PI / 2;
  refl.position.set(0, -0.02, -105);
  scene.add(refl);

  /* ── 3D neon lane tubes ── */
  const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 130, 8);
  for (const lx of LANES) {
    const tube = new THREE.Mesh(tubeGeo, mats.neonFaint);
    tube.position.set(lx, 0.04, -55);
    scene.add(tube);
    world.laneTubes.push(tube);
  }
  /* outer rail tubes */
  for (const lx of [-3.5, 3.5]) {
    const tube = new THREE.Mesh(tubeGeo, mats.neon);
    tube.position.set(lx, 0.05, -55);
    scene.add(tube);
    world.laneTubes.push(tube);
  }

  /* ── holographic corridor walls ── */
  const wallGeo = new THREE.PlaneGeometry(0.06, 6.5, 1, 32);
  for (const side of [-1, 1]) {
    const wm = holoMat(ZONES[0].color, 0.26);
    world.wallMats.push(wm);
    const wall = new THREE.Mesh(wallGeo, wm);
    wall.position.set(side * 4.35, 3.25, -58);
    wall.rotation.y = side * 0.1;
    scene.add(wall);
  }

  /* ── sweeping volumetric beams ── */
  for (let i = 0; i < (LOW ? 2 : 4); i++) {
    const bm = holoMat(ZONES[0].color, 0.1);
    beamMats.push(bm);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 14), bm);
    beam.position.set((i % 2 ? 1 : -1) * (5 + i * 2), 7, -40 - i * 25);
    beam.rotation.y = (i % 2 ? -1 : 1) * 0.4;
    scene.add(beam);
  }

  /* ── horizon sun + ring ── */
  horizonSun = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(), color: ZONES[0].color,
      transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  horizonSun.scale.set(36, 36, 1);
  horizonSun.position.set(0, 8, -130);
  scene.add(horizonSun);

  horizonRing = new THREE.Mesh(
    new THREE.TorusGeometry(14, 0.08, 8, 64),
    mats.neonFaint
  );
  horizonRing.position.set(0, 5.5, -125);
  horizonRing.rotation.x = Math.PI / 2.2;
  scene.add(horizonRing);

  /* ── speed-streak tunnel ── */
  const N = LOW ? 280 : 680;
  starPos = new Float32Array(N * 3);
  starVel = new Float32Array(N);
  for (let i = 0; i < N; i++) respawnStar(i, true);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3).setUsage(THREE.DynamicDrawUsage));
  stars = new THREE.Points(sg, streakMat(ZONES[0].color));
  stars.frustumCulled = false;
  scene.add(stars);

  for (let i = 0; i < CHUNKS; i++) {
    const c = buildChunk();
    c.position.z = -i * CHUNK_LEN;
    world.group.add(c);
    chunks.push(c);
  }
}

function respawnStar(i, anywhere = false) {
  const i3 = i * 3;
  const side = Math.random() < 0.5 ? -1 : 1;
  starPos[i3] = side * (3.5 + Math.random() * 16);
  starPos[i3 + 1] = 0.2 + Math.random() * 12;
  starPos[i3 + 2] = anywhere ? -Math.random() * 170 : -175;
  starVel[i] = 0.8 + Math.random() * 2.2;
}

function buildChunk() {
  const g = new THREE.Group();

  const arch = new THREE.Group();
  const beamV = new THREE.BoxGeometry(0.06, 5.8, 0.06);
  const beamH = new THREE.BoxGeometry(9.8, 0.06, 0.06);
  arch.add(
    new THREE.Mesh(beamV, mats.neon), new THREE.Mesh(beamV, mats.neon),
    new THREE.Mesh(beamH, mats.neon),
    new THREE.Mesh(new THREE.PlaneGeometry(8.2, 3.6), mats.holo)
  );
  arch.children[0].position.set(-4.9, 2.9, 0);
  arch.children[1].position.set(4.9, 2.9, 0);
  arch.children[2].position.set(0, 5.8, 0);
  arch.children[3].position.set(0, 3.0, 0);
  arch.position.z = -CHUNK_LEN * Math.random() * 0.5;
  g.add(arch);

  const towers = LOW ? 3 : 5;
  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < towers; i++) {
      const tx = s * (6.5 + Math.random() * 5);
      const tz = -Math.random() * CHUNK_LEN;
      const h = 2.2 + Math.random() * 4.5;
      const core = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3), mats.steel);
      core.position.set(tx, h / 2, tz);
      g.add(core);
      for (let r = 0; r < 3; r++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75 + r * 0.15, 0.035, 6, 24), mats.neonFaint);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(tx, 0.8 + r * (h / 3), tz);
        g.add(ring);
      }
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(1.6, h * 0.65), mats.holo);
      slab.position.set(tx + s * 0.75, h * 0.5, tz);
      slab.rotation.y = -s * 0.55;
      g.add(slab);
    }
  }

  for (let s = -1; s <= 1; s += 2) {
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 4.2, 6), mats.neonFaint);
      p.position.set(s * 3.9, 2.1, -i * (CHUNK_LEN / 5) - Math.random() * 2);
      g.add(p);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 4), mats.holo);
      beam.position.copy(p.position);
      beam.position.x += s * 0.25;
      g.add(beam);
    }
  }

  return g;
}

export function updateWorld(dt, dz, distance, speed = 14) {
  const t = (world.floorUniforms.uTime.value += dt);
  world.floorUniforms.uScroll.value += dz / 2;
  skyUniforms.uTime.value = t;
  tickMaterials(t);

  const speed01 = Math.min(speed / 32, 1);
  const sp = stars.geometry.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    starPos[i * 3 + 2] += dz * starVel[i] * (0.6 + speed01 * 1.4);
    if (starPos[i * 3 + 2] > 12) respawnStar(i);
  }
  sp.needsUpdate = true;
  stars.material.opacity = 0.28 + speed01 * 0.28;
  stars.material.size = 0.3 + speed01 * 0.35;

  horizonRing.rotation.z += dt * 0.15;
  horizonSun.material.opacity = 0.55 + Math.sin(t * 0.8) * 0.15;

  for (const c of chunks) {
    c.position.z += dz;
    if (c.position.z > CHUNK_LEN / 2) c.position.z -= CHUNKS * CHUNK_LEN;
  }

  const zi = Math.floor(distance / ZONE_LENGTH) % ZONES.length;
  if (zi !== world.zoneIndex) {
    world.zoneIndex = zi;
    world.accentTarget.set(ZONES[zi].color);
    world.onZoneChange?.(ZONES[zi]);
  }
  world.accent.lerp(world.accentTarget, Math.min(1, dt * 2));
  applyAccent(world.accent);
}

function applyAccent(c) {
  mats.neon.color.copy(c);
  mats.neonFaint.color.copy(c);
  mats.holo.uniforms.uColor.value.copy(c);
  world.floorUniforms.uAccent.value.copy(c);
  skyUniforms.uAccent.value.copy(c);
  stars.material.color.copy(c);
  horizonSun.material.color.copy(c);
  world.rimLight?.color.copy(c);
  for (const wm of world.wallMats) wm.uniforms.uColor.value.copy(c);
  for (const bm of beamMats) bm.uniforms.uColor.value.copy(c);
}

export function resetWorld() {
  world.zoneIndex = 0;
  world.accentTarget.set(ZONES[0].color);
  world.accent.set(ZONES[0].color);
  applyAccent(world.accent);
}
