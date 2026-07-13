/* ════════════════════════════════════════════════════════════════
   FORMATIONS — the 7 target shapes of the particle system.

   One pool of N particles is shared by the whole site. Each section
   has a "formation": a Float32Array of N xyz targets. Scrolling
   blends between neighbouring formations; the render loop makes
   every particle chase its blended target (see app.js).

   Index map (matches data-formation on <section> elements):
     0 hero        — lattice tower under construction (nodes + beams)
     1 about       — loose thought-nebula
     2 skills      — 4 tilted orbit rings (one per skill group)
     3 work        — sparse dust + receding grid floor (stage light-off)
     4 experience  — rotating DNA double helix (career, encoded)
     5 cloud       — 5 stacked strata (edge/compute/data/network layers)
     6 contact     — everything collapses into one bright core
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);
/** cheap approx-gaussian, mean 0 */
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.8;

/* ── 0 · HERO: lattice tower ─────────────────────────────────
   A partial 3D grid of "nodes"; leftover particles are scattered
   ALONG the edges between neighbouring nodes so the beams read as
   dotted light. Returns edge pairs for the LineSegments overlay. */
function buildLattice(count) {
  const COLS = 7, ROWS = 12, DEPS = 7, S = 0.42, KEEP = 0.62;
  const nodes = [];
  const alive = new Map(); // "x,y,z" -> node index

  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      for (let z = 0; z < DEPS; z++) {
        if (Math.random() > KEEP) continue;
        alive.set(`${x},${y},${z}`, nodes.length);
        nodes.push([
          (x - (COLS - 1) / 2) * S + gauss() * 0.02,
          (y - (ROWS - 1) / 2) * S + 0.15 + gauss() * 0.02,
          (z - (DEPS - 1) / 2) * S + gauss() * 0.02,
        ]);
      }

  // Orthogonal neighbour edges (both endpoints must exist)
  const edges = [];
  for (const [key, i] of alive) {
    const [x, y, z] = key.split(',').map(Number);
    for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
      const j = alive.get(`${x + dx},${y + dy},${z + dz}`);
      if (j !== undefined) edges.push([i, j]);
    }
  }

  const pos = new Float32Array(count * 3);
  const nodeCount = Math.min(nodes.length, count);
  for (let i = 0; i < nodeCount; i++) pos.set(nodes[i], i * 3);

  // Remaining particles live on the beams
  for (let i = nodeCount; i < count; i++) {
    const [ai, bi] = edges[(Math.random() * edges.length) | 0];
    const A = nodes[ai], B = nodes[bi];
    const t = Math.random();
    pos[i * 3] = A[0] + (B[0] - A[0]) * t + gauss() * 0.012;
    pos[i * 3 + 1] = A[1] + (B[1] - A[1]) * t + gauss() * 0.012;
    pos[i * 3 + 2] = A[2] + (B[2] - A[2]) * t + gauss() * 0.012;
  }

  // Cap line segments — enough to read as structure, cheap to draw
  const MAX_EDGES = 420;
  const lineEdges =
    edges.length <= MAX_EDGES
      ? edges
      : Array.from({ length: MAX_EDGES }, () => edges[(Math.random() * edges.length) | 0]);

  return { pos, edges: lineEdges.filter(([a, b]) => a < nodeCount && b < nodeCount) };
}

/* ── 1 · ABOUT: nebula ── */
function buildNebula(count) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = gauss() * 2.9;
    pos[i * 3 + 1] = gauss() * 1.5;
    pos[i * 3 + 2] = gauss() * 1.2 - 0.4;
  }
  return pos;
}

/* ── 2 · SKILLS: 4 orbit rings ───────────────────────────────
   Particle i belongs to ring i % 4 — the same mapping the shader
   uses for hover-highlighting (aGroup % 4). Ring rotation is
   recomputed live in app.js from the params returned here.      */
const RING_RADII = [1.5, 1.95, 2.4, 2.85];
const RING_SPEED = [0.14, -0.1, 0.08, -0.12]; // rad/s, alternating direction
const RING_TILTS = [
  [0.5, 0, 0.15],
  [-0.35, 0.4, -0.1],
  [0.2, -0.5, 0.3],
  [-0.15, 0.25, -0.35],
];
const RING_CENTER = new THREE.Vector3(0, 0.1, -0.3);

function buildRings(count) {
  const a0 = new Float32Array(count);
  const rJ = new Float32Array(count);
  const yJ = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    a0[i] = rand(0, Math.PI * 2);
    rJ[i] = gauss() * 0.07;
    yJ[i] = gauss() * 0.05;
  }
  const mats = RING_TILTS.map((e) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...e)));
  const dyn = { radii: RING_RADII, speed: RING_SPEED, mats, a0, rJ, yJ, center: RING_CENTER };

  const pos = new Float32Array(count * 3);
  computeRings(pos, dyn, 0, count);
  return { pos, dyn };
}

/** Fills `out` with ring positions at time `time` — reused every frame while skills is on screen */
export function computeRings(out, dyn, time, count) {
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const g = i % 4;
    const ang = dyn.a0[i] + time * dyn.speed[g];
    const r = dyn.radii[g] + dyn.rJ[i];
    v.set(Math.cos(ang) * r, dyn.yJ[i], Math.sin(ang) * r).applyMatrix4(dyn.mats[g]).add(dyn.center);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
}

