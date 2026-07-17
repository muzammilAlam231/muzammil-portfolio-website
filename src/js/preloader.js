/* ════════════════════════════════════════════════════════════════
   PRELOADER — kinetic percentage counter + scramble-cycled words.

   The site is fully procedural (no textures/models), so real load
   time is short; the counter runs to ~92 on its own clock, then
   snaps to 100 once fonts + window.load resolve. Exit is a
   two-layer curtain lift (main panel + trailing veil) so the
   reveal has depth. Returns a promise that resolves when the
   curtains are gone — main.js chains the hero intro off it.
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ENV, $, scramble } from './utils.js';

const WORDS = ['ASSEMBLING SYSTEM', 'FRONTEND', 'BACKEND', 'CLOUD BASICS', 'END TO END'];

export function runPreloader() {
  const overlay = $('#preloader');
  const veil = $('.pre-veil');
  const inner = $('.pre-inner');
  const num = $('#pre-num');
  const fill = $('#pre-bar-fill');
  const word = $('#pre-word');

  const loaded = Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((r) => window.addEventListener('load', r, { once: true })),
  ]);

  // Reduced motion → no theatrics, just a quick fade once ready
  if (ENV.reduced) {
    return loaded.then(
      () =>
        new Promise((resolve) => {
          gsap.to([overlay, veil], {
            autoAlpha: 0,
            duration: 0.3,
            onComplete: () => {
              overlay.remove();
              veil.remove();
              resolve();
            },
          });
        })
    );
  }

  return new Promise((resolve) => {
    // cycle role words with the decode effect while loading
    let wi = 0;
    const wordTimer = setInterval(() => {
      wi = (wi + 1) % WORDS.length;
      scramble(word, WORDS[wi], 420);
    }, 640);

    const state = { v: 0 };
    const render = () => {
      num.textContent = String(Math.round(state.v)).padStart(2, '0');
      fill.style.transform = `scaleX(${state.v / 100})`;
    };

    // Phase 1: crawl to 92 while assets settle
    const crawl = gsap.to(state, { v: 92, duration: 1.6, ease: 'power2.out', onUpdate: render });

    loaded.then(() => {
      crawl.kill();
      // Phase 2: snap to 100 (counter pops accent), then lift both curtains
      gsap.to(state, {
        v: 100,
        duration: 0.4,
        ease: 'power1.inOut',
        onUpdate: render,
        onComplete: () => {
          clearInterval(wordTimer);
          $('.pre-count').classList.add('done');
          scramble(word, 'SYSTEM ONLINE', 300);
          gsap
            .timeline({
              delay: 0.25,
              onComplete: () => {
                overlay.remove();
                veil.remove();
                resolve();
              },
            })
            .to(inner, { yPercent: -60, autoAlpha: 0, duration: 0.5, ease: 'power3.in' })
            .to(overlay, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '-=0.15')
            .to(veil, { yPercent: -100, duration: 0.9, ease: 'power4.inOut' }, '<0.09');
        },
      });
    });
  });
}
