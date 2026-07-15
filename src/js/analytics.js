/* ════════════════════════════════════════════════════════════════
   ANALYTICS — lightweight pageview beacon → Firestore `pageviews`
   ════════════════════════════════════════════════════════════════ */
import { addDoc, collection, getDocs, limit, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { initAnalytics } from './firebase.js';

const SESSION_KEY = 'mma_sid';
const LAST_KEY = 'mma_last_pv';

export const RANGES = [
  { id: '1', label: '1 day', days: 1, buckets: 24, bucket: 'hour' },
  { id: '14', label: '14 days', days: 14, buckets: 14, bucket: 'day' },
  { id: '30', label: '1 month', days: 30, buckets: 30, bucket: 'day' },
  { id: '365', label: '1 year', days: 365, buckets: 12, bucket: 'month' },
  { id: 'all', label: 'All time', days: null, buckets: null, bucket: 'month' },
];

export function getRange(id) {
  return RANGES.find((r) => r.id === id) || RANGES[1];
}

const GEO_KEY = 'mma_geo';
const GEO_FAIL_KEY = 'mma_geo_fail';

function normalizeLoc(country, city, countryCode) {
  return {
    country: String(country || '').slice(0, 64),
    city: String(city || '').slice(0, 64),
    countryCode: String(countryCode || '').slice(0, 8),
  };
}

async function fetchGeoJson(url, ms = 3000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`http ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve visitor city/country once per session (best-effort IP lookup). */
async function resolveLocation() {
  try {
    const cached = sessionStorage.getItem(GEO_KEY);
    if (cached) {
      const loc = JSON.parse(cached);
      if (loc?.country || loc?.city) return loc;
    }
  } catch {
    /* ignore bad cache */
  }

  // Avoid hammering APIs if we just failed
  try {
    const failAt = +sessionStorage.getItem(GEO_FAIL_KEY) || 0;
    if (Date.now() - failAt < 60_000) {
      return { country: '', city: '', countryCode: '' };
    }
  } catch {
    /* ignore */
  }

  const providers = [
    async () => {
      const data = await fetchGeoJson('https://ipwho.is/');
      if (data?.success === false) throw new Error('ipwho');
      return normalizeLoc(data.country, data.city, data.country_code);
    },
    async () => {
      const data = await fetchGeoJson('https://get.geojs.io/v1/ip/geo.json');
      return normalizeLoc(data.country, data.city, data.country_code);
    },
    async () => {
      const data = await fetchGeoJson('https://geo.kamero.ai/api/geo');
      return normalizeLoc(data.country || data.country_name, data.city, data.country_code || data.countryCode);
    },
  ];

  for (const run of providers) {
    try {
      const loc = await run();
      if (loc.country || loc.city) {
        sessionStorage.setItem(GEO_KEY, JSON.stringify(loc));
        sessionStorage.removeItem(GEO_FAIL_KEY);
        return loc;
      }
    } catch {
      /* try next provider */
    }
  }

  try {
    sessionStorage.setItem(GEO_FAIL_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
  return { country: '', city: '', countryCode: '' };
}

export function formatLocation(row) {
  const city = (row.city || '').trim();
  const country = (row.country || '').trim();
  if (city && country) return `${city}, ${country}`;
  if (country) return country;
  if (city) return city;
  return '—';
}

function sessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

function deviceKind() {
  const ua = navigator.userAgent || '';
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
}

/** Local calendar date YYYY-MM-DD */
export function localKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dayN = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayN}`;
}

function monthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** Fire-and-forget visit ping (deduped ~30s per path in session) */
export async function trackPageview(path = location.pathname) {
  try {
    initAnalytics();
    const key = `${LAST_KEY}:${path}`;
    const last = +sessionStorage.getItem(key) || 0;
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(key, String(Date.now()));

    const loc = await resolveLocation();

    await addDoc(collection(db, 'pageviews'), {
      path: path.slice(0, 180) || '/',
      ts: Timestamp.now(),
      sessionId: sessionId(),
      referrer: (document.referrer || '').slice(0, 300),
      device: deviceKind(),
      screen: `${screen.width}x${screen.height}`,
      lang: (navigator.language || '').slice(0, 16),
      country: loc.country,
      city: loc.city,
      countryCode: loc.countryCode,
    });
  } catch {
    /* never break the portfolio for analytics */
  }
}

/**
 * Admin: fetch pageviews for a range.
 * @param {string} rangeId 1 | 14 | 30 | 365 | all
 */
export async function fetchPageviews(rangeId = '14', max = 8000) {
  const range = getRange(rangeId);
  let q;
  if (range.days == null) {
    q = query(collection(db, 'pageviews'), orderBy('ts', 'desc'), limit(max));
  } else {
    const since = Timestamp.fromDate(new Date(Date.now() - range.days * 86400000));
    q = query(
      collection(db, 'pageviews'),
      where('ts', '>=', since),
      orderBy('ts', 'desc'),
      limit(max)
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      path: data.path || '/',
      ts: data.ts?.toDate?.() || new Date(),
      sessionId: data.sessionId || '',
      referrer: data.referrer || '',
      device: data.device || 'desktop',
      screen: data.screen || '',
      lang: data.lang || '',
      country: data.country || '',
      city: data.city || '',
      countryCode: data.countryCode || '',
    };
  });
}

function buildDaySeries(byDay, days) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    const key = localKey(d);
    series.push({
      date: key,
      label: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
      views: byDay[key] || 0,
      isToday: i === 0,
    });
  }
  return series;
}

function hourKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const dayN = String(x.getDate()).padStart(2, '0');
  const h = String(x.getHours()).padStart(2, '0');
  return `${y}-${m}-${dayN}T${h}`;
}

function buildHourSeries(byHour, hours = 24) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const series = [];
  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(d.getHours() - i);
    const key = hourKey(d);
    series.push({
      date: key,
      label: d.toLocaleTimeString(undefined, { hour: 'numeric' }),
      views: byHour[key] || 0,
      isToday: i === 0,
    });
  }
  return series;
}

function buildMonthSeries(byMonth, monthsBack, earliest) {
  const now = new Date();
  now.setDate(1);
  now.setHours(0, 0, 0, 0);

  let count = monthsBack;
  if (monthsBack == null) {
    if (!earliest) return buildMonthSeries(byMonth, 6, null);
    const first = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    count = Math.max(
      1,
      (now.getFullYear() - first.getFullYear()) * 12 + (now.getMonth() - first.getMonth()) + 1
    );
    count = Math.min(Math.max(count, 6), 36); // at least 6 months of axis for readability
  }

  const series = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = monthKey(d);
    // "Jul '26" — apostrophe so year isn't misread as a day
    const mon = d.toLocaleDateString(undefined, { month: 'short' });
    const yy = String(d.getFullYear()).slice(-2);
    series.push({
      date: key,
      label: `${mon} '${yy}`,
      views: byMonth[key] || 0,
      isToday: i === 0,
    });
  }
  return series;
}

/** Pick hour / day / month buckets so short histories still look like a real chart */
function buildSeriesForRange(range, byDay, byMonth, byHour, earliest, inRangeCount) {
  if (range.bucket === 'hour') {
    return buildHourSeries(byHour, range.buckets || 24);
  }
  if (range.bucket === 'day') {
    return buildDaySeries(byDay, range.days || 14);
  }

  // 1 year / all time with little data → daily chart (last 14–30 days)
  const spanDays = earliest
    ? Math.max(1, Math.ceil((Date.now() - earliest.getTime()) / 86400000) + 1)
    : 1;

  if (spanDays <= 45 || inRangeCount < 8) {
    return buildDaySeries(byDay, Math.min(30, Math.max(14, spanDays)));
  }
  if (spanDays <= 180) {
    // weekly-ish: still use days but last 90
    return buildDaySeries(byDay, Math.min(90, spanDays));
  }
  return buildMonthSeries(byMonth, range.days == null ? null : 12, earliest);
}

export function summarizeTraffic(rows, rangeId = '14') {
  const range = getRange(rangeId);
  const now = Date.now();
  const dayMs = 86400000;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const since =
    range.days == null
      ? null
      : new Date(now - range.days * dayMs);

  const inRange = since
    ? rows.filter((r) => r.ts >= since)
    : rows;

  const today = rows.filter((r) => r.ts >= startOfToday);
  const uniq = (list) => new Set(list.map((r) => r.sessionId)).size;

  const byPath = {};
  const byDevice = { desktop: 0, mobile: 0, tablet: 0 };
  const byDay = {};
  const byMonth = {};
  const byHour = {};
  const byRef = {};
  const byCountry = {};
  let earliest = null;

  for (const r of inRange) {
    byPath[r.path] = (byPath[r.path] || 0) + 1;
    byDevice[r.device] = (byDevice[r.device] || 0) + 1;
    byDay[localKey(r.ts)] = (byDay[localKey(r.ts)] || 0) + 1;
    byMonth[monthKey(r.ts)] = (byMonth[monthKey(r.ts)] || 0) + 1;
    byHour[hourKey(r.ts)] = (byHour[hourKey(r.ts)] || 0) + 1;
    if (!earliest || r.ts < earliest) earliest = r.ts;

    let host = 'direct';
    if (r.referrer) {
      try {
        host = new URL(r.referrer).hostname.replace(/^www\./, '') || 'direct';
      } catch {
        host = 'other';
      }
    }
    byRef[host] = (byRef[host] || 0) + 1;

    const country = (r.country || '').trim() || 'Unknown';
    byCountry[country] = (byCountry[country] || 0) + 1;
  }

  const series = buildSeriesForRange(range, byDay, byMonth, byHour, earliest, inRange.length);

  const topPaths = Object.entries(byPath)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, views]) => ({ path, views }));

  const topRefs = Object.entries(byRef)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([host, views]) => ({ host, views }));

  const topCountries = Object.entries(byCountry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([country, views]) => ({ country, views }));

  return {
    rangeId: range.id,
    rangeLabel: range.label,
    todayViews: today.length,
    todayUniques: uniq(today),
    rangeViews: inRange.length,
    rangeUniques: uniq(inRange),
    /* keep week/month aliases for older UI bits */
    weekViews: rows.filter((r) => now - r.ts.getTime() < 7 * dayMs).length,
    weekUniques: uniq(rows.filter((r) => now - r.ts.getTime() < 7 * dayMs)),
    monthViews: rows.filter((r) => now - r.ts.getTime() < 30 * dayMs).length,
    monthUniques: uniq(rows.filter((r) => now - r.ts.getTime() < 30 * dayMs)),
    devices: byDevice,
    series,
    topPaths,
    topRefs,
    topCountries,
    recent: inRange.slice(0, 200),
    todayLabel: localKey(startOfToday),
  };
}
