/* ════════════════════════════════════════════════════════════════
   NEON ARENA — keyboard + touch input
   ════════════════════════════════════════════════════════════════ */

const down = new Set();
const pressed = new Set();
let listeners = [];

const KEY_MAP = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyJ: 'light',
  KeyZ: 'light',
  KeyK: 'heavy',
  KeyX: 'heavy',
  KeyL: 'block',
  KeyC: 'block',
  ShiftLeft: 'block',
  ShiftRight: 'block',
  Space: 'dodge',
  KeyP: 'pause',
  KeyR: 'retry',
};

function emit(type, act) {
  listeners.forEach((fn) => fn(type, act));
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const act = KEY_MAP[e.code];
    if (!act) return;
    if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!down.has(act)) {
      down.add(act);
      pressed.add(act);
      emit('down', act);
    }
  });
  window.addEventListener('keyup', (e) => {
    const act = KEY_MAP[e.code];
    if (!act) return;
    down.delete(act);
    emit('up', act);
  });

  const pad = document.getElementById('touch-pad');
  if (pad) {
    pad.querySelectorAll('[data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      const start = (e) => {
        e.preventDefault();
        down.add(act);
        pressed.add(act);
        emit('down', act);
        btn.classList.add('is-down');
      };
      const end = (e) => {
        e.preventDefault();
        down.delete(act);
        emit('up', act);
        btn.classList.remove('is-down');
      };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', end);
      btn.addEventListener('pointerleave', end);
      btn.addEventListener('pointercancel', end);
    });
  }
}

export function onInput(fn) {
  listeners.push(fn);
}

export function isDown(act) {
  return down.has(act);
}

export function consume(act) {
  if (pressed.has(act)) {
    pressed.delete(act);
    return true;
  }
  return false;
}

export function clearPressed() {
  pressed.clear();
}

export function showTouchPad(show) {
  const pad = document.getElementById('touch-pad');
  if (!pad) return;
  const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  pad.classList.toggle('hidden', !(show && touch));
}
