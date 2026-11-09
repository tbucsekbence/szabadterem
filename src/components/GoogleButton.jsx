import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { authError } from '../lib/format';
import { IconGoogle } from './Icons';

export default function GoogleButton({ onError }) {
  const signIn = async () => {
    try {
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      const ref = doc(db, 'users', user.uid);
      if (!(await getDoc(ref)).exists()) {
        await setDoc(ref, { name: user.displayName || '', email: user.email || '', createdAt: serverTimestamp() });
      }
    } catch (err) {
      onError?.(authError(err));
    }
  };
  return (
    <button type="button" className="btn btn-google btn-block" onClick={signIn}>
      <IconGoogle /> Folytatás Google-fiókkal
    </button>
  );
}
