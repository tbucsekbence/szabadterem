import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { authError } from '../lib/format';
import GoogleButton from '../components/GoogleButton';
import { safeNext } from './Login';

export default function Register() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', accept: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeNext(params);

  useEffect(() => {
    if (user && !busy) navigate(next, { replace: true });
  }, [user, busy, next, navigate]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('A jelszónak legalább 6 karakterből kell állnia.');
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email.trim(), form.password);
      await updateProfile(cred.user, { displayName: form.name.trim() });
      sendEmailVerification(cred.user).catch(() => {});
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        createdAt: serverTimestamp(),
      });
      navigate(next, { replace: true });
    } catch (err) {
      setError(authError(err));
      setBusy(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card card">
        <h1>Regisztráció</h1>
        <p className="muted">Hozz létre fiókot, és foglalj termet pár kattintással.</p>
        <GoogleButton onError={setError} />
        <div className="divider"><span>vagy</span></div>
        <form onSubmit={submit} className="form">
          <label>
            Teljes név
            <input required maxLength={100} autoComplete="name" value={form.name} onChange={set('name')} />
          </label>
          <label>
            E-mail cím
            <input type="email" required autoComplete="email" value={form.email} onChange={set('email')} />
          </label>
          <label>
            Telefonszám <span className="muted small">(opcionális)</span>
            <input type="tel" maxLength={30} autoComplete="tel" placeholder="+36 30 123 4567" value={form.phone} onChange={set('phone')} />
          </label>
          <label>
            Jelszó
            <input type="password" required minLength={6} autoComplete="new-password" value={form.password} onChange={set('password')} />
          </label>
          <label className="checkbox">
            <input type="checkbox" required checked={form.accept} onChange={set('accept')} />
            <span>
              Elfogadom az <a href="https://www.performancestudio.hu/adatvedelem/" target="_blank" rel="noreferrer" className="link-accent">adatkezelési tájékoztatót</a> és a lemondási feltételeket.
            </span>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Fiók létrehozása…' : 'Regisztráció'}</button>
        </form>
        <p className="muted small center">
          Van már fiókod? <Link to={`/belepes?next=${encodeURIComponent(next)}`} className="link-accent">Belépés</Link>
        </p>
      </div>
    </div>
  );
}
