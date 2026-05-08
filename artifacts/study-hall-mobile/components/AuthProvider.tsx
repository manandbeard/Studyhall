import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";

import {
  ADMIN_EMAIL,
  GOOGLE_ANDROID_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_WEB_CLIENT_ID,
  SCHOOL_DOMAIN,
  auth,
  db,
} from "@/lib/firebase";

WebBrowser.maybeCompleteAuthSession();

export type AppRole = "teacher" | "admin";

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  roomNumber?: string;
  phoneNumber?: string;
  isAway?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signingIn: boolean;
  error: string | null;
  configMissing: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signingIn: false,
  error: null,
  configMissing: false,
  signIn: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

async function loadOrCreateUserDoc(
  firebaseUser: FirebaseUser,
): Promise<AppUser | null> {
  if (!firebaseUser.email?.endsWith(`@${SCHOOL_DOMAIN}`)) {
    console.warn(
      "Sign-in rejected: non-school domain",
      firebaseUser.email,
    );
    await firebaseSignOut(auth);
    return null;
  }

  const userDocRef = doc(db, "users", firebaseUser.uid);
  const userDoc = await getDoc(userDocRef);

  if (userDoc.exists()) {
    const userData = userDoc.data() as AppUser;
    if (firebaseUser.email === ADMIN_EMAIL && userData.role !== "admin") {
      userData.role = "admin";
      await updateDoc(userDocRef, { role: "admin" });
    }
    return userData;
  }

  const newUser: AppUser = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    name: firebaseUser.displayName ?? "Unknown User",
    role: firebaseUser.email === ADMIN_EMAIL ? "admin" : "teacher",
    roomNumber: "TBD",
  };
  await setDoc(userDocRef, newUser);
  return newUser;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configMissing =
    Platform.OS !== "web" &&
    !GOOGLE_WEB_CLIENT_ID &&
    !GOOGLE_IOS_CLIENT_ID &&
    !GOOGLE_ANDROID_CLIENT_ID;

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
    scopes: ["openid", "profile", "email"],
    extraParams: { hd: SCHOOL_DOMAIN, prompt: "select_account" },
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          return;
        }
        const appUser = await loadOrCreateUserDoc(firebaseUser);
        setUser(appUser);
      } catch (err) {
        console.error("Auth state error:", err);
        setUser(null);
        setError(err instanceof Error ? err.message : "Authentication error");
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      if (!idToken && !accessToken) {
        setError("No credential returned from Google");
        setSigningIn(false);
        return;
      }
      const credential = GoogleAuthProvider.credential(
        idToken ?? null,
        accessToken ?? null,
      );
      signInWithCredential(auth, credential).catch((err) => {
        console.error("Firebase sign-in failed:", err);
        setError(err instanceof Error ? err.message : "Sign-in failed");
        setSigningIn(false);
      });
    } else if (response.type === "error") {
      console.error("Google auth error:", response.error);
      setError(response.error?.message ?? "Google sign-in failed");
      setSigningIn(false);
    } else if (response.type === "cancel" || response.type === "dismiss") {
      setSigningIn(false);
    }
  }, [response]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          hd: SCHOOL_DOMAIN,
          prompt: "select_account",
        });
        await signInWithPopup(auth, provider);
        return;
      }
      if (configMissing || !request) {
        throw new Error(
          "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, and EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in Secrets.",
        );
      }
      await promptAsync();
    } catch (err) {
      console.error("Sign-in error:", err);
      setError(err instanceof Error ? err.message : "Sign-in failed");
      setSigningIn(false);
    }
  }, [configMissing, promptAsync, request]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    const appUser = await loadOrCreateUserDoc(auth.currentUser);
    setUser(appUser);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      signingIn,
      error,
      configMissing,
      signIn,
      signOut,
      refreshUser,
    }),
    [
      user,
      loading,
      signingIn,
      error,
      configMissing,
      signIn,
      signOut,
      refreshUser,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
