import { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  AuthError,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  writeBatch,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { auth, db } from '@/firebase';

export const SCHOOL_DOMAIN =
  import.meta.env.VITE_SCHOOL_DOMAIN ?? 'nbend.k12.or.us';
export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL ?? `nhelland@${SCHOOL_DOMAIN}`;

export type AppRole = 'teacher' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  roomNumber?: string;
  phoneNumber?: string;
  isAway?: boolean;
  studyHallCapacity?: number;
  soundMuted?: boolean;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signingIn: false,
  signIn: async () => {},
  signOut: async () => {},
});

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function buildGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    hd: SCHOOL_DOMAIN,
    prompt: 'select_account',
  });
  return provider;
}

const BATCH_LIMIT = 450;

async function migrateReferences(
  oldUid: string,
  newUid: string,
): Promise<void> {
  const [studentsSnapshot, passesOriginSnapshot, passesDestSnapshot] =
    await Promise.all([
      getDocs(
        query(
          collection(db, 'students'),
          where('thirdPeriodTeacherId', '==', oldUid),
        ),
      ),
      getDocs(
        query(
          collection(db, 'passes'),
          where('originTeacherId', '==', oldUid),
        ),
      ),
      getDocs(
        query(
          collection(db, 'passes'),
          where('destinationTeacherId', '==', oldUid),
        ),
      ),
    ]);

  const updates: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];
  for (const d of studentsSnapshot.docs) {
    updates.push({ ref: d.ref, data: { thirdPeriodTeacherId: newUid } });
  }
  for (const d of passesOriginSnapshot.docs) {
    updates.push({ ref: d.ref, data: { originTeacherId: newUid } });
  }
  for (const d of passesDestSnapshot.docs) {
    updates.push({ ref: d.ref, data: { destinationTeacherId: newUid } });
  }

  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const { ref, data } of updates.slice(i, i + BATCH_LIMIT)) {
      batch.update(ref, data);
    }
    await batch.commit();
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in error:', err);
    });
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      async (firebaseUser: FirebaseUser | null) => {
        try {
          if (!firebaseUser) {
            setUser(null);
            return;
          }

          if (!firebaseUser.email?.endsWith(`@${SCHOOL_DOMAIN}`)) {
            console.warn(
              'Sign-in rejected: non-school domain',
              firebaseUser.email,
            );
            await firebaseSignOut(auth);
            setUser(null);
            return;
          }

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            if (firebaseUser.email === ADMIN_EMAIL && userData.role !== 'admin') {
              userData.role = 'admin';
              await updateDoc(userDocRef, { role: 'admin' });
            }
            setUser(userData);
            return;
          }

          let placeholderDoc:
            | QueryDocumentSnapshot<DocumentData>
            | null = null;
          try {
            const placeholderQ = query(
              collection(db, 'users'),
              where('email', '==', firebaseUser.email),
            );
            const snapshot = await getDocs(placeholderQ);
            if (!snapshot.empty) {
              placeholderDoc = snapshot.docs[0];
            }
          } catch (err) {
            console.error('Failed to look up placeholder user doc:', err);
            throw err;
          }

          if (placeholderDoc) {
            const existingData = placeholderDoc.data() as AppUser;
            const newUser: AppUser = {
              ...existingData,
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: firebaseUser.displayName || existingData.name,
              role:
                firebaseUser.email === ADMIN_EMAIL
                  ? 'admin'
                  : existingData.role,
            };
            await setDoc(userDocRef, newUser);

            try {
              await migrateReferences(placeholderDoc.id, firebaseUser.uid);
              await deleteDoc(placeholderDoc.ref);
            } catch (err) {
              console.error(
                'Placeholder migration failed; leaving placeholder doc in place for retry:',
                err,
              );
            }

            setUser(newUser);
            return;
          }

          const newUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || 'Unknown User',
            role:
              firebaseUser.email === ADMIN_EMAIL ? 'admin' : 'teacher',
            roomNumber: 'TBD',
          };
          await setDoc(userDocRef, newUser);
          setUser(newUser);
        } catch (err) {
          console.error('Error in auth state handler:', err);
          setUser(null);
        } finally {
          setLoading(false);
        }
      },
    );

    return () => unsubscribe();
  }, []);

  const signIn = async (): Promise<void> => {
    setSigningIn(true);
    const provider = buildGoogleProvider();
    try {
      if (isInIframe()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (error) {
      const authErr = error as AuthError;
      if (
        authErr.code === 'auth/popup-blocked' ||
        authErr.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error('Redirect fallback failed:', redirectErr);
          throw redirectErr;
        }
      }
      console.error('Error signing in with Google', error);
      throw error;
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signingIn, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
