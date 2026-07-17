/* ════════════════════════════════════════════════════════════════
   SKIN — unlockable CORE accent after clearing GRID RUN.
   Keys live in localStorage alongside gridrun-scores / mute.
   ════════════════════════════════════════════════════════════════ */

export const UNLOCK_KEY = 'mma-core-unlocked';
export const SKIN_KEY = 'mma-skin'; // 'default' | 'core'
export const SCORES_KEY = 'gridrun-scores';

const CORE = {
  accent: '#ff3ec8',
  soft: 'rgba(255, 62, 200, 0.35)',
};

/** True once the player has cleared CORE (or already has a 40k+ score saved). */
export function isSkinUnlocked() {
  try {
    if (localStorage.getItem(UNLOCK_KEY) === '1') return true;
    const scores = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
    if (Array.isArray(scores) && scores.some((e) => (e?.s ?? 0) >= 40000)) {
      localStorage.setItem(UNLOCK_KEY, '1');
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/** Call on a real (non-demo) CORE clear. */
export function unlockCoreSkin() {
  try {
    localStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function getSkin() {
  if (!isSkinUnlocked()) return 'default';
  try {
    return localStorage.getItem(SKIN_KEY) === 'core' ? 'core' : 'default';
  } catch {
    return 'default';
  }
}

export function setSkin(id) {
  const next = id === 'core' && isSkinUnlocked() ? 'core' : 'default';
  try {
    localStorage.setItem(SKIN_KEY, next);
  } catch {
    /* ignore */
  }
  applySkin(next);
  return next;
}

export function applySkin(id = getSkin()) {
  const root = document.documentElement;
  if (id === 'core') {
    root.setAttribute('data-skin', 'core');
    root.style.setProperty('--accent', CORE.accent);
    root.style.setProperty('--accent-soft', CORE.soft);
  } else {
    root.removeAttribute('data-skin');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-soft');
  }
  window.dispatchEvent(new CustomEvent('mma:skin', { detail: { skin: id } }));
}

/** Nav toggle — only mounts when CORE is unlocked. */
export function initSkinToggle() {
  applySkin(getSkin());
  if (!isSkinUnlocked()) return;

  const nav = document.querySelector('.nav-links');
  if (!nav || document.getElementById('skin-toggle')) return;

  const btn = document.createElement('button');
  btn.id = 'skin-toggle';
  btn.type = 'button';
  btn.className = 'mono skin-toggle';
  btn.setAttribute('aria-pressed', getSkin() === 'core' ? 'true' : 'false');
  btn.title = 'Toggle CORE portfolio skin (unlocked via GRID RUN)';
  syncLabel(btn);

  btn.addEventListener('click', () => {
    const next = getSkin() === 'core' ? 'default' : 'core';
    setSkin(next);
    btn.setAttribute('aria-pressed', next === 'core' ? 'true' : 'false');
    syncLabel(btn);
  });

  const play = nav.querySelector('.nav-play');
  if (play) nav.insertBefore(btn, play);
  else nav.appendChild(btn);
}

function syncLabel(btn) {
  const on = getSkin() === 'core';
  btn.textContent = on ? 'CORE ●' : 'CORE ○';
  btn.classList.toggle('is-on', on);
}
