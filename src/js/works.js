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

/** Pull a Google Drive file id from common share / view URLs */
export function extractDriveId(url) {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  const m =
    raw.match(/\/file\/d\/([^/]+)/) ||
    raw.match(/[?&]id=([^&]+)/) ||
    raw.match(/\/d\/([^/=]+)/) ||
    raw.match(/lh3\.googleusercontent\.com\/d\/([^=/?#]+)/);
  return m?.[1] || null;
}

/**
 * Prefer embed-friendly Drive URLs.
 * `uc?export=view` often 403s inside <img>; thumbnail / lh3 work more reliably.
 */
export function driveEmbedVariants(url) {
  if (!url || typeof url !== 'string') return [];
  const raw = url.trim();
  if (!raw) return [];
  const id = extractDriveId(raw);
  if (!id) return [raw];
  return [
    `https://lh3.googleusercontent.com/d/${id}=w2400`,
    `https://drive.google.com/thumbnail?id=${id}&sz=w2400`,
    `https://drive.google.com/uc?export=view&id=${id}`,
  ];
}

export function driveDirectUrl(url) {
  const variants = driveEmbedVariants(url);
  return variants[0] || null;
}

function normalizeImages(raw) {
  const list = [];
  if (Array.isArray(raw.images)) {
    raw.images.forEach((u) => {
      const d = driveDirectUrl(u);
      if (d) list.push(d);
    });
  }
  // legacy single image field
  const single = driveDirectUrl(raw.image);
  if (single && !list.includes(single)) list.unshift(single);
  // de-dupe while preserving order
  return [...new Set(list)].slice(0, 12);
}

function normalize(raw, id = null) {
  const images = normalizeImages(raw);
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
    images,
    image: images[0] || null, // keep first as primary for older consumers
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
