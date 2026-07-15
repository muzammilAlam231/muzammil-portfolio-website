/* ════════════════════════════════════════════════════════════════
   GRID RUN — main game loop + state machine.

   States: start | run | demo | pause | over | win

   CORE LOOP (each frame while running):
   1. speed ramps with distance → dz = meters travelled this frame
   2. world treadmill + spawner advance by dz
   3. player controller integrates (lanes / jump / slide) — or bot
   4. physics resolves hits, coins, power-ups, near-misses
   5. scoring: distance pts × combo multiplier × (×2 power-up)
   6. CORE SECTOR + score/coins gates → win
   ════════════════════════════════════════════════════════════════ */
import { RUN, SPAWN, POWERUPS, COMBO, REDUCED, COLORS, WIN, DEMO, ZONES } from './config.js';
import { initEngine, engine, updateCamera, shake, slowMo, setBloomPulse } from './engine.js';
import { initWorld, updateWorld, resetWorld, world } from './world.js';
import { initEffects, updateEffects, burstFX, setTrailColor, shockwave } from './effects.js';
import { initPlayer, updatePlayer, resetPlayer, player, moveLane, tryJump, trySlide, killPlayer, shieldSave, updatePowerVisuals } from './player.js';
import { initSpawner, resetSpawner, updateSpawner } from './spawner.js';
import { checkCollisions } from './physics.js';
import { initInput, on } from './input.js';
import { unlockAudio, toggleMute, isMuted, sfx, startBgm, updateBgm, pauseBgm, resumeBgm, stopBgm } from './audio.js';
import { setAberration, flashScreen } from './postfx.js';
import { updateBot, resetBot } from './bot.js';
import * as hud from './hud.js';
import '../styles/game.css';
import { trackPageview } from '../js/analytics.js';

let state = 'start'; // start | run | demo | pause | over | win
let demo = false;
let pausedFrom = 'run';

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

function inFinalSector() {
  return !!ZONES[world.zoneIndex]?.final;
}

function canWin() {
  return inFinalSector() && run.score >= WIN.score && run.coins >= WIN.coins;
}

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
  if (state !== 'run' && state !== 'demo') return;
  hud.zoneToast(zone.name);
  sfx.zone();
  setTrailColor(world.accent);
  if (zone.final) hud.floatMsg('CORE SECTOR — CLEAR THE OBJECTIVE');
};

/* ── input wiring ── */
let inputGrace = 0;
const ok = () => state === 'run' && !demo && performance.now() > inputGrace;
on('left', () => ok() && moveLane(-1, run.runTime));
on('right', () => ok() && moveLane(1, run.runTime));
on('jump', () => ok() && tryJump());
on('slide', () => ok() && trySlide());
on('pause', () => {
  if (demo) {
    stopDemoToMenu();
    return;
  }
  togglePause();
});
on('any', () => {
  unlockAudio();
  if (state === 'start') startRun(false);
  else if (state === 'demo') stopDemoToMenu();
});

document.getElementById('screen-start').addEventListener('pointerdown', (e) => {
  if (e.target.closest('a') || e.target.closest('button')) return;
  unlockAudio();
  if (state === 'start') startRun(false);
});

function wireDemoBtn(id) {
  document.getElementById(id)?.addEventListener('click', (e) => {
    e.stopPropagation();
    unlockAudio();
    startRun(true);
  });
}
wireDemoBtn('btn-demo');
wireDemoBtn('btn-demo-over');
wireDemoBtn('btn-demo-win');

addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') hud.setMuteLabel(toggleMute());
  if (e.code === 'KeyR' && (state === 'over' || state === 'win')) restart();
  if (e.code === 'Escape' && state === 'demo') stopDemoToMenu();
});
document.getElementById('btn-mute').addEventListener('click', () => hud.setMuteLabel(toggleMute()));
document.getElementById('btn-pause').addEventListener('click', () => {
  if (demo) stopDemoToMenu();
  else togglePause();
});
document.getElementById('btn-again')?.addEventListener('click', restart);
document.getElementById('btn-win-again')?.addEventListener('click', restart);
document.getElementById('screen-pause').addEventListener('pointerdown', (e) => {
  if (e.target.closest('a')) return;
  togglePause();
});
document.getElementById('hud')?.addEventListener('pointerdown', () => {
  if (state === 'demo') stopDemoToMenu();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (state === 'run' || state === 'demo')) {
    if (demo) return; // keep demo running in background briefly — still pause for fairness
    togglePause();
  }
});

