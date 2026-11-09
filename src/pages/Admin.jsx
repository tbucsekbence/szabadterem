import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ROOMS, OPEN_HOUR, CLOSE_HOUR, WEEKDAYS, budapestDate, addDays } from '../../functions/shared/rooms.js';
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

  const cancel = async (b, mode) => {
    const what =
      b.type === 'block'
        ? 'Biztosan visszaadod ezt az időpontot a foglalásba?'
        : mode === 'refund'
          ? `Lemondod ${b.name || b.email} foglalását? A kártyás rész (${ft(b.paidAmount ?? b.cardAmount ?? 0)}) visszautalásra kerül, a kreditrész kreditként jár vissza.`
          : `Lemondod ${b.name || b.email} foglalását? A teljes összeget (${ft(b.amount || 0)}) kreditként jóváírjuk neki.`;
    if (!window.confirm(what)) return;
    try {
      await httpsCallable(functions, 'cancelBooking')({ bookingId: b.id, mode });
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
                  <td>
                    {b.type === 'block' ? <em>{b.note || 'Blokkolás'}</em> : b.name || '—'}
                    {b.school && <><br /><span className="small muted">{b.school}</span></>}
                  </td>
                  <td className="small">
                    {b.email}<br />{b.phone}
                    {b.billing && (
                      <details className="billing">
                        <summary>Számlázási adatok</summary>
                        {b.billing.businessName && <>{b.billing.businessName}<br /></>}
                        {b.billing.name}<br />
                        {b.billing.address?.postalCode} {b.billing.address?.city}, {b.billing.address?.line1}
                        {b.billing.address?.line2 && ` ${b.billing.address.line2}`}
                        {b.billing.address?.country && b.billing.address.country !== 'HU' && ` (${b.billing.address.country})`}
                        {b.billing.taxIds?.length > 0 && <><br />Adószám: {b.billing.taxIds.join(', ')}</>}
                      </details>
                    )}
                  </td>
                  <td>{b.people ?? '—'}</td>
                  <td>
                    {b.amount != null ? ft(b.amount) : '—'}
                    {b.creditUsed > 0 && <><br /><span className="small muted">kreditből: {ft(b.creditUsed)}</span></>}
                    {b.creditIssued > 0 && <><br /><span className="small muted">kredit vissza: {ft(b.creditIssued)}</span></>}
                    {b.refundAmount > 0 && <><br /><span className="small muted">kártyára vissza: {ft(b.refundAmount)}</span></>}
                  </td>
                  <td><span className={`badge badge-${b.status}`}>{STATUS_LABEL[b.status]}</span></td>
                  <td className="nowrap">
                    {b.status === 'blocked' && <button className="btn btn-ghost btn-sm" onClick={() => cancel(b)}>Visszaadás</button>}
                    {b.status === 'paid' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => cancel(b, 'credit')}>Lemondás (kredit)</button>
                        {(b.paidAmount ?? b.cardAmount) > 0 && <button className="btn btn-ghost btn-sm" onClick={() => cancel(b, 'refund')}>Lemondás (visszautalás)</button>}
                      </>
                    )}
                  </td>
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
  const [f, setF] = useState({ roomIds: [ROOMS[0].id], dateFrom: date, dateTo: date, weekdays: [], startHour: 17, endHour: 19, allDay: false, note: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // ha az admin másik napot választ fent, az űrlap is arra ugrik
  useEffect(() => setF((x) => ({ ...x, dateFrom: date, dateTo: x.dateTo < date ? date : x.dateTo })), [date]);

  const toggle = (key, val) => setF((x) => ({ ...x, [key]: x[key].includes(val) ? x[key].filter((v) => v !== val) : [...x[key], val] }));
  const multiDay = f.dateTo > f.dateFrom;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    const startHour = f.allDay ? OPEN_HOUR : Number(f.startHour);
    const endHour = f.allDay ? CLOSE_HOUR : Number(f.endHour);
    if (endHour <= startHour) return setError('A befejezésnek a kezdés után kell lennie.');
    if (!f.roomIds.length) return setError('Válassz legalább egy termet.');
    setBusy(true);
    try {
      const res = await httpsCallable(functions, 'createBlock')({
        roomIds: f.roomIds,
        dateFrom: f.dateFrom,
        dateTo: f.dateTo,
        weekdays: multiDay ? f.weekdays : [],
        startHour,
        endHour,
        note: f.note,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="card-title">Időszak kivétele a foglalásból</h2>
      <p className="muted small">Saját órák, rendezvény, karbantartás vagy telefonos foglalás esetén. A kivett időpontokat a vendégek foglaltként látják.</p>

      <fieldset className="chip-group">
        <legend>Termek</legend>
        {ROOMS.map((r) => (
          <label key={r.id} className={`chip ${f.roomIds.includes(r.id) ? 'on' : ''}`}>
            <input type="checkbox" checked={f.roomIds.includes(r.id)} onChange={() => toggle('roomIds', r.id)} /> {r.name}
          </label>
        ))}
      </fieldset>

      <div className="form-row">
        <label>Első nap<input type="date" required value={f.dateFrom} onChange={(e) => setF({ ...f, dateFrom: e.target.value, dateTo: f.dateTo < e.target.value ? e.target.value : f.dateTo })} /></label>
        <label>Utolsó nap<input type="date" required min={f.dateFrom} value={f.dateTo} onChange={(e) => setF({ ...f, dateTo: e.target.value })} /></label>
      </div>

      {multiDay && (
        <fieldset className="chip-group">
          <legend>Csak ezeken a napokon <span className="muted small">(üresen hagyva: minden nap)</span></legend>
          {WEEKDAYS.map((w, i) => (
            <label key={w} className={`chip ${f.weekdays.includes(i) ? 'on' : ''}`}>
              <input type="checkbox" checked={f.weekdays.includes(i)} onChange={() => toggle('weekdays', i)} /> {w}
            </label>
          ))}
        </fieldset>
      )}

      <label className="checkbox">
        <input type="checkbox" checked={f.allDay} onChange={(e) => setF({ ...f, allDay: e.target.checked })} />
        <span>Egész nap ({hh(OPEN_HOUR)} – {hh(CLOSE_HOUR)})</span>
      </label>
      {!f.allDay && (
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
      )}
      <label>Megjegyzés<input maxLength={200} value={f.note} placeholder="pl. Bachata kezdő óra" onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Mentés…' : 'Időszak kivétele'}</button>
      {error && <p className="form-error">{error}</p>}
      {result && (
        <div className="form-info">
          <p className="m0">{result.created} időpont kivéve.</p>
          {result.skipped.length > 0 && (
            <details>
              <summary>{result.skipped.length} kihagyva (foglalt vagy elmúlt)</summary>
              <ul className="small">
                {result.skipped.map((s) => (
                  <li key={`${s.roomId}-${s.date}`}>{prettyDate(s.date, { month: 'short', day: 'numeric', weekday: 'short' })} – {ROOMS.find((r) => r.id === s.roomId)?.name}: {s.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </form>
  );
}

function BlockGroups() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const q = query(collection(db, 'bookings'), where('type', '==', 'block'), where('status', '==', 'blocked'));
    return onSnapshot(q, (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => setMsg(e.message));
  }, []);

  const today = budapestDate();
  const groups = Object.values(
    items
      .filter((b) => b.date >= today)
      .reduce((acc, b) => {
        const key = b.groupId || b.id;
        (acc[key] ||= { key, isGroup: Boolean(b.groupId), items: [] }).items.push(b);
        return acc;
      }, {}),
  )
    .map((g) => {
      const dates = g.items.map((b) => b.date).sort();
      const rooms = [...new Set(g.items.map((b) => b.roomName))];
      return { ...g, first: dates[0], last: dates[dates.length - 1], rooms, sample: g.items[0] };
    })
    .sort((a, b) => a.first.localeCompare(b.first));

  const cancel = async (g) => {
    if (!window.confirm(`Visszaadod a foglalásba mind a(z) ${g.items.length} kivett időpontot?`)) return;
    try {
      if (g.isGroup) await httpsCallable(functions, 'cancelBlockGroup')({ groupId: g.key });
      else await httpsCallable(functions, 'cancelBooking')({ bookingId: g.key });
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">Kivett időszakok</h2>
      {groups.length === 0 ? (
        <p className="muted">Nincs jövőbeli kivett időszak.</p>
      ) : (
        <ul className="msg-list">
          {groups.map((g) => (
            <li key={g.key} className="block-group">
              <div>
                <strong>{g.sample.note || 'Blokkolás'}</strong>
                <span className="muted small">
                  {g.rooms.join(', ')} · {hh(g.sample.startHour)}–{hh(g.sample.endHour)} · {prettyDate(g.first, { month: 'short', day: 'numeric' })}
                  {g.last !== g.first && ` – ${prettyDate(g.last, { month: 'short', day: 'numeric' })}`} · {g.items.length} alkalom
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => cancel(g)}>Visszaadás</button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="form-error">{msg}</p>}
    </section>
  );
}

function CreditAdjust() {
  const [f, setF] = useState({ email: '', amount: '', note: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      const res = await httpsCallable(functions, 'adjustCredit')({ email: f.email, amount: Number.parseInt(f.amount, 10), note: f.note });
      setMsg(`${res.data.name} új egyenlege: ${ft(res.data.balance)}`);
      setF({ email: '', amount: '', note: '' });
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <form className="card form" onSubmit={submit}>
      <h2 className="card-title">Kredit kézi jóváírása</h2>
      <p className="muted small">Pl. kompenzáció vagy készpénzes befizetés. Levonáshoz adj meg negatív összeget.</p>
      <label>Felhasználó e-mail címe<input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
      <div className="form-row">
        <label>Összeg (Ft)<input type="number" required step={1} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label>Megjegyzés<input maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </div>
      <button className="btn btn-outline">Jóváírás</button>
      {msg && <p className="form-info">{msg}</p>}
      {error && <p className="form-error">{error}</p>}
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
        <p className="muted">Ez az oldal csak adminisztrátoroknak érhető el.</p>
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
        <div className="admin-layout">
          <div className="stack">
            <BlockGroups />
            <Messages />
          </div>
          <CreditAdjust />
        </div>
      </div>
    </div>
  );
}
