import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setIsAdmin(false);
        if (u) {
          try {
            const snap = await getDoc(doc(db, 'admins', u.uid));
            setIsAdmin(snap.exists());
          } catch {
            /* nem admin */
          }
        }
        setLoading(false);
      }),
    [],
  );

  const value = { user, isAdmin, loading, logout: () => signOut(auth) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
