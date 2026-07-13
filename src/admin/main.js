/* ════════════════════════════════════════════════════════════════
   ADMIN MAIN — auth gate + traffic dashboard + works CRUD
   ════════════════════════════════════════════════════════════════ */
import '../styles/admin.css';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../js/firebase.js';
import { fetchPageviews, summarizeTraffic, getRange, RANGES } from '../js/analytics.js';
import {
  listWorksAdmin,
  createWork,
  updateWork,
  deleteWork,
  seedWorksIfEmpty,
} from '../js/works.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const RANGE_KEY = 'mma_admin_range';

const els = {
  auth: $('#auth-screen'),
  app: $('#app'),
  form: $('#login-form'),
  email: $('#login-email'),
  pass: $('#login-pass'),
  err: $('#login-error'),
  loginBtn: $('#login-btn'),
  adminEmail: $('#admin-email'),
  toast: $('#toast'),
  modal: $('#work-modal'),
  workForm: $('#work-form'),
  worksList: $('#works-list'),
  worksEmpty: $('#works-empty'),
  deleteBtn: $('#btn-delete-work'),
  formErr: $('#form-error'),
};

let traffic = null;
let works = [];
let toastTimer;
let currentRange = localStorage.getItem(RANGE_KEY) || '14';
if (!RANGES.some((r) => r.id === currentRange)) currentRange = '14';

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2400);
}

function syncRangeButtons() {
  $$('.range-btn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.range === currentRange);
  });
}

function setRange(id) {
  if (id === currentRange) return;
  currentRange = id;
  localStorage.setItem(RANGE_KEY, id);
  syncRangeButtons();
  refreshAll().then(() => toast(`RANGE · ${getRange(id).label.toUpperCase()}`));
}

$$('.range-btn').forEach((btn) => {
  btn.addEventListener('click', () => setRange(btn.dataset.range));
});
syncRangeButtons();

function showView(name) {
  $$('.nav-item').forEach((b) => b.classList.toggle('is-active', b.dataset.view === name));
  $$('.view').forEach((v) => v.classList.toggle('is-visible', v.id === `view-${name}`));
  const map = {
    overview: ['OVERVIEW', 'Dashboard'],
    traffic: ['TRAFFIC', 'Visitors & pages'],
    works: ['WORKS', 'Selected works'],
  };
  const [eye, title] = map[name] || map.overview;
  $('#view-eyebrow').textContent = eye;
  $('#view-title').textContent = title;
}

function setAuth(user) {
  const inApp = !!user;
  els.auth.classList.toggle('hidden', inApp);
  els.app.classList.toggle('hidden', !inApp);
  if (user) {
    els.adminEmail.textContent = user.email || '';
    refreshAll();
  }
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.err.hidden = true;
  els.loginBtn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, els.email.value.trim(), els.pass.value);
  } catch (err) {
    els.err.hidden = false;
    els.err.textContent = err.code === 'auth/invalid-credential'
      ? 'INVALID EMAIL OR PASSWORD'
      : (err.message || 'SIGN-IN FAILED').toUpperCase();
  } finally {
    els.loginBtn.disabled = false;
  }
});

$('#btn-logout').addEventListener('click', () => signOut(auth));
$('#btn-refresh').addEventListener('click', () => refreshAll().then(() => toast('REFRESHED')));

$$('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

onAuthStateChanged(auth, setAuth);

/* ── dashboard render ── */
/** Unique nice integer Y ticks (no duplicate “2”) */
function yTicks(maxVal) {
  const max = Math.max(1, Math.ceil(maxVal));
  const ideal = 4;
  const rough = max / ideal;
  const pow = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const n = rough / pow;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
  const top = Math.ceil(max / step) * step || step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v));
  return { ticks: [...new Set(ticks)], yMax: top || 1 };
}

