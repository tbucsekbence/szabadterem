import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { BOOKING_FREQUENCIES, PROFILE_ROLES, cancelCredit, zonedTime } from '../../functions/shared/rooms.js';
import { STATUS_LABEL, ft, hh, prettyDate } from '../lib/format';
import { IconCalendar } from '../components/Icons';

function BookingItem({ b }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const start = zonedTime(b.date, b.startHour).getTime();
  const upcoming = start > Date.now();
  const canCancel = upcoming && b.status === 'paid';
  const credit = cancelCredit(b.amount || 0, (start - Date.now()) / 3600000);

  const cancel = async () => {
    const text =
      credit >= (b.amount || 0)
        ? `Biztosan lemondod a foglalást? A teljes összeget (${ft(credit)}) kreditként jóváírjuk.`
        : credit > 0
          ? `Biztosan lemondod? 48 órán belül vagy, ezért a díj 50%-át (${ft(credit)}) írjuk jóvá kreditként.`
          : 'Biztosan lemondod? A kezdésig kevesebb mint 24 óra van hátra, ezért kredit-jóváírás nem jár.';
    if (!window.confirm(text)) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await httpsCallable(functions, 'cancelBooking')({ bookingId: b.id });
      setMsg(res.data.creditIssued ? `Lemondva, ${ft(res.data.creditIssued)} kredit jóváírva.` : 'Lemondva.');
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
        {b.creditUsed > 0 && <span className="muted small">Ebből kreditből: {ft(b.creditUsed)}</span>}
        {b.creditIssued > 0 && <span className="muted small">Jóváírt kredit: {ft(b.creditIssued)}</span>}
        {b.refundAmount > 0 && <span className="muted small">Kártyára visszautalva: {ft(b.refundAmount)}</span>}
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

const LEDGER_LABEL = { cancel: 'Lemondás', use: 'Felhasználás', restore: 'Visszaírás', admin: 'Jóváírás' };

function CreditCard({ uid, balance }) {
  const [ledger, setLedger] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'credits', uid, 'ledger'), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (s) => setLedger(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [uid]);
  return (
    <section className="card credit-card">
      <h2 className="card-title">Kreditegyenleg</h2>
      <p className="credit-balance">{ft(balance)}</p>
      <p className="muted small">A lemondott foglalások után járó összeget kreditként írjuk jóvá, amit a következő foglalásnál automatikusan felhasználhatsz.</p>
      {ledger.length > 0 && (
        <ul className="ledger">
          {ledger.map((l) => (
            <li key={l.id}>
              <span>
                <strong>{LEDGER_LABEL[l.type] || l.type}</strong>
                <span className="muted small">{l.note}</span>
              </span>
              <span className={l.amount > 0 ? 'plus' : 'minus'}>{l.amount > 0 ? '+' : '−'}{ft(Math.abs(l.amount))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileSummary({ profile, email }) {
  const role = PROFILE_ROLES.find((r) => r.id === profile?.role)?.label;
  const freq = BOOKING_FREQUENCIES.find((r) => r.id === profile?.frequency)?.label;
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="card-title">Profilom</h2>
        <Link to="/profil" className="btn btn-outline btn-sm">Szerkesztés</Link>
      </div>
      <dl className="summary-list">
        <div><dt>Név</dt><dd>{profile?.name}</dd></div>
        <div><dt>E-mail</dt><dd>{email}</dd></div>
        <div><dt>Telefon</dt><dd>{profile?.phone}</dd></div>
        <div><dt>Szerep</dt><dd>{role}</dd></div>
        {profile?.school && <div><dt>Iskola</dt><dd>{profile.school}</dd></div>}
        <div><dt>Létszám</dt><dd>{profile?.groupSize} fő</dd></div>
        <div><dt>Gyakoriság</dt><dd>{freq}</dd></div>
      </dl>
    </section>
  );
}

export default function Account() {
  const { user, loading, profile, profileComplete, credit } = useAuth();
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
  if (!profileComplete) return <Navigate to="/profil?next=%2Ffiokom" replace />;

  const now = Date.now();
  const list = bookings || [];
  const upcoming = list.filter((b) => zonedTime(b.date, b.startHour).getTime() > now && ['paid', 'pending'].includes(b.status)).reverse();
  const past = list.filter((b) => !upcoming.includes(b));
  const first = (profile?.name || user.displayName || '').split(' ').slice(-1)[0];

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Fiókom</p>
          <h1>Szia{first ? `, ${first}` : ''}!</h1>
        </header>
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
          <div className="account-side">
            <CreditCard uid={user.uid} balance={credit} />
            <ProfileSummary profile={profile} email={user.email} />
          </div>
        </div>
      </div>
    </div>
  );
}
