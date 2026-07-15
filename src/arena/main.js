/* ════════════════════════════════════════════════════════════════
   NEON ARENA — main loop + state machine
   States: start | fight | pause | between | win | lose
   ════════════════════════════════════════════════════════════════ */
import '../styles/arena.css';
import { BOSSES } from './config.js';
import { initRender, render, shake, burst, clearParticles } from './render.js';
import { createPlayer, resetPlayer, updatePlayer } from './player.js';
import { createBoss, updateBoss } from './bosses.js';
import { initInput, onInput, consume, clearPressed, showTouchPad } from './input.js';
import { unlockAudio, toggleMute, isMuted, sfx } from './audio.js';
import { trackPageview } from '../js/analytics.js';

let state = 'start';
let bossIndex = 0;
let player = createPlayer();
let boss = null;
let last = 0;
let toastT = 0;

const $ = (s) => document.querySelector(s);

const screens = {
  start: $('#screen-start'),
  pause: $('#screen-pause'),
  between: $('#screen-between'),
  lose: $('#screen-lose'),
  win: $('#screen-win'),
};

initRender();
initInput();
updateMuteLabel();
showScreen('start');
trackPageview('/fight.html');

function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle('hidden', k !== name);
  });
  const hud = $('#hud');
  const fighting = name === null;
  if (hud) hud.classList.toggle('hidden', !fighting);
  showTouchPad(fighting);
}

function showHud(on) {
  $('#hud')?.classList.toggle('hidden', !on);
  showTouchPad(on);
  Object.values(screens).forEach((el) => el?.classList.add('hidden'));
}

function updateMuteLabel() {
  const btn = $('#btn-mute');
  if (btn) btn.textContent = isMuted() ? 'MUTE' : 'SND';
}

function updateHud() {
  const hpP = $('#hp-player');
  const stP = $('#stamina-player');
  const hpB = $('#hp-boss');
  if (hpP) hpP.style.width = `${(player.hp / player.maxHp) * 100}%`;
  if (stP) stP.style.width = `${(player.stamina / player.maxStamina) * 100}%`;
  if (boss && hpB) hpB.style.width = `${(boss.hp / boss.maxHp) * 100}%`;
  const name = BOSSES[bossIndex]?.name || '';
  const bn = $('#boss-name');
  const bl = $('#boss-label');
  const num = $('#boss-num');
  if (bn) bn.textContent = name;
  if (bl) bl.textContent = name;
  if (num) num.textContent = `${String(bossIndex + 1).padStart(2, '0')} / 03`;
}

function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  toastT = 1.4;
}

function startFight(fromBoss = 0) {
  bossIndex = fromBoss;
  resetPlayer(player);
  boss = createBoss(bossIndex);
  clearParticles();
  clearPressed();
  state = 'fight';
  showHud(true);
  updateHud();
  toast(BOSSES[bossIndex].name);
  unlockAudio();
}

function onBossDown() {
  sfx.win();
  shake(12, 0.4);
  burst(boss.x, boss.y - boss.h / 2, boss.color, 24);
  if (bossIndex >= BOSSES.length - 1) {
    state = 'win';
    showScreen('win');
    showTouchPad(false);
    $('#hud')?.classList.add('hidden');
    return;
  }
  state = 'between';
  const next = BOSSES[bossIndex + 1];
  const msg = $('#between-msg');
  if (msg) msg.textContent = `NEXT: ${next.name}`;
  showScreen('between');
  showTouchPad(false);
  $('#hud')?.classList.add('hidden');
}

function onPlayerDown() {
  state = 'lose';
  const msg = $('#lose-msg');
  if (msg) msg.textContent = `Taken down by ${BOSSES[bossIndex].name}`;
  showScreen('lose');
  showTouchPad(false);
  $('#hud')?.classList.add('hidden');
}

function tryStartFromOverlay() {
  if (state === 'start') {
    unlockAudio();
    startFight(0);
  } else if (state === 'between') {
    unlockAudio();
    startFight(bossIndex + 1);
  } else if (state === 'pause') {
    state = 'fight';
    showHud(true);
  }
}

// Overlay / button wiring
$('#screen-start')?.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a')) return;
  tryStartFromOverlay();
});
$('#screen-between')?.addEventListener('pointerdown', tryStartFromOverlay);
$('#screen-pause')?.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a')) return;
  tryStartFromOverlay();
});

window.addEventListener('keydown', (e) => {
  if (['start', 'between'].includes(state)) {
    if (e.code === 'Space' || e.key.length === 1 || e.code.startsWith('Key') || e.code.startsWith('Arrow')) {
      e.preventDefault();
      tryStartFromOverlay();
    }
  }
  if (state === 'fight' && e.code === 'KeyP') {
    state = 'pause';
    showScreen('pause');
    showTouchPad(false);
    $('#hud')?.classList.add('hidden');
  } else if (state === 'pause' && e.code === 'KeyP') {
    tryStartFromOverlay();
  }
  if ((state === 'lose' || state === 'win') && e.code === 'KeyR') {
    startFight(0);
  }
});

onInput((type, act) => {
  if (type !== 'down') return;
  if (act === 'pause' && state === 'fight') {
    state = 'pause';
    showScreen('pause');
    showTouchPad(false);
    $('#hud')?.classList.add('hidden');
  } else if (act === 'pause' && state === 'pause') {
    tryStartFromOverlay();
  } else if (act === 'retry' && (state === 'lose' || state === 'win')) {
    startFight(0);
  }
});

$('#btn-mute')?.addEventListener('click', () => {
  unlockAudio();
  toggleMute();
  updateMuteLabel();
});
$('#btn-pause')?.addEventListener('click', () => {
  if (state === 'fight') {
    state = 'pause';
    showScreen('pause');
    showTouchPad(false);
    $('#hud')?.classList.add('hidden');
  }
});
$('#btn-retry')?.addEventListener('click', () => startFight(0));
$('#btn-again')?.addEventListener('click', () => startFight(0));

function frame(t) {
  const dt = Math.min(0.033, (t - last) / 1000 || 0.016);
  last = t;

  if (toastT > 0) {
    toastT -= dt;
    if (toastT <= 0) $('#toast')?.classList.remove('show');
  }

  if (state === 'fight' && player && boss) {
    const prevBossHp = boss.hp;
    const prevPlayerHp = player.hp;

    updatePlayer(player, boss, dt);
    updateBoss(boss, player, dt);

    if (boss.hp < prevBossHp) {
      shake(6, 0.15);
      burst(boss.x, boss.y - boss.h * 0.5, boss.color, 8);
    }
    if (player.hp < prevPlayerHp) {
      shake(8, 0.2);
      burst(player.x, player.y - player.h * 0.5, player.color, 8);
    }

    updateHud();

    if (boss.dead && state === 'fight') onBossDown();
    else if (player.dead && state === 'fight') onPlayerDown();
  }

  // Attract / fight render
  if (state === 'start') {
    render(null, null, dt);
  } else {
    render(player, boss, dt);
  }

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
