/* ════════════════════════════════════════════════════════════════
   ENGINE — renderer, bloom + grade pipeline, camera feel.
   ════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COLORS, LOW, REDUCED } from './config.js';
import { createGradePass, decayFlash } from './postfx.js';

export const engine = {
  renderer: null,
  scene: null,
  camera: null,
  timeScale: 1,
  elapsed: 0,
  onFrame: null,
  attractMode: true,
  fovBase: 64,
  fovKick: 0,
  shakeAmp: 0,
};

let composer = null;
let bloomPass = null;
let bloomOn = false;
let fpsEMA = 16.7;

export function initEngine() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !LOW,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1 : 1.85));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(COLORS.bg, 0.014);

  const camera = new THREE.PerspectiveCamera(engine.fovBase, innerWidth / innerHeight, 0.1, 320);
  camera.position.set(0, 3.5, 7.4);

  engine.renderer = renderer;
  engine.scene = scene;
  engine.camera = camera;

  if (!LOW) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(devicePixelRatio, 1.85));
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      0.9,
      0.78,
      0.48
    );
    composer.addPass(bloomPass);
    composer.addPass(createGradePass());
    composer.addPass(new OutputPass());
    bloomOn = true;
  }

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    composer?.setSize(innerWidth, innerHeight);
  });

  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    const rawDt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const dt = rawDt * engine.timeScale;
    engine.elapsed += dt;
    engine.onFrame?.(dt, rawDt);
    decayFlash(rawDt);

    fpsEMA = fpsEMA * 0.96 + rawDt * 1000 * 0.04;
    if (bloomOn && engine.elapsed > 8 && fpsEMA > 24) {
      bloomOn = false;
      if (bloomPass) bloomPass.strength = 0.75;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.2));
    }

    if (bloomOn && composer) composer.render();
    else renderer.render(scene, camera);
  };
  requestAnimationFrame(loop);
}

const camTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3(0, 1.15, -9);

export function updateCamera(dt, player, speed = 14) {
  const cam = engine.camera;
  const k = 1 - Math.pow(0.0001, dt);
  const speed01 = Math.min((speed - 14) / 18, 1);

  camTarget.set(player.x * 0.52, 3.45 + player.y * 0.35, 7.2 - speed01 * 0.6);
  if (engine.attractMode) {
    camTarget.x += Math.sin(engine.elapsed * 0.35) * 1.6;
    camTarget.y += 0.45 + Math.sin(engine.elapsed * 0.22) * 0.28;
  }
  cam.position.lerp(camTarget, k);

  lookTarget.x += (player.x * 0.68 - lookTarget.x) * k;
  lookTarget.y += (1.1 + player.y * 0.45 - lookTarget.y) * k;
  lookTarget.z += (-9 - speed01 * 2 - lookTarget.z) * k * 0.3;
  cam.lookAt(lookTarget);

  cam.rotation.z += player.lean * 0.42;

  if (!REDUCED) {
    const fov = engine.fovBase + engine.fovKick * 14 + speed01 * 3;
    cam.fov += (fov - cam.fov) * k;
    cam.updateProjectionMatrix();
  }

  if (engine.shakeAmp > 0.001 && !REDUCED) {
    const t = engine.elapsed * 60;
    cam.position.x += Math.sin(t * 1.7) * engine.shakeAmp * 0.14;
    cam.position.y += Math.cos(t * 2.3) * engine.shakeAmp * 0.1;
    cam.rotation.z += Math.sin(t * 1.1) * engine.shakeAmp * 0.025;
    engine.shakeAmp *= Math.pow(0.02, dt);
  }
}

export function shake(amp) {
  if (!REDUCED) engine.shakeAmp = Math.max(engine.shakeAmp, amp);
}

export function slowMo(scale, realSeconds) {
  if (REDUCED) return;
  engine.timeScale = scale;
  setTimeout(() => (engine.timeScale = 1), realSeconds * 1000);
}

/** bloom breathes with speed */
export function setBloomPulse(speed01) {
  if (!bloomPass || !bloomOn) return;
  bloomPass.strength = 0.82 + speed01 * 0.18;
}
