import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleButton from '../components/GoogleButton';
import { IconCheck } from '../components/Icons';

export function safeNext(params, fallback = '/fiokom') {
  const next = params.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

// Bejelentkezés kizárólag Google-fiókkal. Első belépéskor a /profil oldalra irányítunk.
export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, profileComplete } = useAuth();
  const [error, setError] = useState('');
  const next = safeNext(params);

  useEffect(() => {
    if (!user || loading) return;
    if (profileComplete) navigate(next, { replace: true });
    else navigate(`/profil?next=${encodeURIComponent(next)}`, { replace: true });
  }, [user, loading, profileComplete, next, navigate]);

  return (
    <div className="page auth-page">
      <div className="auth-card card">
        <h1>Belépés</h1>
        <p className="muted">A teremfoglaláshoz jelentkezz be Google-fiókoddal. Első belépéskor egy rövid profilt kérünk kitölteni.</p>
        <ul className="check-list">
          <li><IconCheck width={18} height={18} /> Nincs külön jelszó</li>
          <li><IconCheck width={18} height={18} /> Foglalások és kreditek egy helyen</li>
          <li><IconCheck width={18} height={18} /> Lemondás egy kattintással</li>
        </ul>
        <GoogleButton onError={setError} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="muted small center">
          A belépéssel elfogadod az <Link to="/aszf" className="link-accent">ÁSZF</Link>-et és az{' '}
          <a href="https://www.performancestudio.hu/adatvedelem/" target="_blank" rel="noreferrer" className="link-accent">adatkezelési tájékoztatót</a>.
        </p>
      </div>
    </div>
  );
}
