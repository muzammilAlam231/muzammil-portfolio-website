/* ════════════════════════════════════════════════════════════════
   HUD — DOM overlay: score/coins/distance, power-up chips, combo,
   zone toasts, floating messages, screens and the local top-5
   leaderboard (localStorage only, no backend).
   ════════════════════════════════════════════════════════════════ */
import { WIN } from './config.js';
import { unlockCoreSkin } from '../js/skin.js';

const $ = (s) => document.querySelector(s);

const els = {};
const SCORES_KEY = 'gridrun-scores';

export function initHud() {
  els.hud = $('#hud');
  els.score = $('#hud-score');
  els.dist = $('#hud-dist');
  els.coins = $('#hud-coins');
  els.combo = $('#hud-combo');
  els.powerups = $('#hud-powerups');
  els.zoneToast = $('#zone-toast');
  els.floatMsg = $('#float-msg');
  els.demoBanner = $('#demo-banner');
  els.objChip = $('#obj-chip');
  els.start = $('#screen-start');
  els.pause = $('#screen-pause');
  els.over = $('#screen-over');
  els.win = $('#screen-win');
  els.startBest = $('#start-best');
  els.overScore = $('#over-score');
  els.overDist = $('#over-dist');
  els.overCoins = $('#over-coins');
  els.overNewBest = $('#over-newbest');
  els.leaderboard = $('#leaderboard');
  els.winScore = $('#win-score');
  els.winDist = $('#win-dist');
  els.winCoins = $('#win-coins');
  els.winSub = $('#win-sub');
  els.btnMute = $('#btn-mute');

  const best = loadScores()[0];
  els.startBest.textContent = best ? `BEST — ${best.s.toLocaleString()} PTS · ${best.d}M` : 'NO RUNS LOGGED YET';
}

export function showScreen(name) {
  els.start.classList.toggle('hidden', name !== 'start');
  els.pause.classList.toggle('hidden', name !== 'pause');
  els.over.classList.toggle('hidden', name !== 'over');
  els.win?.classList.toggle('hidden', name !== 'win');
  els.hud.classList.toggle('hidden', name === 'start');
  if (name !== 'run' && name !== 'demo') {
    els.demoBanner?.classList.add('hidden');
    els.objChip?.classList.add('hidden');
  }
}

export function setDemoBanner(on) {
  els.demoBanner?.classList.toggle('hidden', !on);
}

/* ── live numbers (cheap textContent writes each frame) ── */
export function updateHud(run, { inFinal = false, demo = false } = {}) {
  els.score.textContent = Math.floor(run.score).toLocaleString();
  els.dist.textContent = Math.floor(run.dist);
  els.coins.textContent = run.coins;
  const mult = run.multiplier;
  els.combo.textContent = mult > 1.01 ? `COMBO ×${mult.toFixed(1)}` : '';
  els.score.classList.toggle('is-hot', mult > 1.4);

  if (els.objChip) {
    if (inFinal) {
      const sOk = run.score >= WIN.score;
      els.objChip.classList.remove('hidden');
      els.objChip.textContent = `CORE CLEAR · ${Math.min(Math.floor(run.score), WIN.score).toLocaleString()}/${WIN.score.toLocaleString()} PTS${sOk ? ' · READY' : ''}`;
      els.objChip.classList.toggle('is-ready', sOk);
    } else {
      els.objChip.classList.add('hidden');
    }
  }
  setDemoBanner(demo);
}

/* ── power-up chips ── */
const chips = {};
export function setPowerupChip(kind, cfg, remaining) {
  if (remaining <= 0) {
    chips[kind]?.remove();
    delete chips[kind];
    return;
  }
  if (!chips[kind]) {
    const el = document.createElement('div');
    el.className = 'pu-chip';
    el.style.setProperty('--pu', cfg.color);
    el.innerHTML = `${cfg.label}<span class="bar"><i></i></span>`;
    els.powerups.appendChild(el);
    chips[kind] = el;
  }
  chips[kind].querySelector('i').style.transform = `scaleX(${remaining / cfg.time})`;
}
export function clearPowerupChips() {
  Object.values(chips).forEach((c) => c.remove());
  for (const k in chips) delete chips[k];
}

/* ── toasts / floating messages ── */
let zoneTimer;
export function zoneToast(text) {
  els.zoneToast.textContent = `— ENTERING ${text} —`;
  els.zoneToast.classList.add('show');
  clearTimeout(zoneTimer);
  zoneTimer = setTimeout(() => els.zoneToast.classList.remove('show'), 2200);
}

export function floatMsg(text) {
  els.floatMsg.textContent = text;
  els.floatMsg.classList.remove('pop');
  void els.floatMsg.offsetWidth; // restart the CSS animation
  els.floatMsg.classList.add('pop');
}

export function setMuteLabel(muted) {
  els.btnMute.classList.toggle('off', muted);
}

/* ── leaderboard (top 5, localStorage) ── */
function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(SCORES_KEY)) || [];
  } catch {
    return [];
  }
}

function pushScore(run) {
  const scores = loadScores();
  const entry = { s: Math.floor(run.score), d: Math.floor(run.dist), c: run.coins, t: Date.now() };
  scores.push(entry);
  scores.sort((a, b) => b.s - a.s);
  const top = scores.slice(0, 5);
  localStorage.setItem(SCORES_KEY, JSON.stringify(top));
  return { top, entry, isBest: top[0] === entry };
}

export function showGameOver(run) {
  els.overScore.textContent = Math.floor(run.score).toLocaleString();
  els.overDist.textContent = `${Math.floor(run.dist)}M`;
  els.overCoins.textContent = run.coins;

  const { top, entry, isBest } = pushScore(run);
  els.overNewBest.classList.toggle('hidden', !isBest);

  els.leaderboard.innerHTML = top
    .map((e, i) => {
      const cls = e === entry ? 'lb-row is-new' : 'lb-row';
      return `<div class="${cls}"><span>0${i + 1}</span><b>${e.s.toLocaleString()}</b><span>${e.d}M · ◈${e.c}</span></div>`;
    })
    .join('');

  showScreen('over');
}

export function showWin(run, { demo = false } = {}) {
  if (els.winScore) els.winScore.textContent = Math.floor(run.score).toLocaleString();
  if (els.winDist) els.winDist.textContent = `${Math.floor(run.dist)}M`;
  if (els.winCoins) els.winCoins.textContent = run.coins;
  if (els.winSub) {
    els.winSub.textContent = demo
      ? 'WALKTHROUGH COMPLETE · CORE SECTOR CLEARED'
      : `${WIN.score.toLocaleString()} PTS · CORE SECTOR`;
  }
  if (!demo) {
    pushScore(run);
    unlockCoreSkin();
  }
  const unlockEl = document.getElementById('win-unlock');
  if (unlockEl) {
    unlockEl.classList.toggle('hidden', demo);
    unlockEl.textContent = demo
      ? ''
      : 'PORTFOLIO SKIN UNLOCKED · TOGGLE “CORE” ON THE HOMEPAGE';
  }
  showScreen('win');
}
