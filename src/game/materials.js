/* ════════════════════════════════════════════════════════════════
   MATERIALS — shared futuristic shaders for the whole game.

   Everything here is designed to POP under UnrealBloom: bright
   emissive-looking surfaces, holographic scanlines, pulsing edges.
   Each material exposes uTime — call tickMaterials(t) once per frame.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const timed = []; // materials that need uTime each frame

/** soft round sprite — shared by particles, sun, streaks, halos */
let spriteTex = null;
export function glowTexture() {
  if (spriteTex) return spriteTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 58);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.45, 'rgba(200,255,120,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  spriteTex = new THREE.CanvasTexture(c);
  return spriteTex;
}

function track(mat) {
  timed.push(mat);
  return mat;
}

export function tickMaterials(t) {
  for (let i = 0; i < timed.length; i++) timed[i].uniforms.uTime.value = t;
}

/* ── phosphor neon (flat emissive panels — bloom food) ── */
export function neonMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    blending: opacity < 1 ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opacity >= 1,
  });
}

/* ── holographic panel: scanlines + edge fresnel + data flicker ── */
export function holoMat(color = '#b8ff3c', opacity = 0.72) {
  const c = new THREE.Color(color);
  return track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: c }, uOpacity: { value: opacity } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec3 vN;
        varying vec3 vV;
        varying vec2 vUv;
        void main() {
          float fresnel = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
          float scan = 0.55 + 0.45 * sin(vUv.y * 80.0 - uTime * 6.0);
          float flick = step(0.92, fract(sin(vUv.x * 40.0 + uTime * 3.0) * 43758.5));
          float hex = abs(sin(vUv.x * 24.0) * sin(vUv.y * 24.0));
          vec3 col = uColor * (0.35 + fresnel * 1.4 + scan * 0.25 + flick * 0.5);
          col += uColor * hex * 0.08;
          float a = uOpacity * (0.25 + fresnel * 0.75);
          if (a < 0.02) discard;
          gl_FragColor = vec4(col, a);
        }
      `,
    })
  );
}

/* ── danger energy field (pulsing red barrier) ── */
export function dangerFieldMat() {
  const c = new THREE.Color('#ff5148');
  return track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: c } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float pulse = 0.6 + 0.4 * sin(uTime * 8.0);
          float bars = smoothstep(0.45, 0.5, abs(fract(vUv.y * 12.0 + uTime * 2.0) - 0.5));
          float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
          float a = (0.35 + bars * 0.5) * pulse * edge;
          gl_FragColor = vec4(uColor * (1.0 + bars), a);
        }
      `,
    })
  );
}

/* ── coin core — fixed gold, opaque, blooms hard against neon floor ── */
export function coinCoreMat(color = '#ffd948') {
  return track(
    new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGold: { value: new THREE.Color(color) },
      },
      depthWrite: true,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uGold;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fresnel = pow(1.0 - max(dot(vN, vV), 0.0), 1.4);
          float pulse = 0.85 + 0.15 * sin(uTime * 10.0);
          vec3 hot = mix(uGold, vec3(1.0, 0.98, 0.82), fresnel * 0.65 + 0.2);
          vec3 col = hot * (1.6 + fresnel * 0.8) * pulse;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
}

/** bright white-gold ring — reads against any zone color */
export function coinRingMat(color = '#fff4c8') {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthWrite: true,
  });
}

/* ── wireframe shell overlay (cybernetic runner outline) ── */
export function wireShellMat(color = '#37e6ff') {
  const c = new THREE.Color(color);
  return track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: c } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying float vY;
        void main() {
          vY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        varying float vY;
        void main() {
          float scan = 0.5 + 0.5 * sin(vY * 18.0 - uTime * 10.0);
          gl_FragColor = vec4(uColor * (0.8 + scan * 0.6), 0.85);
        }
      `,
    })
  );
}

/* ── speed-streak point sprite (tunnel / exhaust) ── */
export function streakMat(color = '#b8ff3c') {
  return new THREE.PointsMaterial({
    color,
    size: 0.35,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    map: glowTexture(),
    sizeAttenuation: true,
    fog: true,
  });
}

/* ── dark glass body (runner chassis) ── */
export function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x08080f,
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    emissive: 0x101020,
    emissiveIntensity: 0.55,
    envMapIntensity: 1.2,
  });
}

/* ── shield bubble (icosphere force field) ── */
export function shieldBubbleMat() {
  const c = new THREE.Color('#ffffff');
  return track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: c }, uStrength: { value: 0 } },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fresnel = pow(1.0 - max(dot(vN, vV), 0.0), 2.5);
          float hex = abs(sin(vN.x * 12.0 + uTime * 3.0) * sin(vN.y * 12.0 + uTime * 2.0));
          float a = fresnel * uStrength * (0.5 + hex * 0.5);
          gl_FragColor = vec4(uColor * (0.8 + fresnel), a);
        }
      `,
    })
  );
}

/* ── magnet pull ring ── */
export function magnetRingMat(color = '#37e6ff') {
  const c = new THREE.Color(color);
  return track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: c }, uStrength: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          float ring = smoothstep(0.42, 0.48, abs(vUv.y - 0.5));
          float spin = sin(atan(vUv.x - 0.5, vUv.y - 0.5) * 8.0 + uTime * 6.0) * 0.5 + 0.5;
          float a = ring * uStrength * (0.4 + spin * 0.6);
          gl_FragColor = vec4(uColor, a);
        }
      `,
    })
  );
}
