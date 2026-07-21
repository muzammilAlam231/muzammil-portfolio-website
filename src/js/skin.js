/* ════════════════════════════════════════════════════════════════
   SKIN — unlockable CORE accent after clearing GRID RUN.
   Keys live in localStorage alongside gridrun-scores / mute.
   ════════════════════════════════════════════════════════════════ */

export const UNLOCK_KEY = 'mma-core-unlocked';
export const SKIN_KEY = 'mma-skin'; // 'default' | 'core'
export const SCORES_KEY = 'gridrun-scores';

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
  playSkinTransition(next);
  return next;
}

export function applySkin(id = getSkin()) {
  const root = document.documentElement;
  if (id === 'core') {
    root.setAttribute('data-skin', 'core');
  } else {
    root.removeAttribute('data-skin');
  }
  window.dispatchEvent(new CustomEvent('mma:skin', { detail: { skin: id } }));
}

/** Nav toggle — only mounts when CORE is unlocked. */
export function initSkinToggle() {
  applySkin(getSkin());
  if (!isSkinUnlocked()) return;

  const nav = document.querySelector('.nav-links');
  if (!nav || document.getElementById('skin-toggle')) return;
  mountCoreInterface();

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

/** Extra interface chrome makes the earned skin feel like a new operating mode. */
function mountCoreInterface() {
  if (document.getElementById('core-interface')) return;

  const shell = document.createElement('div');
  shell.id = 'core-interface';
  shell.className = 'core-interface mono';
  shell.setAttribute('aria-hidden', 'true');
  shell.innerHTML = `
    <div class="core-corner core-corner-b"><span>OBSIDIAN</span><b>40K CLEAR</b></div>
    <div class="core-status"><i></i><span>SYSTEM ONLINE</span><b id="core-section">HERO / 00</b></div>
    <div class="core-progress"><span></span></div>
    <div class="core-scan"></div>
    <div class="skin-wipe"></div>
  `;
  document.body.appendChild(shell);
  initCoreTelemetry(shell);
}

function playSkinTransition(next) {
  const wipe = document.querySelector('.skin-wipe');
  if (!wipe || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  wipe.dataset.to = next;
  wipe.classList.remove('is-playing');
  void wipe.offsetWidth;
  wipe.classList.add('is-playing');
  window.setTimeout(() => wipe.classList.remove('is-playing'), 850);
}

function initCoreTelemetry(shell) {
  const progress = shell.querySelector('.core-progress span');
  const sectionLabel = shell.querySelector('#core-section');
  let frame = 0;

  const updateViewport = (event) => {
    if (event) {
      document.documentElement.style.setProperty('--core-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--core-y', `${event.clientY}px`);
    }
    if (frame) return;
    frame = requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const value = max > 0 ? Math.min(scrollY / max, 1) : 0;
      progress.style.transform = `scaleX(${value})`;
      frame = 0;
    });
  };

  window.addEventListener('scroll', () => updateViewport(), { passive: true });
  if (matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', updateViewport, { passive: true });
  }
  updateViewport();

  const names = {
    hero: 'HERO / 00',
    about: 'PROFILE / 01',
    skills: 'SYSTEMS / 02',
    work: 'ARCHIVE / 03',
    experience: 'HISTORY / 04',
    cloud: 'NETWORK / 05',
    contact: 'UPLINK / 06',
  };
  const observer = new IntersectionObserver(
    (entries) => {
      const active = entries.find((entry) => entry.isIntersecting);
      if (active) sectionLabel.textContent = names[active.target.id] || active.target.id.toUpperCase();
    },
    { rootMargin: '-42% 0px -42% 0px' }
  );
  document.querySelectorAll('[data-formation]').forEach((section) => observer.observe(section));
}
