/* ════════════════════════════════════════════════════════════════
   HUD — DOM overlay: score/coins/distance, power-up chips, combo,
   zone toasts, floating messages, screens and the local top-5
   leaderboard (localStorage only, no backend).
   ════════════════════════════════════════════════════════════════ */

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
  els.start = $('#screen-start');
  els.pause = $('#screen-pause');
  els.over = $('#screen-over');
  els.startBest = $('#start-best');
  els.overScore = $('#over-score');
  els.overDist = $('#over-dist');
  els.overCoins = $('#over-coins');
  els.overNewBest = $('#over-newbest');
  els.leaderboard = $('#leaderboard');
  els.btnMute = $('#btn-mute');

  const best = loadScores()[0];
  els.startBest.textContent = best ? `BEST — ${best.s.toLocaleString()} PTS · ${best.d}M` : 'NO RUNS LOGGED YET';
}

export function showScreen(name) {
  els.start.classList.toggle('hidden', name !== 'start');
  els.pause.classList.toggle('hidden', name !== 'pause');
  els.over.classList.toggle('hidden', name !== 'over');
  els.hud.classList.toggle('hidden', name === 'start');
}

/* ── live numbers (cheap textContent writes each frame) ── */
export function updateHud(run) {
  els.score.textContent = Math.floor(run.score).toLocaleString();
  els.dist.textContent = Math.floor(run.dist);
  els.coins.textContent = run.coins;
  const mult = run.multiplier;
  els.combo.textContent = mult > 1.01 ? `COMBO ×${mult.toFixed(1)}` : '';
  els.score.classList.toggle('is-hot', mult > 1.4);
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

export function showGameOver(run) {
  els.overScore.textContent = Math.floor(run.score).toLocaleString();
  els.overDist.textContent = `${Math.floor(run.dist)}M`;
  els.overCoins.textContent = run.coins;

  const scores = loadScores();
  const entry = { s: Math.floor(run.score), d: Math.floor(run.dist), c: run.coins, t: Date.now() };
  scores.push(entry);
  scores.sort((a, b) => b.s - a.s);
  const top = scores.slice(0, 5);
  localStorage.setItem(SCORES_KEY, JSON.stringify(top));

  const isBest = top[0] === entry;
  els.overNewBest.classList.toggle('hidden', !isBest);

  els.leaderboard.innerHTML = top
    .map((e, i) => {
      const cls = e === entry ? 'lb-row is-new' : 'lb-row';
      return `<div class="${cls}"><span>0${i + 1}</span><b>${e.s.toLocaleString()}</b><span>${e.d}M · ◈${e.c}</span></div>`;
    })
    .join('');

  showScreen('over');
}
