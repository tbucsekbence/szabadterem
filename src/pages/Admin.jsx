import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ROOMS, OPEN_HOUR, CLOSE_HOUR, budapestDate, addDays } from '../../functions/shared/rooms.js';
import { STATUS_LABEL, ft, hh, prettyDate } from '../lib/format';

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);

function DayBoard({ date }) {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'bookings'), where('date', '==', date));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setMsg(e.message));
  }, [date]);

  const active = items.filter((b) => ['paid', 'pending', 'blocked'].includes(b.status));
  const cell = (roomId, h) => active.find((b) => b.roomId === roomId && h >= b.startHour && h < b.endHour);

  const cancel = async (b) => {
    const what = b.type === 'block' ? 'a blokkolást' : `${b.name || b.email} foglalását (teljes visszatérítéssel)`;
    if (!window.confirm(`Biztosan törlöd ${what}?`)) return;
    try {
      await httpsCallable(functions, 'cancelBooking')({ bookingId: b.id });
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <>
      <div className="admin-board">
        <div className="ab-row ab-head">
          <span />
          {ROOMS.map((r) => <span key={r.id}>{r.name}</span>)}
        </div>
        {HOURS.map((h) => (
          <div className="ab-row" key={h}>
            <span className="ab-hour">{hh(h)}</span>
            {ROOMS.map((r) => {
              const b = cell(r.id, h);
              return (
                <span key={r.id} className={`ab-cell ${b ? `ab-${b.status}` : ''}`} title={b ? `${b.name || b.note || ''}` : ''}>
                  {b && h === b.startHour ? (b.type === 'block' ? b.note || 'Blokkolva' : b.name || b.email) : ''}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {msg && <p className="form-error">{msg}</p>}
      <h3 className="mt-l">Tételek ezen a napon</h3>
      {items.length === 0 ? (
        <p className="muted">Nincs foglalás.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Terem</th><th>Idő</th><th>Ki</th><th>Elérhetőség</th><th>Fő</th><th>Összeg</th><th>Állapot</th><th /></tr>
            </thead>
            <tbody>
              {items.sort((a, b) => a.startHour - b.startHour).map((b) => (
                <tr key={b.id}>
                  <td>{b.roomName}</td>
                  <td>{hh(b.startHour)}–{hh(b.endHour)}</td>
                  <td>{b.type === 'block' ? <em>{b.note || 'Blokkolás'}</em> : b.name || '—'}</td>
                  <td className="small">{b.email}<br />{b.phone}</td>
                  <td>{b.people ?? '—'}</td>
                  <td>{b.amount != null ? ft(b.amount) : '—'}{b.refundAmount ? <><br /><span className="small muted">vissza: {ft(b.refundAmount)}</span></> : null}</td>
                  <td><span className={`badge badge-${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                  <td>{['paid', 'blocked'].includes(b.status) && <button className="btn btn-ghost btn-sm" onClick={() => cancel(b)}>Törlés</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function BlockForm({ date }) {
  const [f, setF] = useState({ roomId: ROOMS[0].id, startHour: 17, endHour: 19, note: '' });
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await httpsCallable(functions, 'createBlock')({ ...f, date, startHour: Number(f.startHour), endHour: Number(f.endHour) });
      setMsg('Időpont blokkolva.');
    } catch (err) {
      setMsg(err.message);
    }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="card-title">Időpont blokkolása</h2>
      <p className="muted small">Saját órák, karbantartás vagy telefonos foglalás esetén — {prettyDate(date)}.</p>
      <label>Terem
        <select value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
          {ROOMS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <div className="form-row">
        <label>Kezdés
          <select value={f.startHour} onChange={(e) => setF({ ...f, startHour: e.target.value })}>
            {HOURS.map((h) => <option key={h} value={h}>{hh(h)}</option>)}
          </select>
        </label>
        <label>Vége
          <select value={f.endHour} onChange={(e) => setF({ ...f, endHour: e.target.value })}>
            {HOURS.map((h) => <option key={h + 1} value={h + 1}>{hh(h + 1)}</option>)}
          </select>
        </label>
      </div>
      <label>Megjegyzés<input maxLength={200} value={f.note} placeholder="pl. Bachata kezdő óra" onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <button className="btn btn-primary">Blokkolás</button>
      {msg && <p className="form-info">{msg}</p>}
    </form>
  );
}

function Messages() {
  const [msgs, setMsgs] = useState([]);
  useEffect(() => {
    const q = query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc'), limit(30));
    return onSnapshot(q, (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, []);
  return (
    <section className="card">
      <h2 className="card-title">Üzenetek</h2>
      {msgs.length === 0 ? <p className="muted">Nincs új üzenet.</p> : (
        <ul className="msg-list">
          {msgs.map((m) => (
            <li key={m.id}>
              <div className="msg-head">
                <strong>{m.name}</strong>
                <a href={`mailto:${m.email}`} className="link-accent small">{m.email}</a>
                {m.phone && <span className="small muted">{m.phone}</span>}
                <span className="small muted">{m.createdAt?.toDate?.().toLocaleString('hu-HU')}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => window.confirm('Törlöd az üzenetet?') && deleteDoc(doc(db, 'contactMessages', m.id))}>Törlés</button>
              </div>
              <p>{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const [date, setDate] = useState(budapestDate());

  if (loading) return <div className="page"><div className="container"><p className="muted">Betöltés…</p></div></div>;
  if (!user) return <Navigate to="/belepes?next=%2Fadmin" replace />;
  if (!isAdmin) {
    return (
      <div className="page"><div className="container narrow">
        <h1>Nincs jogosultság</h1>
        <p className="muted">Ez az oldal csak adminisztrátoroknak érhető el. Admin felvételéhez hozz létre egy <code>admins/{user.uid}</code> dokumentumot a Firestore-ban.</p>
      </div></div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Admin</p>
          <h1>Foglalások kezelése</h1>
        </header>
        <div className="admin-date">
          <button className="btn btn-outline btn-sm" onClick={() => setDate(addDays(date, -1))}>‹ Előző nap</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={() => setDate(addDays(date, 1))}>Következő nap ›</button>
          <strong>{prettyDate(date)}</strong>
        </div>
        <div className="admin-layout">
          <section className="card"><DayBoard date={date} /></section>
          <BlockForm date={date} />
        </div>
        <Messages />
      </div>
    </div>
  );
}
