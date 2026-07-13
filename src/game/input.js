/* ════════════════════════════════════════════════════════════════
   INPUT — keyboard + touch swipes, normalised to game actions.

   Emits: left · right · jump · slide · pause · any
   Desktop: ←→/A·D lanes, ↑/Space/W jump, ↓/S slide, P pause, M mute
   Touch:   swipe left/right/up/down, tap = jump
   ════════════════════════════════════════════════════════════════ */

const handlers = { left: [], right: [], jump: [], slide: [], pause: [], any: [] };

export function on(action, fn) {
  handlers[action].push(fn);
}
function emit(action) {
  // specific handlers first, then the generic "any" (start-screen trigger)
  handlers[action]?.forEach((f) => f());
  handlers.any.forEach((f) => f(action));
}

export function initInput() {
  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA': emit('left'); break;
      case 'ArrowRight':
      case 'KeyD': emit('right'); break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space': e.preventDefault(); emit('jump'); break;
      case 'ArrowDown':
      case 'KeyS': emit('slide'); break;
      case 'KeyP': emit('pause'); break;
      default: emit('none'); // still counts as "any" (start screen)
    }
  });

  /* swipe detection */
  let sx = 0, sy = 0, st = 0;
  addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = t.clientX;
    sy = t.clientY;
    st = performance.now();
  }, { passive: true });

  addEventListener('touchend', (e) => {
    // ignore touches on HUD buttons/links
    if (e.target.closest('button, a')) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx;
    const dy = t.clientY - sy;
    const fast = performance.now() - st < 500;
    const TH = 28;
    if (!fast) return;
    if (Math.abs(dx) < TH && Math.abs(dy) < TH) return emit('jump'); // tap
    if (Math.abs(dx) > Math.abs(dy)) emit(dx > 0 ? 'right' : 'left');
    else emit(dy > 0 ? 'slide' : 'jump');
  }, { passive: true });
}