/* ── state transitions ── */
function startRun(asDemo = false) {
  demo = asDemo;
  resetRun();
  state = demo ? 'demo' : 'run';
  inputGrace = performance.now() + 280;
  hud.showScreen('run');
  hud.setDemoBanner(demo);
  startBgm();
  if (demo) hud.floatMsg('WALKTHROUGH · BOT CANNOT DIE');
}

function restart() {
  startRun(false);
}

function stopDemoToMenu() {
  demo = false;
  stopBgm();
  resetRun();
  state = 'start';
  hud.setDemoBanner(false);
  hud.showScreen('start');
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
  resetBot();
  hud.clearPowerupChips();
  hud.updateHud(run, { inFinal: false, demo: false });
}

function togglePause() {
  if (state === 'run' || state === 'demo') {
    pausedFrom = state;
    state = 'pause';
    hud.showScreen('pause');
    pauseBgm();
  } else if (state === 'pause') {
    state = pausedFrom;
    inputGrace = performance.now() + 280;
    hud.showScreen('run');
    hud.setDemoBanner(demo);
    resumeBgm();
  }
}

function die() {
  if (state !== 'run' && state !== 'demo') return;
  const wasDemo = demo;
  state = 'over';
  demo = false;
  stopBgm();
  killPlayer();
  shake(1.3);
  slowMo(0.22, 0.55);
  setTimeout(() => {
    if (wasDemo) {
      // Keep the walkthrough going after a bot crash
      startRun(true);
      return;
    }
    hud.showGameOver(run);
  }, REDUCED ? 200 : 950);
}

function winRun() {
  if (state !== 'run' && state !== 'demo') return;
  const wasDemo = demo;
  state = 'win';
  demo = false;
  stopBgm();
  sfx.zone();
  flashScreen(0.35);
  hud.floatMsg('CORE CLEARED');
  setTimeout(() => hud.showWin(run, { demo: wasDemo }), REDUCED ? 200 : 700);
}

/* ── collision event handlers ── */
const events = {
  onHit(o) {
    // Walkthrough bot never dies — still plays from score 0 at normal speed
    if (demo && DEMO.invulnerable) {
      o.ghost = true;
      return;
    }
    if (run.power.shield > 0) {
      o.ghost = true;
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

  const playing = state === 'run' || state === 'demo';

  run.speed = Math.min(RUN.baseSpeed + run.dist * RUN.accelPerMeter, RUN.maxSpeed);
  const dz = (playing ? run.speed : run.speed * 0.3) * dt;

  if (playing) {
    engine.attractMode = false;
    run.runTime += dt;
    run.dist += dz;
    const coreBonus = inFinalSector() ? 1.35 : 1;
    run.score += dz * run.multiplier * coreBonus;

    // Help the walkthrough gather data bits (same coin value when collected)
    if (demo && DEMO.magnet) {
      run.power.magnet = Math.max(run.power.magnet, 2);
    }

    if (run.comboT > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) {
        run.combo = 0;
        run.coinStreak = 0;
      }
    }

    for (const kind in run.power) {
      if (run.power[kind] > 0) {
        run.power[kind] -= dt;
        hud.setPowerupChip(kind, POWERUPS[kind], run.power[kind]);
      }
    }

    engine.fovKick = Math.min(1, (run.speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed));
  }

  const tier = Math.min(Math.floor(run.dist / SPAWN.tierEvery), 5);
  updateWorld(dt, dz, run.dist, run.speed);
  updateSpawner(dz, dt, run.dist, tier, player, run.power.magnet > 0);

  if (playing && demo) updateBot(dt, run.runTime, run.speed);
  updatePlayer(dt, run.speed);

  if (playing) {
    checkCollisions(player, run.runTime, events);
    hud.updateHud(run, { inFinal: inFinalSector(), demo });
    updateBgm(run.score);
    updatePowerVisuals(run.power);

    if (canWin()) winRun();
  }

  const speed01 = Math.min(1, (run.speed - RUN.baseSpeed) / (RUN.maxSpeed - RUN.baseSpeed));
  setAberration(speed01);
  setBloomPulse(speed01);

  updateEffects(dt, dz, run.speed);
  updateCamera(dt, player, run.speed);
};