function renderChart(series) {
  const W = 560;
  const H = 220;
  const pad = { t: 18, r: 16, b: 36, l: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(0, ...series.map((d) => d.views));
  const { ticks, yMax } = yTicks(Math.max(max, 1));
  const n = Math.max(series.length, 1);
  // keep a single point off the left edge — center-ish when only 1 sample
  const step = n > 1 ? iw / (n - 1) : 0;
  const x0 = n > 1 ? pad.l : pad.l + iw * 0.5;

  const xAt = (i) => (n > 1 ? pad.l + i * step : x0);
  const yAt = (v) => pad.t + ih - (v / yMax) * ih;

  const pts = series.map((d, i) => [xAt(i), yAt(d.views)]);
  let line = '';
  let area = '';
  if (pts.length === 1) {
    // flat stub so lone points still feel like a chart
    const [x, y] = pts[0];
    const xL = Math.max(pad.l, x - iw * 0.18);
    const xR = Math.min(W - pad.r, x + iw * 0.18);
    line = `M${xL},${y} L${xR},${y}`;
    area = `M${xL},${pad.t + ih} L${xL},${y} L${xR},${y} L${xR},${pad.t + ih} Z`;
  } else if (pts.length > 1) {
    line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${(pad.t + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(pad.t + ih).toFixed(1)} Z`;
  }

  const grid = ticks
    .map((val) => {
      const y = yAt(val);
      return `
        <line class="g-grid" x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" />
        <text class="g-ylabel" x="${pad.l - 8}" y="${y + 3}" text-anchor="end">${val}</text>`;
    })
    .join('');

  const dots = series
    .map((d, i) => {
      const [x, y] = pts[i];
      if (!d.views && !d.isToday) return ''; // hide zero dots for cleaner sparse charts
      const cls = d.isToday ? 'g-dot is-today' : 'g-dot';
      return `
        <g class="g-hit" data-tip="${esc(d.label)} · ${d.views} view${d.views === 1 ? '' : 's'}">
          <circle class="${cls}" cx="${x}" cy="${y}" r="${d.isToday ? 5.5 : 3.8}" />
          <circle class="g-hitbox" cx="${x}" cy="${y}" r="14" />
        </g>`;
    })
    .join('');

  // always show today's zero as a ring so the axis end is clear
  const todayIdx = series.findIndex((d) => d.isToday);
  let todayMark = '';
  if (todayIdx >= 0 && series[todayIdx].views === 0) {
    const [x, y] = pts[todayIdx];
    todayMark = `<circle class="g-dot is-today" cx="${x}" cy="${y}" r="5.5" />`;
  }

  const labels = series
    .map((d, i) => {
      const dense = n > 16;
      if (dense && i !== 0 && i !== n - 1 && !d.isToday && i % 3 !== 0) return '';
      if (!dense && n > 10 && i !== 0 && i !== n - 1 && !d.isToday && i % 2 === 1) return '';
      const x = xAt(i);
      const weight = d.isToday ? 'g-xlabel is-today' : 'g-xlabel';
      return `<text class="${weight}" x="${x}" y="${H - 10}" text-anchor="middle">${esc(d.label)}</text>`;
    })
    .join('');

  const first = series[0]?.label || '';
  const last = series[series.length - 1]?.label || '';
  const rangeMeta = getRange(currentRange);
  $('#chart-range').textContent = first === last ? first.toUpperCase() : `${first} → ${last}`.toUpperCase();
  $('#chart-title').textContent = `${rangeMeta.label} views`;
  $('#chart-bars').setAttribute('aria-label', `${rangeMeta.label} pageviews`);

  $('#chart-bars').innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b8ff3c" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#b8ff3c" stop-opacity="0"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.2" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      ${grid}
      <path class="g-area" d="${area}" fill="url(#areaGrad)" />
      <path class="g-line" d="${line}" filter="url(#glow)" />
      ${dots}
      ${todayMark}
      ${labels}
    </svg>
    <div class="chart-tip mono" id="chart-tip" hidden></div>`;

  const tip = $('#chart-tip');
  const wrap = $('#chart-bars');
  $$('.g-hit', wrap).forEach((g) => {
    g.addEventListener('mouseenter', (e) => {
      tip.hidden = false;
      tip.textContent = g.dataset.tip;
      const r = wrap.getBoundingClientRect();
      tip.style.left = `${e.clientX - r.left}px`;
      tip.style.top = `${e.clientY - r.top - 28}px`;
    });
    g.addEventListener('mousemove', (e) => {
      const r = wrap.getBoundingClientRect();
      tip.style.left = `${e.clientX - r.left}px`;
      tip.style.top = `${e.clientY - r.top - 28}px`;
    });
    g.addEventListener('mouseleave', () => {
      tip.hidden = true;
    });
  });
}

function renderDevices(devices) {
  const total = Math.max(1, (devices.desktop || 0) + (devices.mobile || 0) + (devices.tablet || 0));
  const rows = [
    ['Desktop', devices.desktop || 0],
    ['Mobile', devices.mobile || 0],
    ['Tablet', devices.tablet || 0],
  ];
  $('#device-bars').innerHTML = rows
    .map(
      ([label, n]) => `
      <div class="bar-row">
        <header><span>${label.toUpperCase()}</span><span>${n}</span></header>
        <div class="bar-track"><div class="bar-fill" style="width:${(n / total) * 100}%"></div></div>
      </div>`
    )
    .join('');
}

function renderTable(target, headers, rowsHtml) {
  $(target).innerHTML = `
    <table class="table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="${headers.length}" class="dim">No data yet</td></tr>`}</tbody>
    </table>`;
}

function renderTraffic(s) {
  $('#kpi-today').textContent = s.todayViews.toLocaleString();
  $('#kpi-today-u').textContent = `${s.todayUniques} uniques`;
  $('#kpi-range-label').textContent = s.rangeLabel.toUpperCase();
  $('#kpi-range').textContent = s.rangeViews.toLocaleString();
  $('#kpi-range-u').textContent = `${s.rangeUniques} uniques`;
  $('#kpi-week').textContent = s.weekViews.toLocaleString();
  $('#kpi-week-u').textContent = `${s.weekUniques} uniques`;

  renderChart(s.series);
  renderDevices(s.devices);

  renderTable(
    '#top-paths',
    ['PATH', 'VIEWS'],
    s.topPaths.map((p) => `<tr><td class="mono">${esc(p.path)}</td><td>${p.views}</td></tr>`).join('')
  );
  renderTable(
    '#top-refs',
    ['SOURCE', 'HITS'],
    s.topRefs.map((r) => `<tr><td>${esc(r.host)}</td><td>${r.views}</td></tr>`).join('')
  );
  renderTable(
    '#live-feed',
    ['WHEN', 'PATH', 'DEVICE', 'REF'],
    s.recent
      .map((r) => {
        const when = r.ts.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
        let ref = 'direct';
        if (r.referrer) {
          try {
            ref = new URL(r.referrer).hostname.replace(/^www\./, '');
          } catch {
            ref = 'other';
          }
        }
        return `<tr>
          <td class="mono">${esc(when)}</td>
          <td class="mono">${esc(r.path)}</td>
          <td><span class="pill">${esc(r.device)}</span></td>
          <td class="dim">${esc(ref)}</td>
        </tr>`;
      })
      .join('')
  );
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderWorks() {
  $('#kpi-works').textContent = String(works.filter((w) => w.published).length);
  els.worksEmpty.classList.toggle('hidden', works.length > 0);
  els.worksList.innerHTML = works
    .map(
      (w) => `
    <article class="work-row" data-id="${esc(w.id)}">
      <div class="work-hue" style="--h:${w.hue}"></div>
      <div>
        <h4>${esc(w.title)}</h4>
        <p>${esc(w.desc)}</p>
        <div class="work-meta">
          <span class="pill ${w.published ? 'on' : ''}">${w.published ? 'LIVE' : 'DRAFT'}</span>
          <span class="pill">#${w.order}</span>
          ${(w.tech || []).slice(0, 4).map((t) => `<span class="pill">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="work-actions">
        <button type="button" class="btn-ghost mono btn-edit">EDIT</button>
      </div>
    </article>`
    )
    .join('');

  $$('.btn-edit', els.worksList).forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.closest('.work-row').dataset.id;
      openModal(works.find((w) => w.id === id));
    });
  });
}

