import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { authError } from '../lib/format';
import { IconGoogle } from './Icons';

export default function GoogleButton({ onError, label = 'Belépés Google-fiókkal' }) {
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err) {
      onError?.(authError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="btn btn-google btn-block btn-lg" onClick={signIn} disabled={busy}>
      <IconGoogle /> {busy ? 'Bejelentkezés…' : label}
    </button>
  );
}
