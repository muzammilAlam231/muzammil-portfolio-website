/* ════════════════════════════════════════════════════════════════
   UTILS — environment detection, math, DOM + split-text helpers
   ════════════════════════════════════════════════════════════════ */

export const ENV = {
  /** User prefers reduced motion → all heavy animation is skipped */
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  /** Coarse pointer (touch) → no custom cursor / magnetic / tilt */
  touch: window.matchMedia('(pointer: coarse)').matches,
};
/** Low-power heuristic → fewer particles, capped DPR */
ENV.low =
  ENV.touch ||
  (navigator.hardwareConcurrency || 8) <= 4 ||
  (navigator.deviceMemory || 8) <= 4;
/** Phone-sized viewport — scale the 3D backdrop slightly on small screens */
ENV.mobile = ENV.touch || window.matchMedia('(max-width: 768px)').matches;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
/** Frame-rate independent damping factor (k tuned for 60fps) */
export const damp = (k, dt) => 1 - Math.pow(1 - k, dt * 60);

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ── Scramble / decode effect ────────────────────────────────
   Characters flicker through glyphs and resolve left → right —
   the "terminal decode" motif used on labels across the site.  */
const GLYPHS = '!<>-_\\/[]{}—=+*^?#$&%01';
export function scramble(el, text, duration = 700) {
  if (el.__scrRaf) cancelAnimationFrame(el.__scrRaf);
  const start = performance.now();
  const step = (now) => {
    const p = clamp((now - start) / duration, 0, 1);
    const reveal = Math.floor(p * text.length);
    let out = text.slice(0, reveal);
    for (let i = reveal; i < text.length; i++) {
      out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = out;
    if (p < 1) el.__scrRaf = requestAnimationFrame(step);
  };
  el.__scrRaf = requestAnimationFrame(step);
}

/* ── Split text ──────────────────────────────────────────────
   Tiny replacements for SplitText. The original string is kept
   on aria-label so screen readers ignore the span soup.        */

/** Wrap every character of `el` in <span class="char"> — returns the spans */
export function splitChars(el) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const frag = document.createDocumentFragment();
  const spans = [];
  for (const ch of text) {
    const s = document.createElement('span');
    s.className = 'char';
    s.setAttribute('aria-hidden', 'true');
    if (ch === ' ') s.innerHTML = '&nbsp;';
    else s.textContent = ch;
    frag.appendChild(s);
    spans.push(s);
  }
  el.appendChild(frag);
  return spans;
}

/**
 * Wrap every word of `el` in <span class="w">.
 * With `mask: true` each word also gets an overflow-hidden wrapper
 * (<span class="wm">) so it can slide up from behind a clip edge.
 */
export function splitWords(el, { mask = false } = {}) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const spans = [];
  text.split(' ').forEach((word, i, arr) => {
    const w = document.createElement('span');
    w.className = 'w';
    w.setAttribute('aria-hidden', 'true');
    w.textContent = word;
    if (mask) {
      const m = document.createElement('span');
      m.className = 'wm';
      m.appendChild(w);
      el.appendChild(m);
    } else {
      el.appendChild(w);
    }
    if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    spans.push(w);
  });
  return spans;
}
