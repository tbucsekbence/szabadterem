import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { isProfileComplete, isSuperadminEmail } from '../../functions/shared/rooms.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null); // null = még nem töltődött / nincs
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [credit, setCredit] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        setUser(u);
        setIsAdmin(false);
        if (u && isSuperadminEmail(u.email, u.emailVerified)) {
          setIsAdmin(true);
        } else if (u) {
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

  // profil + kreditegyenleg élőben
  useEffect(() => {
    setProfile(null);
    setProfileLoaded(false);
    setCredit(0);
    if (!user) return;
    const offProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (s) => {
        setProfile(s.exists() ? s.data() : null);
        setProfileLoaded(true);
      },
      () => setProfileLoaded(true),
    );
    const offCredit = onSnapshot(
      doc(db, 'credits', user.uid),
      (s) => setCredit(s.exists() ? Number(s.data().balance) || 0 : 0),
      () => {},
    );
    return () => {
      offProfile();
      offCredit();
    };
  }, [user]);

  const value = {
    user,
    isAdmin,
    loading: loading || (user && !profileLoaded),
    profile,
    profileComplete: isProfileComplete(profile),
    credit,
    logout: () => signOut(auth),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
