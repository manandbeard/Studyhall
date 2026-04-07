'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, signInWithPopup, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';

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
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch custom user data from Firestore by UID
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          // Force Nathan Helland to be an admin
          if (firebaseUser.email === 'nhelland@nbend.k12.or.us' && userData.role !== 'admin') {
            userData.role = 'admin';
            await updateDoc(userDocRef, { role: 'admin' });
          }
          setUser(userData);
        } else {
          // Check if a user with this email already exists (e.g., pre-created by admin)
          if (firebaseUser.email) {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const q = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
              // Link the existing user document to this new UID
              const existingDoc = snapshot.docs[0];
              const userData = existingDoc.data() as AppUser;
              
              // Create a new doc with the correct UID and copy data
              const newUser: AppUser = {
                ...userData,
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || userData.name,
                role: firebaseUser.email === 'nhelland@nbend.k12.or.us' ? 'admin' : userData.role,
              };
              
              await setDoc(userDocRef, newUser);
              
              // Delete the old placeholder doc
              const { deleteDoc } = await import('firebase/firestore');
              await deleteDoc(existingDoc.ref);
              
              // Update all students that referenced the old placeholder ID
              const studentsQ = query(collection(db, 'students'), where('thirdPeriodTeacherId', '==', existingDoc.id));
              const studentsSnapshot = await getDocs(studentsQ);
              for (const studentDoc of studentsSnapshot.docs) {
                await updateDoc(studentDoc.ref, { thirdPeriodTeacherId: firebaseUser.uid });
              }

              setUser(newUser);
              setLoading(false);
              return;
            }
          }

          // Create a new user doc if it doesn't exist (default to teacher)
          const newUser: AppUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || 'Unknown User',
            role: firebaseUser.email === 'nhelland@nbend.k12.or.us' ? 'admin' : 'teacher',
            roomNumber: 'TBD',
          };
          await setDoc(userDocRef, newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
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
