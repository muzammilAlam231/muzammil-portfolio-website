/* ════════════════════════════════════════════════════════════════
   WORKS — load selected projects from Firestore, fall back to data.js
   ════════════════════════════════════════════════════════════════ */
import {
  collection,
  getDocs,
  orderBy,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { projects as fallbackProjects } from './data.js';

const COL = 'works';

function driveDirectUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;
  // Already a direct-ish Drive view URL
  if (/drive\.google\.com\/uc\?/.test(raw) || /googleusercontent\.com/.test(raw)) return raw;
  // Share links: /file/d/FILE_ID/... or open?id=FILE_ID
  const m =
    raw.match(/\/file\/d\/([^/]+)/) ||
    raw.match(/[?&]id=([^&]+)/);
  if (m?.[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return raw;
}

function normalize(raw, id = null) {
  const image = driveDirectUrl(raw.image);
  return {
    id: id || raw.id || null,
    title: String(raw.title || 'Untitled').trim(),
    desc: String(raw.desc || '').trim(),
    tech: Array.isArray(raw.tech)
      ? raw.tech.map((t) => String(t).trim()).filter(Boolean)
      : String(raw.tech || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    hue: Number.isFinite(+raw.hue) ? +raw.hue : 205,
    image,
    live: raw.live || '#',
    repo: raw.repo || '#',
    order: Number.isFinite(+raw.order) ? +raw.order : 0,
    published: raw.published !== false,
  };
}

/** Public site: Firestore works (published) or static fallback */
export async function loadWorks() {
  try {
    const q = query(collection(db, COL), orderBy('order', 'asc'));
    const snap = await Promise.race([
      getDocs(q),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2800)),
    ]);
    const list = snap.docs
      .map((d) => normalize({ ...d.data(), id: d.id }))
      .filter((w) => w.published);
    if (list.length) return list;
  } catch {
    /* offline / not seeded yet */
  }
  return fallbackProjects.map((p, i) => normalize({ ...p, order: i }));
}

/** Admin: all works including drafts */
export async function listWorksAdmin() {
  const q = query(collection(db, COL), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => normalize({ ...d.data(), id: d.id }));
}

export async function createWork(data) {
  const payload = {
    ...normalize(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  delete payload.id;
  const ref = await addDoc(collection(db, COL), payload);
  return { ...payload, id: ref.id };
}

export async function updateWork(id, data) {
  const payload = { ...normalize({ ...data, id }), updatedAt: serverTimestamp() };
  delete payload.id;
  await updateDoc(doc(db, COL, id), payload);
  return { ...payload, id };
}

export async function deleteWork(id) {
  await deleteDoc(doc(db, COL, id));
}

/** Seed Firestore from the static data.js list (idempotent if empty) */
export async function seedWorksIfEmpty(force = false) {
  const existing = await listWorksAdmin();
  if (existing.length && !force) return { seeded: false, count: existing.length };

  if (force && existing.length) {
    const batch = writeBatch(db);
    existing.forEach((w) => batch.delete(doc(db, COL, w.id)));
    await batch.commit();
  }

  const batch = writeBatch(db);
  fallbackProjects.forEach((p, i) => {
    const ref = doc(collection(db, COL));
    const payload = normalize({ ...p, order: i, published: true });
    delete payload.id;
    batch.set(ref, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return { seeded: true, count: fallbackProjects.length };
}
