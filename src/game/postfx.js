/* ════════════════════════════════════════════════════════════════
   POSTFX — fullscreen grade pass after bloom.

   One cheap shader does chromatic aberration (scales with speed),
   vignette, saturation punch, and white flash on big moments.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export const gradeUniforms = {
  uAberration: { value: 0.0012 },
  uVignette: { value: 0.42 },
  uSaturation: { value: 0.88 },
  uFlash: { value: 0 },
  uTint: { value: new THREE.Color(0.96, 0.97, 1.0) },
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    ...gradeUniforms,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uFlash;
    uniform vec3 uTint;
    varying vec2 vUv;

    vec3 sat(vec3 c, float s) {
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      return mix(vec3(l), c, s);
    }

    void main() {
      vec2 uv = vUv;
      vec2 dir = uv - 0.5;
      float ab = uAberration * (1.0 + length(dir) * 1.6);

      float r = texture2D(tDiffuse, uv + dir * ab).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ab).b;
      vec3 col = vec3(r, g, b);

      col *= uTint;
      col = sat(col, uSaturation);

      float vig = smoothstep(0.72, 0.18, length(dir));
      col *= mix(1.0 - uVignette, 1.0, vig);

      col = mix(col, vec3(1.0), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createGradePass() {
  return new ShaderPass(GradeShader);
}

/** speed 0..1 → chromatic pull */
export function setAberration(speed01) {
  gradeUniforms.uAberration.value = 0.001 + speed01 * 0.0045;
}

/** brief white flash 0..1, decays each frame */
export function flashScreen(intensity = 0.35) {
  gradeUniforms.uFlash.value = Math.max(gradeUniforms.uFlash.value, intensity);
}

export function decayFlash(dt) {
  const f = gradeUniforms.uFlash.value;
  if (f > 0.001) gradeUniforms.uFlash.value = f * Math.pow(0.04, dt);
}

export function setGradeTint(color) {
  gradeUniforms.uTint.value.copy(color);
}
