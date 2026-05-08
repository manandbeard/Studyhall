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

const firebaseConfig = {
  projectId: "studentprojector",
  appId: "1:408857095021:web:18a066ad9599890dc00864",
  apiKey: "AIzaSyD-xn-hE1cQ1olF33-DAkqKWPOWZWnYofQ",
  authDomain: "studentprojector.firebaseapp.com",
  storageBucket: "studentprojector.firebasestorage.app",
  messagingSenderId: "408857095021",
};

const FIRESTORE_DATABASE_ID = "ai-studio-1c541bf6-fa20-4e53-8349-02d963b8d16c";

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
export const ADMIN_EMAIL =
  process.env.EXPO_PUBLIC_ADMIN_EMAIL ?? `nhelland@${SCHOOL_DOMAIN}`;

export const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
