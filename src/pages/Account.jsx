import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, serverTimestamp, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { sendEmailVerification } from 'firebase/auth';
import { auth, db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { refundRatio, zonedTime } from '../../functions/shared/rooms.js';
import { STATUS_LABEL, ft, hh, prettyDate } from '../lib/format';
import { IconCalendar } from '../components/Icons';

function BookingItem({ b }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const start = zonedTime(b.date, b.startHour).getTime();
  const upcoming = start > Date.now();
  const canCancel = upcoming && b.status === 'paid';
  const hoursLeft = (start - Date.now()) / 3600000;
  const refund = Math.round(((b.paidAmount ?? b.amount) * refundRatio(hoursLeft)) / 100) * 100;

  const cancel = async () => {
    const text =
      refund > 0
        ? `Biztosan lemondod a foglalást? ${ft(refund)} visszatérítést kapsz a kártyádra.`
        : 'Biztosan lemondod a foglalást? A kezdésig kevesebb mint 24 óra van hátra, ezért visszatérítés nem jár.';
    if (!window.confirm(text)) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await httpsCallable(functions, 'cancelBooking')({ bookingId: b.id });
      setMsg(res.data.refundAmount ? `Lemondva, ${ft(res.data.refundAmount)} visszatérítés elindítva.` : 'Lemondva.');
    } catch (err) {
      setMsg(err.message || 'Nem sikerült lemondani.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`booking-item status-${b.status}`}>
      <div className="bi-date">
        <span className="bi-day">{Number(b.date.slice(8))}</span>
        <span className="bi-month">{prettyDate(b.date, { month: 'short' })}</span>
      </div>
      <div className="bi-body">
        <strong>{b.roomName}</strong>
        <span className="muted">
          {prettyDate(b.date, { weekday: 'long' })} · {hh(b.startHour)} – {hh(b.endHour)} · {b.people} fő
        </span>
        {b.refundAmount > 0 && <span className="muted small">Visszatérítve: {ft(b.refundAmount)}</span>}
        {msg && <span className="small">{msg}</span>}
      </div>
      <div className="bi-side">
        <span className={`badge badge-${b.status}`}>{STATUS_LABEL[b.status] || b.status}</span>
        {b.amount != null && <span className="bi-amount">{ft(b.amount)}</span>}
        {canCancel && (
          <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>
            {busy ? 'Lemondás…' : 'Lemondás'}
          </button>
        )}
      </div>
    </li>
  );
}

function Profile({ user }) {
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saved, setSaved] = useState('');
  useEffect(() => {
    getDoc(doc(db, 'users', user.uid)).then((s) => {
      const d = s.data() || {};
      setForm({ name: d.name || user.displayName || '', phone: d.phone || '' });
    });
  }, [user]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'users', user.uid), { name: form.name.trim(), phone: form.phone.trim(), email: user.email || '', updatedAt: serverTimestamp() }, { merge: true });
      setSaved('Mentve.');
    } catch {
      setSaved('Nem sikerült menteni.');
    }
  };

  return (
    <form className="card form" onSubmit={save}>
      <h2 className="card-title">Adataim</h2>
      <label>Név<input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>E-mail<input value={user.email || ''} disabled /></label>
      <label>Telefonszám<input type="tel" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
      <button className="btn btn-outline">Mentés</button>
      {saved && <p className="form-info">{saved}</p>}
    </form>
  );
}

function VerifyBanner({ user }) {
  const [msg, setMsg] = useState('');
  if (user.emailVerified) return null;
  const resend = async () => {
    try {
      await sendEmailVerification(user);
      setMsg('Elküldtük a megerősítő levelet.');
    } catch {
      setMsg('Nem sikerült elküldeni, próbáld újra pár perc múlva.');
    }
  };
  const recheck = async () => {
    await user.reload();
    if (auth.currentUser?.emailVerified) {
      await auth.currentUser.getIdToken(true);
      window.location.reload();
    } else setMsg('Még nem látjuk a megerősítést — kattints a levélben kapott linkre.');
  };
  return (
    <div className="notice verify">
      <span>Erősítsd meg az e-mail címedet ({user.email}) a levélben kapott linkkel.</span>
      <span className="row-actions m0">
        <button className="btn btn-outline btn-sm" onClick={resend}>Levél újraküldése</button>
        <button className="btn btn-ghost btn-sm" onClick={recheck}>Megerősítettem</button>
      </span>
      {msg && <span className="small">{msg}</span>}
    </div>
  );
}

export default function Account() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), where('uid', '==', user.uid), orderBy('startsAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => setBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.type !== 'block')),
      (err) => {
        setError(err.message);
        setBookings([]);
      },
    );
  }, [user]);

  if (loading) return <div className="page"><div className="container"><p className="muted">Betöltés…</p></div></div>;
  if (!user) return <Navigate to="/belepes?next=%2Ffiokom" replace />;

  const now = Date.now();
  const list = bookings || [];
  const upcoming = list.filter((b) => zonedTime(b.date, b.startHour).getTime() > now && ['paid', 'pending'].includes(b.status)).reverse();
  const past = list.filter((b) => !upcoming.includes(b));

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Fiókom</p>
          <h1>Szia{user.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}!</h1>
        </header>
        <VerifyBanner user={user} />
        <div className="account-layout">
          <div>
            <section className="card">
              <div className="card-head">
                <h2 className="card-title">Közelgő foglalásaim</h2>
                <Link to="/foglalas" className="btn btn-primary btn-sm"><IconCalendar width={18} height={18} /> Új foglalás</Link>
              </div>
              {bookings === null ? (
                <p className="muted">Betöltés…</p>
              ) : upcoming.length ? (
                <ul className="booking-list">{upcoming.map((b) => <BookingItem key={b.id} b={b} />)}</ul>
              ) : (
                <p className="muted">Nincs közelgő foglalásod.</p>
              )}
              {error && <p className="form-error">{error}</p>}
            </section>
            {past.length > 0 && (
              <section className="card">
                <h2 className="card-title">Korábbi és lemondott foglalások</h2>
                <ul className="booking-list">{past.map((b) => <BookingItem key={b.id} b={b} />)}</ul>
              </section>
            )}
          </div>
          <Profile user={user} />
        </div>
      </div>
    </div>
  );
}
