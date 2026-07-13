/* ════════════════════════════════════════════════════════════════
   CURSOR — custom two-part cursor (desktop, fine pointer only).

   - .cursor-dot  follows the pointer 1:1 (feels precise)
   - .cursor-ring lags behind with damping (feels alive)
   - hovering interactive elements grows the ring
   - [data-cursor-text="VIEW"] turns the ring into a filled label badge
   ════════════════════════════════════════════════════════════════ */
import gsap from 'gsap';
import { ENV, damp, $ } from './utils.js';

export function initCursor() {
  if (ENV.touch || ENV.reduced) return;
  document.documentElement.classList.add('fine-pointer');

  const dot = $('.cursor-dot');
  const ring = $('.cursor-ring');
  const label = $('.cursor-label');

  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { x: mouse.x, y: mouse.y };

  window.addEventListener('pointermove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
  });

  // Ring chases the dot with damping — the lag is the whole charm
  gsap.ticker.add((_, dtMs) => {
    const k = damp(0.16, Math.min(dtMs / 1000, 0.05));
    ringPos.x += (mouse.x - ringPos.x) * k;
    ringPos.y += (mouse.y - ringPos.y) * k;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });

  // Hover states via event delegation (works for injected content too)
  document.addEventListener('mouseover', (e) => {
    const labelled = e.target.closest('[data-cursor-text]');
    const interactive = e.target.closest('a, button, .skill-card, .p-mock');
    if (labelled) {
      label.textContent = labelled.dataset.cursorText;
      ring.classList.add('is-label');
    } else {
      ring.classList.remove('is-label');
    }
    ring.classList.toggle('is-hover', !!interactive && !labelled);
  });
  document.addEventListener('mouseout', (e) => {
    if (!e.relatedTarget || !e.relatedTarget.closest) return;
    if (!e.relatedTarget.closest('[data-cursor-text]')) ring.classList.remove('is-label');
    if (!e.relatedTarget.closest('a, button, .skill-card, .p-mock')) ring.classList.remove('is-hover');
  });

  window.addEventListener('pointerdown', () => dot.classList.add('is-down'));
  window.addEventListener('pointerup', () => dot.classList.remove('is-down'));

  // Hide when the pointer leaves the window
  document.addEventListener('mouseleave', () => gsap.to([dot, ring], { autoAlpha: 0, duration: 0.25 }));
  document.addEventListener('mouseenter', () => gsap.to([dot, ring], { autoAlpha: 1, duration: 0.25 }));
}
