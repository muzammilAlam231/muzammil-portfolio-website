/* ════════════════════════════════════════════════════════════════
   GRID RUN — main game loop + state machine.

   States: start (attract mode) → run → over  (+ pause)

   CORE LOOP (each frame while running):
   1. speed ramps with distance → dz = meters travelled this frame
   2. world treadmill + spawner advance by dz
   3. player controller integrates (lanes / jump / slide)
   4. physics resolves hits, coins, power-ups, near-misses
   5. scoring: distance pts × combo multiplier × (×2 power-up)
   6. camera/effects/HUD read the results

   Difficulty pacing lives in config.js + spawner.js templates.
   ════════════════════════════════════════════════════════════════ */
import { RUN, SPAWN, POWERUPS, COMBO, REDUCED, COLORS } from './config.js';
import { initEngine, engine, updateCamera, shake, slowMo, setBloomPulse } from './engine.js';
import { initWorld, updateWorld, resetWorld, world } from './world.js';
import { initEffects, updateEffects, burstFX, setTrailColor, shockwave } from './effects.js';
import { initPlayer, updatePlayer, resetPlayer, player, moveLane, tryJump, trySlide, killPlayer, shieldSave, updatePowerVisuals } from './player.js';
import { initSpawner, resetSpawner, updateSpawner } from './spawner.js';
import { checkCollisions } from './physics.js';
import { initInput, on } from './input.js';
import { unlockAudio, toggleMute, isMuted, sfx, startBgm, updateBgm, pauseBgm, resumeBgm, stopBgm } from './audio.js';
import { setAberration, flashScreen } from './postfx.js';
import * as hud from './hud.js';
import '../styles/game.css';
import { trackPageview } from '../js/analytics.js';

let state = 'start'; // start | run | pause | over

const run = {
  dist: 0,
  score: 0,
  coins: 0,
  coinStreak: 0,
  combo: 0,
  comboT: 0,
  runTime: 0,
  speed: RUN.baseSpeed,
  power: { magnet: 0, shield: 0, multi: 0 },
  get multiplier() {
    const comboMult = 1 + Math.min(this.combo, COMBO.maxSteps) * COMBO.stepBonus;
    return comboMult * (this.power.multi > 0 ? 2 : 1);
  },
};

/* ── boot ── */
initEngine();
initWorld(engine.scene);
initEffects(engine.scene);
initPlayer(engine.scene);
initSpawner(engine.scene);
initInput();
hud.initHud();
hud.setMuteLabel(isMuted());
hud.showScreen('start');
trackPageview('/play.html');

world.onZoneChange = (zone) => {
  if (state !== 'run') return;
  hud.zoneToast(zone.name);
  sfx.zone();
  setTrailColor(world.accent);
};

/* ── input wiring ──
   inputGrace: the tap/keypress that starts or resumes the game must
   not ALSO steer the player one frame later (touchend fires after
   pointerdown), so actions are ignored for a beat after transitions */
let inputGrace = 0;
const ok = () => state === 'run' && performance.now() > inputGrace;
on('left', () => ok() && moveLane(-1, run.runTime));
on('right', () => ok() && moveLane(1, run.runTime));
on('jump', () => ok() && tryJump());
on('slide', () => ok() && trySlide());
on('pause', togglePause);
on('any', () => {
  unlockAudio();
  if (state === 'start') startRun();
});
// mouse users: click the start screen to begin
document.getElementById('screen-start').addEventListener('pointerdown', (e) => {
  if (e.target.closest('a')) return;
  unlockAudio();
  if (state === 'start') startRun();
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') hud.setMuteLabel(toggleMute());
  if (e.code === 'KeyR' && state === 'over') restart();
});
document.getElementById('btn-mute').addEventListener('click', () => hud.setMuteLabel(toggleMute()));
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-again').addEventListener('click', restart);
document.getElementById('screen-pause').addEventListener('pointerdown', (e) => {
  if (e.target.closest('a')) return;
  togglePause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'run') togglePause();
});

/* ── state transitions ── */
function startRun() {
  resetRun();
  state = 'run';
  inputGrace = performance.now() + 280;
  hud.showScreen('run');
  startBgm();
}

function restart() {
  resetRun();
  state = 'run';
  inputGrace = performance.now() + 280;
  hud.showScreen('run');
  startBgm();
}

