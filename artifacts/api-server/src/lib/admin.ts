import { initializeApp, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "studentprojector";
export const FIRESTORE_DATABASE_ID =
  process.env.FIRESTORE_DATABASE_ID ??
  "ai-studio-1c541bf6-fa20-4e53-8349-02d963b8d16c";

let _app: App;

export function getAdminApp(): App {
  if (!_app) {
    _app =
      getApps().length === 0
        ? initializeApp({ projectId: PROJECT_ID })
        : getApps()[0];
  }
  return _app;
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp(), FIRESTORE_DATABASE_ID);
}
