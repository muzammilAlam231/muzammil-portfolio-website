/* ════════════════════════════════════════════════════════════════
   SCROLL — Lenis (inertia scrolling) wired into GSAP ScrollTrigger.

   Lenis animates the real page scroll position; ScrollTrigger just
   needs to be told to update on every Lenis scroll event, and Lenis
   needs to be driven by GSAP's ticker so both share one rAF loop.
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { ENV, $$ } from './utils.js';

gsap.registerPlugin(ScrollTrigger);

export let lenis = null;

export function initScroll() {
  if (!ENV.reduced) {
    lenis = new Lenis({
      duration: 1.15, // inertia feel — higher = floatier
      autoRaf: false,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // locked while the preloader runs — released in main.js
  }

  // Smooth in-page anchors (nav, logo, skip link, back-to-top)
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      scrollToEl(target);
    });
  });
}

export function scrollToEl(target) {
  if (lenis) lenis.scrollTo(target, { duration: 1.6 });
  else target.scrollIntoView({ behavior: 'auto' });
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { duration: 1.6 });
  else window.scrollTo(0, 0);
}
