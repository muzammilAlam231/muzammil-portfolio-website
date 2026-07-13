/* ════════════════════════════════════════════════════════════════
   BUG HUNT — the site's easter-egg mini-game.

   Concept: glitchy red bugs infiltrate "the system" (the particle
   lattice you saw being built in the hero). You have 30 seconds to
   squash as many as you can. Difficulty ramps: more + faster bugs
   the longer you survive. Best score persists in localStorage.

   Split of responsibilities:
     three/app.js → bug rendering, wandering, screen-space hit test
     this file    → rules, timer, score, UI, scroll locking
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ENV, $ } from './utils.js';
import { lenis } from './scroll.js';
import { threeReady, gameSetMode, gameClick, burst } from './three/app.js';

const ROUND_SECONDS = 30;
const BEST_KEY = 'mz-bughunt-best';

let active = false;
let ended = false;
let score = 0;
let timeLeft = 0;
let timer = null;

export function initGame() {
  const open = $('#game-open');
  // no game without motion or WebGL — hide the invitation entirely
  if (ENV.reduced || !threeReady()) {
    open.hidden = true;
    return;
  }

  const ui = $('#game-ui');
  const scoreEl = $('#game-score');
  const timeEl = $('#game-time');
  const bestEl = $('#game-best');
  const msgEl = $('#game-msg');
  const quit = $('#game-quit');

  let best = +(localStorage.getItem(BEST_KEY) || 0);
  bestEl.textContent = best;

  const start = () => {
    if (active) return;
    active = true;
    ended = false;
    score = 0;
    timeLeft = ROUND_SECONDS;
    scoreEl.textContent = '0';
    timeEl.textContent = ROUND_SECONDS.toFixed(1);
    ui.hidden = false;
    document.body.classList.add('game-on');
    lenis?.stop(); // page holds still while you hunt
    gameSetMode(true);
    flashMsg('SQUASH THE BUGS');
    timer = setInterval(tick, 100);
  };

  const tick = () => {
    timeLeft -= 0.1;
    timeEl.textContent = Math.max(0, timeLeft).toFixed(1);
    if (timeLeft <= 0) end();
  };

  const end = () => {
    clearInterval(timer);
    ended = true;
    gameSetMode(false); // bugs vanish, the system morphs back mid-screen
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, best);
      bestEl.textContent = best;
      flashMsg(`NEW BEST — ${score} SQUASHED · CLICK TO EXIT`, true);
    } else {
      flashMsg(`SYSTEM CLEAN — ${score} SQUASHED · CLICK TO EXIT`, true);
    }
  };

  const stop = () => {
    clearInterval(timer);
    active = false;
    ended = false;
    ui.hidden = true;
    msgEl.textContent = '';
    document.body.classList.remove('game-on');
    gameSetMode(false);
    lenis?.start();
  };

  const flashMsg = (text, hold = false) => {
    msgEl.textContent = text;
    gsap.fromTo(msgEl, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4 });
    if (!hold) gsap.to(msgEl, { autoAlpha: 0, duration: 0.5, delay: 1.4 });
  };

  /** floating "+1" at the squash point */
  const popScore = (x, y) => {
    const el = document.createElement('span');
    el.className = 'game-pop';
    el.textContent = '+1';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    gsap.to(el, { y: -46, autoAlpha: 0, duration: 0.8, ease: 'power2.out', onComplete: () => el.remove() });
  };

  /* ── input ── */
  open.addEventListener('click', start);
  quit.addEventListener('click', stop);

  document.addEventListener('pointerdown', (e) => {
    if (!active || e.button !== 0) return;
    if (e.target.closest('#game-quit')) return;
    if (ended) return stop(); // any click on the result screen exits
    burst(e.clientX, e.clientY); // every shot ripples the field
    if (gameClick(e.clientX, e.clientY)) {
      score++;
      scoreEl.textContent = score;
      popScore(e.clientX, e.clientY);
      gsap.fromTo(scoreEl, { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'power2.out' });
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) stop();
    if ((e.key === 'g' || e.key === 'G') && !active && !e.repeat) start();
  });
}