function resetRun() {
  run.dist = 0;
  run.score = 0;
  run.coins = 0;
  run.coinStreak = 0;
  run.combo = 0;
  run.comboT = 0;
  run.runTime = 0;
  run.speed = RUN.baseSpeed;
  run.power.magnet = run.power.shield = run.power.multi = 0;
  engine.timeScale = 1;
  engine.fovKick = 0;
  resetPlayer();
  resetWorld();
  resetSpawner();
  hud.clearPowerupChips();
  hud.updateHud(run);
}

function togglePause() {
  if (state === 'run') {
    state = 'pause';
    hud.showScreen('pause');
    pauseBgm();
  } else if (state === 'pause') {
    state = 'run';
    inputGrace = performance.now() + 280;
    hud.showScreen('run');
    resumeBgm();
  }
}

function die() {
  if (state !== 'run') return;
  state = 'over';
  stopBgm();
  killPlayer();
  shake(1.3);
  slowMo(0.22, 0.55);
  // let the tumble play out, then show the summary
  setTimeout(() => hud.showGameOver(run), REDUCED ? 200 : 950);
}

/* ── collision event handlers ── */
const events = {
  onHit(o) {
    if (run.power.shield > 0) {
      o.ghost = true; // shield eats this obstacle
      shieldSave();
      shake(0.5);
      hud.floatMsg('SHIELD ABSORBED IT');
      return;
    }
    die();
  },
  onCoin(c) {
    run.coins++;
    run.coinStreak++;
    bumpCombo();
    run.score += SPAWN.coinValue * run.multiplier;
    sfx.coin(run.coinStreak);
    flashScreen(0.025 + Math.min(run.coinStreak, 8) * 0.004);
    shockwave(c.x, c.z, COLORS.coin);
    burstFX({ x: c.x, y: c.y, z: c.z, color: COLORS.coin, n: 10, speed: 4, up: 2, lifeS: 0.45, sizeMul: 0.9 });
  },
  onPower(p) {
    const cfg = POWERUPS[p.kind];
    run.power[p.kind] = cfg.time;
    sfx.power();
    flashScreen(0.22);
    hud.floatMsg(`${cfg.label} ONLINE`);
    burstFX({ x: p.x, y: p.y, z: p.z, color: cfg.color, n: 22, speed: 6, up: 3, lifeS: 0.85, sizeMul: 1.3 });
  },
  onNearMiss() {
    bumpCombo();
    run.score += 50 * run.multiplier;
    sfx.near();
    hud.floatMsg('NEAR MISS +50');
  },
};

function bumpCombo() {
  run.combo++;
  run.comboT = COMBO.decay;
}

/* ── the frame ── */
engine.onFrame = (dt) => {
  if (state === 'pause') return;

  if (state === 'start') {
    engine.attractMode = true;
    const dz = RUN.attractSpeed * dt;
    updateWorld(dt, dz, 0, RUN.attractSpeed);
    updatePlayer(dt, RUN.attractSpeed);
    updateEffects(dt, dz);
    updateCamera(dt, player, RUN.attractSpeed);
    return;
  }

  /* run + over states share the treadmill (the world keeps rushing
     past the tumbling bot for a beat after death) */
  const alive = state === 'run';
  run.speed = Math.min(RUN.baseSpeed + run.dist * RUN.accelPerMeter, RUN.maxSpeed);
  const dz = (alive ? run.speed : run.speed * 0.3) * dt;

  if (alive) {
    engine.attractMode = false;
    run.runTime += dt;
    run.dist += dz;
    run.score += dz * run.multiplier; // distance points
    engine.fovKick = (run.speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed);

    /* combo decay */
    if (run.comboT > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) {
        run.combo = 0;
        run.coinStreak = 0;
      }
    }

    /* power-up timers */
    for (const kind in run.power) {
      if (run.power[kind] > 0) {
        run.power[kind] -= dt;
        hud.setPowerupChip(kind, POWERUPS[kind], run.power[kind]);
      }
    }
  }

  const tier = Math.min(Math.floor(run.dist / SPAWN.tierEvery), 5);
  updateWorld(dt, dz, run.dist, run.speed);
  updateSpawner(dz, dt, run.dist, tier, player, run.power.magnet > 0);
  updatePlayer(dt, run.speed);

  if (alive) {
    checkCollisions(player, run.runTime, events);
    hud.updateHud(run);
    updateBgm(run.score);
  }

  const speed01 = (run.speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed);
  setAberration(speed01);
  setBloomPulse(speed01);

  if (alive) {
    updatePowerVisuals(run.power);
  }

  updateEffects(dt, dz, run.speed);
  updateCamera(dt, player, run.speed);
};
