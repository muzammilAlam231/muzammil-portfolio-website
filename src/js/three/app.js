/* ════════════════════════════════════════════════════════════════
   THREE APP — one persistent particle system behind the whole site.

   How the morph works
   ───────────────────
   `morph = { a, b, t }` is the single source of truth, written by
   ScrollTrigger instances in sections.js:
     a = formation index we're leaving
     b = formation index we're entering
     t = 0..1 scrubbed progress between them
   Every frame each particle computes its blended target
       target = mix(formations[a], formations[b], t)
   and chases it with per-particle damping (each particle has its
   own spring constant), which is what makes transitions feel like
   a swarm re-organising instead of a linear tween.

   The camera reads the same state: 7 keyframes, blended with the
   same (a, b, t), plus damped mouse parallax on top.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import gsap from 'gsap';
import { ENV, lerp, damp } from '../utils.js';
import { buildFormations, computeRings, computeDNA } from './formations.js';

/** Scroll-driven morph state — mutated directly by sections.js */
export const morph = { a: 0, b: 0, t: 0 };

/** Live readout for the HUD (formation name + smoothed fps) */
export const stats = { fps: 60, formation: 'LATTICE' };
const FORM_NAMES = ['LATTICE', 'NEBULA', 'ORBITS', 'STAGE', 'HELIX', 'STRATA', 'CORE'];

/* Camera keyframes per formation (x shifts push the structure
   left/right of the DOM copy on wide screens; zeroed on mobile.
   rz = subtle roll — the "handheld cinema" tilt per chapter). */
const CAM = [
  { x: -1.05, y: 0.1,  z: 7.3, ly: 0.1,   rz: 0,      alpha: 1.0  }, // 0 hero — structure right of name
  { x: 1.15,  y: 0.15, z: 8.3, ly: 0.1,   rz: -0.03,  alpha: 0.85 }, // 1 about — nebula left of bio
  { x: 0,     y: 0,    z: 8.6, ly: 0,     rz: 0.025,  alpha: 1.0  }, // 2 skills — rings centered
  { x: 0,     y: -0.2, z: 9.4, ly: -0.15, rz: -0.02,  alpha: 0.5  }, // 3 work — dim stage floor
  { x: 0,     y: 0.1,  z: 8.6, ly: 0,     rz: 0.035,  alpha: 0.6  }, // 4 path — DNA helix behind timeline
  { x: 0,     y: 0.5,  z: 7.8, ly: -0.1,  rz: -0.03,  alpha: 0.95 }, // 5 cloud — slight top-down on strata
  { x: 0,     y: 0,    z: 6.9, ly: 0,     rz: 0,      alpha: 1.0  }, // 6 contact — push in on the core
];

let renderer, scene, camera, points, lines;
let posAttr, linePosAttr;
let F, COUNT, cur, seekK;
let uniforms;
let ready = false;
let narrow = false;

/* Adaptive quality: if frames run slow for a while, step the pixel
   ratio down (never below 1) — smoothness beats sharpness. */
const basePR = () => Math.min(devicePixelRatio, ENV.mobile ? 1 : ENV.low ? 1.25 : 2);
let curPR = 1;
let frameEMA = 16;
let frameCount = 0;

const intro = { mix: 0 };          // 0 = scattered, 1 = assembled (preloader → hero)
let driftX = 0;                    // work-section horizontal parallax
let highlightRing = -1;            // skills hover
const mouseNdc = new THREE.Vector2(0, 0);
let pointerActive = false;
const mouseWorld = new THREE.Vector3(999, 999, 0);
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3(0, 0, 0);
let rollCur = 0;

