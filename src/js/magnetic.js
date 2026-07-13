/* ════════════════════════════════════════════════════════════════
   MAGNETIC — elements with [data-magnetic] are pulled toward the
   cursor while hovered and spring back elastically on leave.
   Optional [data-magnetic-strength="0.5"] tunes the pull.
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ENV, $$ } from './utils.js';

export function initMagnetic(root = document) {
  if (ENV.touch || ENV.reduced) return;

  $$('[data-magnetic]', root).forEach((el) => {
    if (el.__magnetic) return; // idempotent — safe to call after DOM injection
    el.__magnetic = true;

    const strength = parseFloat(el.dataset.magneticStrength || '0.35');
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });

    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * strength);
      yTo((e.clientY - (r.top + r.height / 2)) * strength);
    });
    el.addEventListener('mouseleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
    });
  });
}
