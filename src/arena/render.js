/* ════════════════════════════════════════════════════════════════
   NEON ARENA — canvas renderer
   ════════════════════════════════════════════════════════════════ */
import { W, H, GROUND_Y } from './config.js';
import { attackBox, bodyBox } from './combat.js';

let canvas;
let ctx;
let shakeT = 0;
let shakeMag = 0;
let particles = [];

export function initRender() {
  canvas = document.getElementById('arena-canvas');
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  canvas.style.width = `${vw}px`;
  canvas.style.height = `${vh}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function viewScale() {
  return Math.min(window.innerWidth / W, window.innerHeight / H);
}

function viewOffset() {
  const s = viewScale();
  return {
    s,
    ox: (window.innerWidth - W * s) / 2,
    oy: (window.innerHeight - H * s) / 2,
  };
}

export function shake(mag = 8, dur = 0.25) {
  shakeMag = mag;
  shakeT = dur;
}

export function burst(x, y, color, n = 10) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 320,
      vy: -Math.random() * 280 - 40,
      life: 0.35 + Math.random() * 0.25,
      color,
      r: 2 + Math.random() * 3,
    });
  }
}

export function render(player, boss, dt) {
  const { s, ox, oy } = viewOffset();
  shakeT = Math.max(0, shakeT - dt);
  const sx = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0;
  const sy = shakeT > 0 ? (Math.random() - 0.5) * shakeMag : 0;

  ctx.fillStyle = '#07070a';
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.save();
  ctx.translate(ox + sx, oy + sy);
  ctx.scale(s, s);

  drawArena();
  if (boss && !boss.dead) drawFighter(boss, true);
  if (player) drawFighter(player, false);
  if (boss?.state === 'telegraph') drawTelegraph(boss);
  if (player && (player.state === 'light' || player.state === 'heavy') && player.attack?.phase === 'active') {
    drawHitArc(player);
  }
  if (boss && boss.state === 'attack' && boss.attack?.phase === 'active') {
    drawHitArc(boss);
  }

  updateParticles(dt);
  drawParticles();

  ctx.restore();
}

function drawArena() {
  // floor glow
  const g = ctx.createLinearGradient(0, GROUND_Y - 40, 0, H);
  g.addColorStop(0, 'rgba(184,255,60,0)');
  g.addColorStop(0.35, 'rgba(184,255,60,0.04)');
  g.addColorStop(1, 'rgba(10,10,12,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND_Y - 40, W, H - GROUND_Y + 40);

  // grid floor
  ctx.strokeStyle = 'rgba(184,255,60,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, GROUND_Y);
  ctx.lineTo(W - 40, GROUND_Y);
  ctx.stroke();

  for (let i = 0; i < 12; i++) {
    const x = 60 + i * ((W - 120) / 11);
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 30, H - 20);
    ctx.strokeStyle = 'rgba(233,233,236,0.05)';
    ctx.stroke();
  }

  // back wall lines
  ctx.strokeStyle = 'rgba(233,233,236,0.06)';
  for (let y = 80; y < GROUND_Y - 20; y += 36) {
    ctx.beginPath();
    ctx.moveTo(80, y);
    ctx.lineTo(W - 80, y);
    ctx.stroke();
  }

  // neon pillars
  drawPillar(70, '#b8ff3c');
  drawPillar(W - 70, '#b8ff3c');
}

function drawPillar(x, color) {
  ctx.fillStyle = 'rgba(16,16,20,0.9)';
  ctx.fillRect(x - 10, 100, 20, GROUND_Y - 100);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 10, 100, 20, GROUND_Y - 100);
  ctx.globalAlpha = 1;
}

function drawFighter(f, isBoss) {
  const box = bodyBox(f);
  const alpha = f.invuln > 0 && f.state === 'dodge' ? 0.35 : 1;
  ctx.save();
  ctx.globalAlpha = alpha;

  // glow
  ctx.shadowColor = f.flash > 0 ? '#fff' : f.color;
  ctx.shadowBlur = f.flash > 0 ? 28 : 16;

  // body
  ctx.fillStyle = f.flash > 0 ? '#ffffff' : f.color;
  const inset = isBoss ? 0 : 2;
  roundRect(box.x + inset, box.y + inset, box.w - inset * 2, box.h - inset * 2, 6);
  ctx.fill();

  // head accent
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0a0a0b';
  const hx = f.x - 10 * f.facing;
  ctx.fillRect(hx - 6, box.y + 12, 12, 10);

  // eyes
  ctx.fillStyle = f.color;
  ctx.fillRect(f.x + f.facing * 4 - 3, box.y + 14, 5, 5);

  // block stance
  if (f.state === 'block') {
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x - 4, box.y + 20, box.w + 8, box.h * 0.45);
  }

  // dead fade
  if (f.dead) {
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }

  ctx.restore();
}

function drawTelegraph(b) {
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 60) * 0.15;
  ctx.fillStyle = b.color;
  const box = attackBox(b, b.attack?.range || 80);
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function drawHitArc(f) {
  const range = f.attack?.range || 60;
  const box = attackBox(f, range);
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#fff';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function clearParticles() {
  particles = [];
}
