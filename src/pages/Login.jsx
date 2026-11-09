import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { authError } from '../lib/format';
import GoogleButton from '../components/GoogleButton';

export function safeNext(params) {
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/fiokom';
}

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const next = safeNext(params);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError('');
    setInfo('');
    if (!email) return setError('Add meg az e-mail címed, és küldünk egy jelszó-visszaállító levelet.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Elküldtük a jelszó-visszaállító levelet. Nézd meg a postafiókod!');
    } catch (err) {
      setError(authError(err));
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card card">
        <h1>Belépés</h1>
        <p className="muted">Jelentkezz be a foglaláshoz és a foglalásaid kezeléséhez.</p>
        <GoogleButton onError={setError} />
        <div className="divider"><span>vagy</span></div>
        <form onSubmit={submit} className="form">
          <label>
            E-mail cím
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Jelszó
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {info && <p className="form-info">{info}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Belépés…' : 'Belépés'}</button>
          <button type="button" className="link-btn" onClick={reset}>Elfelejtetted a jelszavad?</button>
        </form>
        <p className="muted small center">
          Még nincs fiókod? <Link to={`/regisztracio?next=${encodeURIComponent(next)}`} className="link-accent">Regisztráció</Link>
        </p>
      </div>
    </div>
  );
}
