/* ════════════════════════════════════════════════════════════════
   MAIN — boot order matters:
   1. load works (Firestore with data.js fallback) + inject content
   2. scroll (Lenis, locked), cursor, WebGL scene (starts scattered)
   3. create every ScrollTrigger while the preloader covers the page
   4. preloader resolves → unlock scroll, assemble particles,
      play hero intro, refresh trigger positions
   5. fire a privacy-light pageview beacon for the admin dashboard
   ════════════════════════════════════════════════════════════════ */
import './styles/base.css';
import './styles/typography.css';
import './styles/components.css';
import './styles/sections.css';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initScroll, lenis } from './js/scroll.js';
import { initCursor } from './js/cursor.js';
import { runPreloader } from './js/preloader.js';
import { initThree, assemble } from './js/three/app.js';
import { injectContent, initSections, heroIntro } from './js/sections.js';
import { initGame } from './js/game.js';
import { loadWorks } from './js/works.js';
import { trackPageview } from './js/analytics.js';

async function boot() {
  const works = await loadWorks();
  injectContent(works);
  initScroll();
  initCursor();
  initThree();
  initSections();
  initGame();

  console.log(
    '%c MUZAMMIL ALAM %c ONE SYSTEM — particles, formations, admin control. ',
    'background:#b8ff3c;color:#0a0a0b;font-weight:700;padding:4px 8px;border-radius:4px 0 0 4px;',
    'background:#101014;color:#e9e9ec;padding:4px 8px;border-radius:0 4px 4px 0;'
  );

  runPreloader().then(() => {
    document.body.classList.add('is-loaded');
    lenis?.start();
    assemble();
    heroIntro();
    requestAnimationFrame(() => ScrollTrigger.refresh());
    trackPageview('/');
  });
}

boot();