export function initThree() {
  const canvas = document.getElementById('webgl');
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  COUNT = ENV.low ? 1500 : 3800;
  F = buildFormations(COUNT);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 60);
  camPos.set(CAM[0].x, CAM[0].y, CAM[0].z);
  camera.position.copy(camPos);

  /* ── particles ── */
  cur = ENV.reduced ? F.list[0].slice() : F.scatter.slice();
  seekK = new Float32Array(COUNT);
  const aRand = new Float32Array(COUNT);
  const aGroup = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    aRand[i] = Math.random();
    aGroup[i] = i % 20; // shader derives ring (%4) and stratum (%5) from this
    seekK[i] = 0.05 + aRand[i] * 0.07; // per-particle spring = organic stagger
  }

  const geo = new THREE.BufferGeometry();
  posAttr = new THREE.BufferAttribute(cur, 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
  geo.setAttribute('aGroup', new THREE.BufferAttribute(aGroup, 1));

  uniforms = {
    uTime: { value: 0 },
    uPR: { value: basePR() },
    uSize: { value: ENV.mobile ? 0.88 : ENV.low ? 0.95 : 1.0 },
    uAlpha: { value: 1 },
    uWobble: { value: 1 },
    uAccentCut: { value: 0.9 },
    uGroupMode: { value: 0 }, // 0 none · 1 skills rings · 2 cloud strata
    uHighlight: { value: -1 },
    uFlare: { value: 0 }, // momentary energy boost (assembly pop, email hover, bursts)
    uColor: { value: new THREE.Color(0.6, 0.65, 0.74) },
    // accent is read from CSS so swapping --accent re-themes the 3D too
    uAccent: {
      value: new THREE.Color(
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b8ff3c'
      ),
    },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aRand;
      attribute float aGroup;
      uniform float uTime, uPR, uSize, uAlpha, uWobble, uAccentCut, uGroupMode, uHighlight, uFlare;
      uniform vec3 uColor, uAccent;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        // idle wobble keeps the field alive even when scroll is still
        p += 0.05 * uWobble * (0.4 + aRand) * vec3(
          sin(uTime * 0.6 + aRand * 6.283),
          cos(uTime * 0.5 + aRand * 12.566),
          sin(uTime * 0.7 + aRand * 3.141)
        );
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = max(0.1, -mv.z);

        float isAccent = step(uAccentCut, aRand);
        float accentMix = isAccent * 0.85;
        float boost = 0.0;
        float pulse = 1.0;
        if (uGroupMode > 0.5 && uGroupMode < 1.5) {
          // skills: light up the hovered orbit ring
          float ring = mod(aGroup, 4.0);
          boost = (uHighlight > -0.5) ? (1.0 - step(0.5, abs(ring - uHighlight))) : 0.0;
        } else if (uGroupMode > 2.5) {
          // DNA: base-pair rungs glow accent with a soft replication shimmer
          float rung = 1.0 - step(0.5, abs(mod(aGroup, 4.0) - 3.0));
          accentMix = max(accentMix, rung * 0.7);
          pulse = 1.0 + rung * 0.3 * sin(uTime * 2.2 + aRand * 6.283);
        } else if (uGroupMode > 1.5) {
          // cloud: alternating strata tinted + a slow wave travelling
          // through the layers — infrastructure that reads as "live"
          float layer = mod(aGroup, 5.0);
          accentMix = max(accentMix, mod(layer, 2.0) * 0.3);
          pulse = 0.8 + 0.45 * (0.5 + 0.5 * sin(uTime * 1.5 - layer * 1.3));
        }
        accentMix = max(accentMix, boost);
        vColor = mix(uColor, uAccent, accentMix);

        // depth fog: far particles fade — cheap atmosphere, no post-processing
        float fog = smoothstep(16.0, 5.5, dist);
        float flare = uFlare * (0.2 + 1.1 * isAccent);
        vAlpha = uAlpha * (0.35 + 0.65 * aRand) * pulse
               * (0.3 + 0.7 * fog) * (1.0 + boost * 1.4) * (1.0 + flare * 0.8);
        float size = uSize * (0.6 + aRand * 0.9)
                   * (1.0 + accentMix * 0.5 + boost * 0.6 + flare * 0.9);
        gl_PointSize = size * uPR * (26.0 / dist);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.25, d) * min(vAlpha, 1.0);
        if (a < 0.004) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

  points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // positions stream in every frame
  scene.add(points);

  /* ── structure lines (hero lattice beams, echoed at contact) ── */
  const E = F.edges.length;
  const lineGeo = new THREE.BufferGeometry();
  linePosAttr = new THREE.BufferAttribute(new Float32Array(E * 6), 3);
  linePosAttr.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute('position', linePosAttr);
  lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({
      color: 0x8a93a6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  lines.frustumCulled = false;
  scene.add(lines);

  initPackets();

  /* ── events ── */
  curPR = basePR();
  resize();
  window.addEventListener('resize', resize);
  if (!ENV.touch) {
    window.addEventListener('pointermove', (e) => {
      mouseNdc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      pointerActive = true;
    });
  }

  ready = true;

  if (ENV.reduced) {
    // Static poster: assembled hero structure, gentle glow, no loop
    intro.mix = 1;
    updateLines(0.45);
    renderer.render(scene, camera);
  } else {
    gsap.ticker.add(frame);
  }
}

/* ── public API (all safe no-ops if WebGL failed) ─────────── */

/** Preloader → hero: particles fly from scatter into the lattice,
    then the whole system flares once as it "comes online" */
export function assemble() {
  if (!ready || ENV.reduced) return;
  gsap
    .timeline()
    .to(intro, { mix: 1, duration: 2.8, ease: 'power2.inOut' })
    .to(uniforms.uFlare, { value: 0.9, duration: 0.3, ease: 'power2.in' }, '-=0.5')
    .to(uniforms.uFlare, { value: 0, duration: 1.3, ease: 'power3.out' });
}

/** Re-read --accent from CSS (used when the CORE skin toggles). */
export function syncAccentFromCss() {
  if (!uniforms?.uAccent) return;
  const core = document.documentElement.dataset.skin === 'core';
  const hex =
    getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#b8ff3c';
  uniforms.uAccent.value.set(hex);
  uniforms.uColor.value.set(core ? '#a99e8c' : '#99a6bd');
  if (lines?.material) lines.material.color.set(core ? '#8b7046' : '#8a93a6');
}

/** Sustained flare (email hover): target 0..1 */
export function setFlare(v) {
  if (!ready) return;
  gsap.to(uniforms.uFlare, { value: v, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
}

/** Click/tap anywhere on the background → shockwave through nearby particles */
export function burst(clientX, clientY) {
  if (!ready || ENV.reduced) return;
  const ok = worldFromScreen((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1, burstPoint);
  if (!ok) return;
  const R = 2.3, R2 = R * R;
  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    const dx = cur[i3] - burstPoint.x;
    const dy = cur[i3 + 1] - burstPoint.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R2) continue;
    const d = Math.sqrt(d2) || 0.001;
    const f = Math.pow(1 - d / R, 1.5) * 1.6;
    cur[i3] += (dx / d) * f;
    cur[i3 + 1] += (dy / d) * f;
    cur[i3 + 2] += (Math.random() - 0.5) * f * 0.5;
  }
  // small energy pop, then the seek springs pull everything home
  gsap.to(uniforms.uFlare, { value: 0.5, duration: 0.15, ease: 'power2.in', overwrite: 'auto' });
  gsap.to(uniforms.uFlare, { value: 0, duration: 0.9, delay: 0.15, ease: 'power3.out', overwrite: false });
}
const burstPoint = new THREE.Vector3();

/** Project screen NDC onto the z=0 world plane. Returns false if parallel. */
function worldFromScreen(nx, ny, out) {
  const v = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
  const dir = v.sub(camera.position).normalize();
  if (Math.abs(dir.z) < 0.001) return false;
  out.copy(camera.position).addScaledVector(dir, -camera.position.z / dir.z);
  return true;
}

/* ════════════════════════════════════════════════════════════
   SIGNAL PACKETS — a handful of bright accent motes that hop
   from particle to particle, so data visibly "flows through the
   system" in every formation. They chase the particles' LIVE
   positions, which keeps them coherent mid-morph.
   ════════════════════════════════════════════════════════════ */
const rnd = (a, b) => a + Math.random() * (b - a);
let PACKET_N = 0;
let pkPos, pkTgt, pkSpd, pkPosAttr, pkUniforms, packetPoints;

function initPackets() {
  PACKET_N = ENV.low ? 14 : 32;
  if (PACKET_N === 0) {
    packetPoints = { visible: false, frustumCulled: false };
    return;
  }
  pkPos = new Float32Array(PACKET_N * 3);
  pkTgt = new Int32Array(PACKET_N);
  pkSpd = new Float32Array(PACKET_N);
  const aS = new Float32Array(PACKET_N);
  for (let i = 0; i < PACKET_N; i++) {
    const src = (Math.random() * COUNT) | 0;
    pkPos[i * 3] = cur[src * 3];
    pkPos[i * 3 + 1] = cur[src * 3 + 1];
    pkPos[i * 3 + 2] = cur[src * 3 + 2];
    pkTgt[i] = (Math.random() * COUNT) | 0;
    pkSpd[i] = rnd(0.9, 2.1);
    aS[i] = rnd(0.7, 1.5);
  }
  const geo = new THREE.BufferGeometry();
  pkPosAttr = new THREE.BufferAttribute(pkPos, 3);
  pkPosAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pkPosAttr);
  geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  pkUniforms = {
    uPR: { value: curPR },
    uAlphaP: { value: 0 },
    uAccent: { value: uniforms.uAccent.value },
  };
  packetPoints = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      uniforms: pkUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aS;
        uniform float uPR;
        varying float vS;
        void main() {
          vS = aS;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uPR * aS * (42.0 / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAccent;
        uniform float uAlphaP;
        varying float vS;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.1, d) * uAlphaP;
          if (a < 0.004) discard;
          gl_FragColor = vec4(mix(uAccent, vec3(1.0), 0.25), a);
        }
      `,
    })
  );
  packetPoints.frustumCulled = false;
  packetPoints.visible = !ENV.reduced;
  scene.add(packetPoints);
}

function updatePackets(dt) {
  if (PACKET_N === 0) return;
  for (let i = 0; i < PACKET_N; i++) {
    const i3 = i * 3, t3 = pkTgt[i] * 3;
    const dx = cur[t3] - pkPos[i3];
    const dy = cur[t3 + 1] - pkPos[i3 + 1];
    const dz = cur[t3 + 2] - pkPos[i3 + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.15) {
      // arrived → hop to a nearby particle (keeps signals local, not laser-straight)
      for (let tries = 0; tries < 6; tries++) {
        const cand = (Math.random() * COUNT) | 0;
        const cx = cur[cand * 3] - pkPos[i3];
        const cy = cur[cand * 3 + 1] - pkPos[i3 + 1];
        const cz = cur[cand * 3 + 2] - pkPos[i3 + 2];
        pkTgt[i] = cand;
        if (cx * cx + cy * cy + cz * cz < 7.5) break;
      }
    } else {
      const step = Math.min((pkSpd[i] * dt) / d, 1);
      pkPos[i3] += dx * step;
      pkPos[i3 + 1] += dy * step;
      pkPos[i3 + 2] += dz * step;
    }
  }
  pkPosAttr.needsUpdate = true;
  pkUniforms.uPR.value = curPR;
  pkUniforms.uAlphaP.value = uniforms.uAlpha.value * 0.95;
}

/** Skills hover: -1 = none, 0..3 = ring index */
export function setHighlight(i) {
  highlightRing = i;
}

/** Work section: horizontal scroll progress (0..1) → lateral parallax */
export function setDrift(v) {
  driftX = v;
}

function resize() {
  narrow = innerWidth < 900;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  curPR = Math.min(curPR || basePR(), basePR()); // respect adaptive downgrade
  renderer.setPixelRatio(curPR);
  renderer.setSize(innerWidth, innerHeight, false);
  if (uniforms) uniforms.uPR.value = curPR;
  if (ENV.reduced && ready) renderer.render(scene, camera);
}


function updateLines(opacity) {
  lines.material.opacity = opacity;
  if (opacity < 0.01) {
    lines.visible = false;
    return;
  }
  lines.visible = true;
  const lp = linePosAttr.array;
  F.edges.forEach(([ai, bi], k) => {
    lp[k * 6] = cur[ai * 3];
    lp[k * 6 + 1] = cur[ai * 3 + 1];
    lp[k * 6 + 2] = cur[ai * 3 + 2];
    lp[k * 6 + 3] = cur[bi * 3];
    lp[k * 6 + 4] = cur[bi * 3 + 1];
    lp[k * 6 + 5] = cur[bi * 3 + 2];
  });
  linePosAttr.needsUpdate = true;
}

/* ── render loop ── */
function frame(time, deltaMS) {
  const dt = Math.min(deltaMS / 1000, 0.05);
  const { a, b, t } = morph;
  /** blend weight of formation i in the EFFECTIVE state */
  const wOf = (i) => (a === i ? 1 - t : 0) + (b === i ? t : 0);

  // Live formations: skills rings orbit, the DNA helix rotates —
  // their target arrays are recomputed only while on screen
  if (a === 2 || b === 2) computeRings(F.list[2], F.ringDyn, time, COUNT);
  if (a === 4 || b === 4) computeDNA(F.list[4], F.dnaDyn, time, COUNT);

  // Project the pointer onto the z=0 plane for particle repulsion
  const repulse = pointerActive && !ENV.low && worldFromScreen(mouseNdc.x, mouseNdc.y, mouseWorld);

  const A = F.list[a], B = F.list[b];
  const w3 = wOf(3);
  const dx = -driftX * 2.6 * w3; // dust field slides with the horizontal work scroll
  const im = intro.mix;
  const S = F.scatter;
  const R = 1.15, R2 = R * R;

  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    let tx = A[i3] + (B[i3] - A[i3]) * t + dx;
    let ty = A[i3 + 1] + (B[i3 + 1] - A[i3 + 1]) * t;
    let tz = A[i3 + 2] + (B[i3 + 2] - A[i3 + 2]) * t;

    // intro assembly: blend from the scatter cloud
    if (im < 1) {
      tx = S[i3] + (tx - S[i3]) * im;
      ty = S[i3 + 1] + (ty - S[i3 + 1]) * im;
      tz = S[i3 + 2] + (tz - S[i3 + 2]) * im;
    }

    if (ENV.mobile) {
      const s = 0.9;
      tx *= s;
      ty *= s;
      tz *= s;
    }

    // cursor pushes nearby particles aside (they spring back on their own)
    if (repulse) {
      const ddx = cur[i3] - mouseWorld.x;
      const ddy = cur[i3 + 1] - mouseWorld.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < R2) {
        const d = Math.sqrt(d2) || 0.001;
        const f = (1 - d / R) * 0.85;
        tx += (ddx / d) * f;
        ty += (ddy / d) * f;
      }
    }

    const k = damp(seekK[i], dt);
    cur[i3] += (tx - cur[i3]) * k;
    cur[i3 + 1] += (ty - cur[i3 + 1]) * k;
    cur[i3 + 2] += (tz - cur[i3 + 2]) * k;
  }
  posAttr.needsUpdate = true;

  /* camera: blend keyframes, add mouse parallax, damp everything */
  const ca = CAM[a];
  const cb = CAM[b];
  const xMul = narrow ? 0 : 1;
  const zMul = narrow ? 1.34 : 1;
  const baseX = lerp(ca.x, cb.x, t) * xMul;
  let cx = baseX, cy = lerp(ca.y, cb.y, t), cz = lerp(ca.z, cb.z, t) * zMul;
  if (!ENV.touch) {
    cx += mouseNdc.x * 0.34;
    cy += mouseNdc.y * 0.22;
  }
  const ck = damp(0.06, dt);
  camPos.x += (cx - camPos.x) * ck;
  camPos.y += (cy - camPos.y) * ck;
  camPos.z += (cz - camPos.z) * ck;
  camera.position.copy(camPos);
  // lookAt tracks the un-parallaxed x so keyframe x acts as a lateral truck
  lookAt.x += (baseX - lookAt.x) * ck;
  lookAt.y += (lerp(ca.ly, cb.ly, t) - lookAt.y) * ck;
  camera.lookAt(lookAt);
  // cinematic roll on top of the lookAt orientation
  rollCur += (lerp(ca.rz, cb.rz, t) - rollCur) * ck;
  camera.rotation.z += rollCur;

  /* uniforms — group mode follows whichever themed formation dominates */
  uniforms.uTime.value = time;
  uniforms.uAlpha.value = lerp(ca.alpha, cb.alpha, t) * (0.15 + 0.85 * im);
  uniforms.uGroupMode.value = wOf(2) > 0.5 ? 1 : wOf(4) > 0.5 ? 3 : wOf(5) > 0.5 ? 2 : 0;
  uniforms.uHighlight.value = highlightRing;

  /* lattice beams: strong at hero, with a faint echo at contact */
  updateLines((wOf(0) * 0.42 + wOf(6) * 0.13) * im);

  /* living layers */
  updatePackets(dt);

  /* HUD stats + adaptive quality governor */
  frameEMA = frameEMA * 0.95 + deltaMS * 0.05;
  stats.fps = Math.round(1000 / Math.max(frameEMA, 1));
  stats.formation = FORM_NAMES[t < 0.5 ? a : b];
  if (++frameCount % 180 === 0 && frameEMA > 26 && curPR > 1) {
    curPR = Math.max(1, curPR - 0.25); // trade sharpness for smoothness
    renderer.setPixelRatio(curPR);
    uniforms.uPR.value = curPR;
  }

  renderer.render(scene, camera);
}