/* ── 3 · WORK: dust + grid floor ── */
function buildDust(count) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    if (i % 5 < 4) {
      // snapped to a loose floor grid → reads as a stage receding into dark
      pos[i * 3] = Math.round(rand(-6, 6) / 0.4) * 0.4 + gauss() * 0.03;
      pos[i * 3 + 1] = -1.75 + gauss() * 0.02;
      pos[i * 3 + 2] = Math.round(rand(-4.5, 1) / 0.4) * 0.4 + gauss() * 0.03;
    } else {
      // floating dust
      pos[i * 3] = rand(-5.5, 5.5);
      pos[i * 3 + 1] = rand(-1, 2.6);
      pos[i * 3 + 2] = rand(-4, 0.5);
    }
  }
  return pos;
}

/* ── 4 · EXPERIENCE: DNA double helix ────────────────────────
   The career path rendered as genetics: two phase-shifted
   strands plus quantized base-pair "rungs" spanning them.
   It rotates live — app.js re-runs computeDNA with a time-based
   phase while the section is on screen. Rung particles are the
   i%4==3 group, which the shader tints accent (uGroupMode 3).  */
const DNA = {
  height: 6.8,
  radius: 0.62,
  twists: 2.6, // full turns over the height
  z: -1.5,
  rungs: 26, // base pairs
};

function buildDNA(count) {
  const kind = new Uint8Array(count); // 0/1 = strand, 2 = rung
  const u = new Float32Array(count); // strand: 0..1 along height · rung: rung index
  const s = new Float32Array(count); // rung: -1..1 across · strand: radial jitter
  const j = new Float32Array(count); // per-particle jitter
  for (let i = 0; i < count; i++) {
    j[i] = gauss() * 0.04;
    if (i % 4 === 3) {
      kind[i] = 2;
      u[i] = (Math.random() * DNA.rungs) | 0;
      s[i] = rand(-1, 1);
    } else {
      kind[i] = i % 2;
      u[i] = Math.random();
      s[i] = gauss() * 0.05;
    }
  }
  const dyn = { kind, u, s, j };
  const pos = new Float32Array(count * 3);
  computeDNA(pos, dyn, 0, count);
  return { pos, dyn };
}

/** Fills `out` with helix positions at time `time` — cheap enough to run per frame */
export function computeDNA(out, dyn, time, count) {
  const totalAng = DNA.twists * Math.PI * 2;
  const phase = time * 0.35; // slow, stately rotation
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (dyn.kind[i] === 2) {
      // base pair: a straight bar between the two strands
      const rt = (dyn.u[i] + 0.5) / DNA.rungs;
      const ang = rt * totalAng + phase;
      x = Math.cos(ang) * DNA.radius * dyn.s[i];
      y = (rt - 0.5) * DNA.height;
      z = Math.sin(ang) * DNA.radius * dyn.s[i] + DNA.z;
    } else {
      // strand: kind 1 is phase-shifted half a turn from kind 0
      const t = dyn.u[i];
      const ang = t * totalAng + phase + dyn.kind[i] * Math.PI;
      const r = DNA.radius + dyn.s[i];
      x = Math.cos(ang) * r;
      y = (t - 0.5) * DNA.height;
      z = Math.sin(ang) * r + DNA.z;
    }
    out[i * 3] = x + dyn.j[i];
    out[i * 3 + 1] = y + dyn.j[i] * 0.6;
    out[i * 3 + 2] = z;
  }
}

/* ── 5 · CLOUD: stacked strata ── */
function buildStrata(count) {
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const layer = i % 5;
    const ang = rand(0, Math.PI * 2);
    const rr = Math.sqrt(Math.random()) * 2.3;
    pos[i * 3] = Math.cos(ang) * rr * 1.4;
    pos[i * 3 + 1] = -1.25 + layer * 0.62 + gauss() * 0.035;
    pos[i * 3 + 2] = Math.sin(ang) * rr * 0.85 - 0.3;
  }
  return pos;
}

/* ── 6 · CONTACT: bright core + faint lattice echo (bookend) ── */
function buildCore(count, latticePos) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    if (i % 5 < 4) {
      v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(0.85 + gauss() * 0.13);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    } else {
      // 20% of particles echo the hero structure, enlarged — start and end rhyme
      pos[i * 3] = latticePos[i * 3] * 1.6;
      pos[i * 3 + 1] = latticePos[i * 3 + 1] * 1.6;
      pos[i * 3 + 2] = latticePos[i * 3 + 2] * 1.6;
    }
  }
  return pos;
}

/* ── Initial scatter (pre-assembly, during preloader) ── */
function buildScatter(count) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(rand(4, 9));
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  return pos;
}

export function buildFormations(count) {
  const lattice = buildLattice(count);
  const rings = buildRings(count);
  const dna = buildDNA(count);
  return {
    list: [
      lattice.pos,
      buildNebula(count),
      rings.pos,
      buildDust(count),
      dna.pos,
      buildStrata(count),
      buildCore(count, lattice.pos),
    ],
    edges: lattice.edges,
    ringDyn: rings.dyn,
    dnaDyn: dna.dyn,
    scatter: buildScatter(count),
  };
}