async function refreshAll() {
  try {
    const [rows, list] = await Promise.all([fetchPageviews(currentRange), listWorksAdmin()]);
    works = list;
    traffic = summarizeTraffic(rows, currentRange);
    renderTraffic(traffic);
    renderWorks();
  } catch (err) {
    console.error(err);
    toast('LOAD FAILED — CHECK FIRESTORE RULES');
  }
}

/* ── works modal ── */
function openModal(work = null) {
  els.modal.classList.remove('hidden');
  $('#modal-title').textContent = work ? 'Edit work' : 'Add work';
  $('#w-id').value = work?.id || '';
  $('#w-title').value = work?.title || '';
  $('#w-desc').value = work?.desc || '';
  $('#w-tech').value = (work?.tech || []).join(', ');
  $('#w-hue').value = work?.hue ?? 205;
  $('#w-order').value = work?.order ?? works.length;
  $('#w-live').value = work?.live || '#';
  $('#w-repo').value = work?.repo || '#';
  $('#w-image').value = work?.image || '';
  $('#w-published').checked = work ? work.published !== false : true;
  els.deleteBtn.hidden = !work;
  els.formErr.hidden = true;
}

function closeModal() {
  els.modal.classList.add('hidden');
  els.workForm.reset();
}

$('#btn-add-work').addEventListener('click', () => openModal());
$('#modal-close').addEventListener('click', closeModal);
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});

