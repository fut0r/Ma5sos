import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/*
 * Firebase's web configuration is public by design (it ships in every browser
 * bundle). Environment variables are optional; the project values are the
 * fallback so a build works without extra Vercel settings.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBD59dQarqN5uQKSJk58c1IsBokkpeTLrs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mazom-8ce99.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mazom-8ce99',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mazom-8ce99.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '954886342058',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:954886342058:web:4c6d720bb6f219528797d3',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-Y1FBG12D3S',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
firebaseAuth.languageCode = 'ar';
