import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase client config. Override any value by setting the corresponding
// VITE_FIREBASE_* environment variable. The fallback values match the
// project defaults and maintain backward compatibility for local development.
const firebaseConfig = {
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         ?? "studentprojector",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              ?? "1:408857095021:web:18a066ad9599890dc00864",
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY             ?? "AIzaSyD-xn-hE1cQ1olF33-DAkqKWPOWZWnYofQ",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         ?? "studentprojector.firebaseapp.com",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      ?? "studentprojector.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "408857095021",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID      ?? "",
};

const firestoreDatabaseId =
  import.meta.env.VITE_FIRESTORE_DATABASE_ID ??
  "ai-studio-1c541bf6-fa20-4e53-8349-02d963b8d16c";

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
