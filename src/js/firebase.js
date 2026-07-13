/* ════════════════════════════════════════════════════════════════
   FIREBASE — shared client for portfolio + admin panel.
   Project: muzammil-26858
   ════════════════════════════════════════════════════════════════ */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyC61zKxLJrC5VZBy0Yn8AiYBcpF9ypnhVQ',
  authDomain: 'muzammil-26858.firebaseapp.com',
  projectId: 'muzammil-26858',
  storageBucket: 'muzammil-26858.firebasestorage.app',
  messagingSenderId: '116290466539',
  appId: '1:116290466539:web:7dc4c490fd1f43f80284ae',
  measurementId: 'G-NTV0T91260',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

let analyticsPromise = null;
export function initAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((ok) => (ok ? getAnalytics(app) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}