els.workForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.formErr.hidden = true;
  const id = $('#w-id').value;
  const payload = {
    title: $('#w-title').value,
    desc: $('#w-desc').value,
    tech: $('#w-tech').value,
    hue: +$('#w-hue').value || 205,
    order: +$('#w-order').value || 0,
    live: $('#w-live').value.trim() || '#',
    repo: $('#w-repo').value.trim() || '#',
    image: $('#w-image').value.trim() || null,
    published: $('#w-published').checked,
  };
  try {
    $('#btn-save-work').disabled = true;
    if (id) await updateWork(id, payload);
    else await createWork(payload);
    closeModal();
    await refreshAll();
    toast(id ? 'WORK UPDATED' : 'WORK ADDED');
  } catch (err) {
    els.formErr.hidden = false;
    els.formErr.textContent = (err.message || 'SAVE FAILED').toUpperCase();
  } finally {
    $('#btn-save-work').disabled = false;
  }
});

els.deleteBtn.addEventListener('click', async () => {
  const id = $('#w-id').value;
  if (!id || !confirm('Delete this work permanently?')) return;
  try {
    await deleteWork(id);
    closeModal();
    await refreshAll();
    toast('WORK DELETED');
  } catch (err) {
    els.formErr.hidden = false;
    els.formErr.textContent = (err.message || 'DELETE FAILED').toUpperCase();
  }
});

$('#btn-seed').addEventListener('click', async () => {
  const force = works.length > 0 && confirm('Replace ALL current works with the default set?');
  if (works.length && !force) return;
  try {
    const res = await seedWorksIfEmpty(!!force);
    await refreshAll();
    toast(res.seeded ? `SEEDED ${res.count} WORKS` : 'ALREADY SEEDED');
  } catch (err) {
    toast('SEED FAILED');
    console.error(err);
  }
});
