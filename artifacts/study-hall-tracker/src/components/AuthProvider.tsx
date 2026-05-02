import { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

export const SCHOOL_DOMAIN = 'nbend.k12.or.us';

export type AppRole = 'teacher' | 'admin';

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
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as AppUser;
            if (firebaseUser.email === `nhelland@${SCHOOL_DOMAIN}` && userData.role !== 'admin') {
              userData.role = 'admin';
              await updateDoc(userDocRef, { role: 'admin' });
            }
            setUser(userData);
          } else {
            if (firebaseUser.email) {
              const { collection, query, where, getDocs } = await import('firebase/firestore');
              const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const snapshot = await getDocs(q);

              if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                const userData = existingDoc.data() as AppUser;

                const newUser: AppUser = {
                  ...userData,
                  uid: firebaseUser.uid,
                  name: firebaseUser.displayName || userData.name,
                  role: firebaseUser.email === `nhelland@${SCHOOL_DOMAIN}` ? 'admin' : userData.role,
                };

                await setDoc(userDocRef, newUser);

                const { deleteDoc } = await import('firebase/firestore');
                try {
                  await deleteDoc(existingDoc.ref);
                } catch (err) {
                  console.error('Failed to delete old placeholder doc:', err);
                }

                try {
                  const studentsQ = query(collection(db, 'students'), where('thirdPeriodTeacherId', '==', existingDoc.id));
                  const studentsSnapshot = await getDocs(studentsQ);
                  for (const studentDoc of studentsSnapshot.docs) {
                    await updateDoc(studentDoc.ref, { thirdPeriodTeacherId: firebaseUser.uid });
                  }
                } catch (err) {
                  console.error('Failed to migrate student references:', err);
                }

                try {
                  const passesOriginQ = query(collection(db, 'passes'), where('originTeacherId', '==', existingDoc.id));
                  const passesOriginSnapshot = await getDocs(passesOriginQ);
                  for (const passDoc of passesOriginSnapshot.docs) {
                    await updateDoc(passDoc.ref, { originTeacherId: firebaseUser.uid });
                  }
                } catch (err) {
                  console.error('Failed to migrate origin pass references:', err);
                }

                try {
                  const passesDestQ = query(collection(db, 'passes'), where('destinationTeacherId', '==', existingDoc.id));
                  const passesDestSnapshot = await getDocs(passesDestQ);
                  for (const passDoc of passesDestSnapshot.docs) {
                    await updateDoc(passDoc.ref, { destinationTeacherId: firebaseUser.uid });
                  }
                } catch (err) {
                  console.error('Failed to migrate destination pass references:', err);
                }

                setUser(newUser);
                setLoading(false);
                return;
              }
            }

            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Unknown User',
              role: firebaseUser.email === `nhelland@${SCHOOL_DOMAIN}` ? 'admin' : 'teacher',
              roomNumber: 'TBD',
            };
            await setDoc(userDocRef, newUser);
            setUser(newUser);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error in auth state handler:', err);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user.email && !result.user.email.endsWith(`@${SCHOOL_DOMAIN}`)) {
        await firebaseSignOut(auth);
        throw new Error(`Unauthorized School Domain. Please use your @${SCHOOL_DOMAIN} email.`);
      }
    } catch (error) {
      console.error('Error signing in with Google', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
