import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { BOOKING_FREQUENCIES, PROFILE_ROLES, TERMS_VERSION } from '../../functions/shared/rooms.js';
import { safeNext } from './Login';

const empty = { name: '', phone: '', role: '', school: '', styles: '', groupSize: '', frequency: '', note: '' };

export default function Profile() {
  const { user, loading, profile, profileComplete } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params, '/foglalas');
  const [f, setF] = useState(empty);
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    setF({
      ...empty,
      ...Object.fromEntries(Object.entries(profile || {}).filter(([k]) => k in empty)),
      name: profile?.name || user.displayName || '',
      groupSize: profile?.groupSize ? String(profile.groupSize) : '',
    });
    setAccept(profile?.termsVersion === TERMS_VERSION);
  }, [user, profile]);

  if (loading) return <div className="page"><div className="container"><p className="muted">Betöltés…</p></div></div>;
  if (!user) return <Navigate to={`/belepes?next=${encodeURIComponent('/profil')}`} replace />;

  const isFirst = !profileComplete;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const teaches = f.role === 'teacher' || f.role === 'trainer';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const groupSize = Number.parseInt(f.groupSize, 10);
    if (!f.role) return setError('Válaszd ki, milyen céllal bérelsz termet.');
    if (!f.frequency) return setError('Válaszd ki, milyen gyakran foglalnál.');
    if (!Number.isInteger(groupSize) || groupSize < 1 || groupSize > 200) return setError('A létszám 1 és 200 között lehet.');
    if (!accept) return setError('A folytatáshoz el kell fogadnod az ÁSZF-et és az adatkezelési tájékoztatót.');
    setBusy(true);
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          name: f.name.trim(),
          phone: f.phone.trim(),
          email: (user.email || '').toLowerCase(),
          photoURL: user.photoURL || '',
          role: f.role,
          school: teaches ? f.school.trim() : '',
          styles: f.styles.trim(),
          groupSize,
          frequency: f.frequency,
          note: f.note.trim(),
          termsVersion: TERMS_VERSION,
          ...(profile?.termsVersion === TERMS_VERSION ? {} : { termsAcceptedAt: serverTimestamp() }),
          ...(profile ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );
      if (isFirst) navigate(next, { replace: true });
      else setSaved(true);
    } catch {
      setError('Nem sikerült menteni. Próbáld újra!');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="container narrow">
        <header className="page-head">
          <p className="eyebrow">{isFirst ? 'Még egy lépés' : 'Profil'}</p>
          <h1>{isFirst ? 'Mesélj magadról röviden' : 'Profilom'}</h1>
          {isFirst && <p className="lead muted">Ezek alapján tudunk a legjobb termet ajánlani, és szükség esetén elérni téged. Csak egyszer kell kitölteni.</p>}
        </header>

        <form className="card form" onSubmit={submit}>
          <div className="form-row">
            <label>Teljes név<input required maxLength={100} autoComplete="name" value={f.name} onChange={set('name')} /></label>
            <label>Telefonszám<input required type="tel" maxLength={30} autoComplete="tel" placeholder="+36 30 123 4567" value={f.phone} onChange={set('phone')} /></label>
          </div>
          <label>E-mail<input value={user.email || ''} disabled /></label>

          <fieldset className="chip-group">
            <legend>Milyen céllal bérelsz termet?</legend>
            {PROFILE_ROLES.map((r) => (
              <label key={r.id} className={`chip ${f.role === r.id ? 'on' : ''}`}>
                <input type="radio" name="role" value={r.id} checked={f.role === r.id} onChange={set('role')} /> {r.label}
              </label>
            ))}
          </fieldset>

          {teaches && (
            <label>Melyik iskolában / egyesületnél oktatsz? <span className="muted small">(ha van)</span>
              <input maxLength={150} placeholder="pl. Latin Dance Art, saját csoport" value={f.school} onChange={set('school')} />
            </label>
          )}

          <label>Milyen stílus(oka)t tanítasz / táncolsz? <span className="muted small">(opcionális)</span>
            <input maxLength={200} placeholder="pl. bachata, salsa, társastánc, jóga" value={f.styles} onChange={set('styles')} />
          </label>

          <div className="form-row">
            <label>Átlagosan hány fővel (diákkal) tervezed az órákat?
              <input required type="number" min={1} max={200} inputMode="numeric" value={f.groupSize} onChange={set('groupSize')} />
            </label>
            <label>Milyen gyakran foglalnál?
              <select required value={f.frequency} onChange={set('frequency')}>
                <option value="" disabled>Válassz…</option>
                {BOOKING_FREQUENCIES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
          </div>

          <label>Megjegyzés <span className="muted small">(opcionális)</span>
            <textarea rows={3} maxLength={500} placeholder="Bármi, amit tudnunk érdemes (pl. speciális igények)" value={f.note} onChange={set('note')} />
          </label>

          <label className="checkbox">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
            <span>
              Elolvastam és elfogadom az <Link to="/aszf" target="_blank" className="link-accent">Általános Szerződési Feltételeket</Link> (benne a lemondási és kreditszabályokat) és az{' '}
              <a href="https://www.performancestudio.hu/adatvedelem/" target="_blank" rel="noreferrer" className="link-accent">adatkezelési tájékoztatót</a>.
            </span>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && <p className="form-info">Mentve.</p>}
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Mentés…' : isFirst ? 'Tovább a foglaláshoz' : 'Mentés'}</button>
        </form>
      </div>
    </div>
  );
}
