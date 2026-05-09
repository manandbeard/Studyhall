import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Firebase client config. Override any value by setting the corresponding
// EXPO_PUBLIC_FIREBASE_* environment variable. The fallback values match the
// project defaults and maintain backward compatibility for local development.
const firebaseConfig = {
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         ?? "studentprojector",
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID              ?? "1:408857095021:web:18a066ad9599890dc00864",
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY             ?? "AIzaSyD-xn-hE1cQ1olF33-DAkqKWPOWZWnYofQ",
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN         ?? "studentprojector.firebaseapp.com",
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET      ?? "studentprojector.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "408857095021",
};

const FIRESTORE_DATABASE_ID =
  process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID ??
  "ai-studio-1c541bf6-fa20-4e53-8349-02d963b8d16c";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let _auth: Auth;
if (Platform.OS === "web") {
  _auth = getAuth(app);
} else {
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    _auth = getAuth(app);
  }
}

export const auth = _auth;
export const db = getFirestore(app, FIRESTORE_DATABASE_ID);
export { app as firebaseApp };

export const SCHOOL_DOMAIN =
  process.env.EXPO_PUBLIC_SCHOOL_DOMAIN ?? "nbend.k12.or.us";
// No real-person email as fallback — must be set via EXPO_PUBLIC_ADMIN_EMAIL.
export const ADMIN_EMAIL = process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? "";

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";

/**
 * Base URL for the API server (no trailing slash).
 * Set EXPO_PUBLIC_API_BASE_URL to the server's origin (e.g. https://myapp.replit.app).
 * Falls back to an empty string so relative paths work on web.
 */
export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
