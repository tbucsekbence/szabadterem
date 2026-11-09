import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  ROOMS,
  getRoom,
  OPEN_HOUR,
  CLOSE_HOUR,
  MAX_DAYS_AHEAD,
  MAX_HOURS_PER_BOOKING,
  BASE_INCLUDED_PEOPLE,
  EXTRA_PERSON_PRICE,
  hourlyPrice,
  zonedTime,
  budapestDate,
  addDays,
  isValidDateStr,
  creditToApply,
} from '../../functions/shared/rooms.js';
import { ft, hh, img, prettyDate } from '../lib/format';
import Policy from '../components/Policy';
import { IconCard, IconClock, IconShield, IconUsers } from '../components/Icons';

const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
const STRIP_DAYS = 14;

export default function Booking() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profileComplete, credit } = useAuth();
  const [termsOk, setTermsOk] = useState(false);
  const [useCredit, setUseCredit] = useState(true);

  const today = budapestDate();
  const lastDay = addDays(today, MAX_DAYS_AHEAD);
  const roomId = getRoom(params.get('terem')) ? params.get('terem') : ROOMS[0].id;
  const dateParam = params.get('datum');
  const date = isValidDateStr(dateParam) && dateParam >= today && dateParam <= lastDay ? dateParam : today;
  const room = getRoom(roomId);

  const [occupied, setOccupied] = useState({});
  const [occLoading, setOccLoading] = useState(true);
  const [sel, setSel] = useState(null); // {start, end}
  const [people, setPeople] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [, setTick] = useState(0);

  // percenként frissítjük, hogy az elmúlt órák letiltódjanak
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, v));
    setParams(next, { replace: true });
    setSel(null);
    setError('');
  };

  useEffect(() => {
    setOccLoading(true);
    const unsub = onSnapshot(
      doc(db, 'occupancy', `${roomId}_${date}`),
      (snap) => {
        setOccupied((snap.exists() && snap.data().hours) || {});
        setOccLoading(false);
      },
      () => {
        setOccupied({});
        setOccLoading(false);
      },
    );
    return unsub;
  }, [roomId, date]);

  useEffect(() => {
    if (people > room.maxPeople) setPeople(room.maxPeople);
  }, [room, people]);

  const now = Date.now();
  const isPast = (h) => zonedTime(date, h).getTime() <= now;
  const isTaken = (h) => Boolean(occupied[h]);
  const isFree = (h) => !isPast(h) && !isTaken(h);
  const rangeFree = (a, b) => {
    for (let h = a; h < b; h++) if (!isFree(h)) return false;
    return true;
  };

  // ha közben valaki lefoglalta a kijelölt sávot
  useEffect(() => {
    if (!busy && sel && !rangeFree(sel.start, sel.end)) {
      setSel(null);
      setError('A kijelölt időpontot időközben lefoglalták. Kérjük, válassz másikat.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupied]);

  const clickHour = (h) => {
    setError('');
    if (!isFree(h)) return;
    if (!sel) return setSel({ start: h, end: h + 1 });
    if (h >= sel.start && h < sel.end) {
      return setSel(sel.end - sel.start === 1 ? null : { start: h, end: h + 1 });
    }
    const start = Math.min(sel.start, h);
    const end = Math.max(sel.end, h + 1);
    if (end - start <= MAX_HOURS_PER_BOOKING && rangeFree(start, end)) return setSel({ start, end });
    setSel({ start: h, end: h + 1 });
  };

  const hours = sel ? sel.end - sel.start : 0;
  const perHour = hourlyPrice(room, people);
  const total = perHour * hours;
  const creditApplied = user && useCredit && total > 0 ? creditToApply(total, credit) : 0;
  const toPay = total - creditApplied;

  const days = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)), [today]);

  const pay = async () => {
    if (!sel) return;
    const back = `/foglalas?terem=${roomId}&datum=${date}`;
    if (!user) return navigate(`/belepes?next=${encodeURIComponent(back)}`);
    if (!profileComplete) return navigate(`/profil?next=${encodeURIComponent(back)}`);
    if (!termsOk) return setError('A foglaláshoz fogadd el az Általános Szerződési Feltételeket.');
    setBusy(true);
    setError('');
    try {
      const fn = httpsCallable(functions, 'createCheckoutSession');
      const res = await fn({ roomId, date, startHour: sel.start, endHour: sel.end, people, termsAccepted: true, useCredit });
      if (res.data.paidWithCredit) navigate(`/foglalas/sikeres?b=${res.data.bookingId}`);
      else window.location.assign(res.data.url);
    } catch (err) {
      const msg = err?.code === 'functions/internal' && err.message === 'internal' ? 'A fizetési szolgáltatás jelenleg nem elérhető. Kérjük, próbáld újra később.' : err.message;
      setError(msg || 'Hiba történt a foglalás során.');
      setBusy(false);
    }
  };

  const freeCount = HOURS.filter(isFree).length;

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Terembérlés</p>
          <h1>Foglalj időpontot</h1>
          <p className="lead muted">Válassz termet, napot és idősávot — a foglaltság valós időben frissül.</p>
        </header>

        <div className="booking-layout">
          <div className="booking-main">
            <section className="card">
              <h2 className="card-title"><span className="num">1</span> Terem</h2>
              <div className="room-picker">
                {ROOMS.map((r) => (
                  <button key={r.id} className={`room-pick ${r.id === roomId ? 'active' : ''}`} onClick={() => update({ terem: r.id })} aria-pressed={r.id === roomId}>
                    <img src={img(r.cover, true)} alt="" />
                    <span className="room-pick-body">
                      <strong>{r.name}</strong>
                      <span>{r.size} m² · {ft(r.basePrice)}/óra</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="card">
              <h2 className="card-title"><span className="num">2</span> Nap</h2>
              <div className="day-strip" role="listbox" aria-label="Nap kiválasztása">
                {days.map((d) => {
                  const [, , dd] = d.split('-');
                  return (
                    <button key={d} role="option" aria-selected={d === date} className={`day ${d === date ? 'active' : ''}`} onClick={() => update({ datum: d })}>
                      <span className="day-name">{d === today ? 'Ma' : prettyDate(d, { weekday: 'short' })}</span>
                      <span className="day-num">{Number(dd)}</span>
                      <span className="day-month">{prettyDate(d, { month: 'short' })}</span>
                    </button>
                  );
                })}
              </div>
              <label className="date-input">
                Másik nap:
                <input type="date" min={today} max={lastDay} value={date} onChange={(e) => e.target.value && update({ datum: e.target.value })} />
              </label>
            </section>

            <section className="card">
              <h2 className="card-title"><span className="num">3</span> Idősáv <span className="muted small">— {prettyDate(date)}</span></h2>
              <p className="muted small">Kattints egy kezdő órára, majd a záró órára a sáv kijelöléséhez (legfeljebb {MAX_HOURS_PER_BOOKING} óra).</p>
              <div className={`slot-grid ${occLoading ? 'loading' : ''}`}>
                {HOURS.map((h) => {
                  const taken = isTaken(h);
                  const past = isPast(h);
                  const selected = sel && h >= sel.start && h < sel.end;
                  return (
                    <button
                      key={h}
                      className={`slot ${selected ? 'selected' : ''} ${taken ? 'taken' : ''} ${past ? 'past' : ''}`}
                      disabled={taken || past}
                      onClick={() => clickHour(h)}
                      aria-pressed={Boolean(selected)}
                    >
                      <span>{hh(h)}</span>
                      <small>{taken ? 'Foglalt' : past ? '—' : selected ? 'Kijelölve' : 'Szabad'}</small>
                    </button>
                  );
                })}
              </div>
              {!occLoading && freeCount === 0 && <p className="notice">Erre a napra már nincs szabad időpont ebben a teremben.</p>}
              <div className="legend">
                <span><i className="lg free" /> Szabad</span>
                <span><i className="lg sel" /> Kijelölt</span>
                <span><i className="lg taken" /> Foglalt</span>
              </div>
            </section>

            <section className="card">
              <h2 className="card-title"><span className="num">4</span> Létszám</h2>
              <div className="people">
                <IconUsers />
                <button className="btn btn-outline btn-icon" onClick={() => setPeople((p) => Math.max(1, p - 1))} aria-label="Kevesebb fő" disabled={people <= 1}>−</button>
                <output aria-live="polite">{people} fő</output>
                <button className="btn btn-outline btn-icon" onClick={() => setPeople((p) => Math.min(room.maxPeople, p + 1))} aria-label="Több fő" disabled={people >= room.maxPeople}>+</button>
              </div>
              <p className="muted small">
                {BASE_INCLUDED_PEOPLE} főig az alapár érvényes, minden további fő +{ft(EXTRA_PERSON_PRICE)} / óra. Ebben a teremben legfeljebb {room.maxPeople} fő.
              </p>
            </section>
          </div>

          <aside className="booking-summary card">
            <img src={img(room.cover, true)} alt="" className="summary-img" />
            <h3>{room.name}</h3>
            <dl className="summary-list">
              <div><dt>Dátum</dt><dd>{prettyDate(date, { month: 'long', day: 'numeric', weekday: 'short' })}</dd></div>
              <div><dt>Időpont</dt><dd>{sel ? `${hh(sel.start)} – ${hh(sel.end)}` : <span className="muted">válassz idősávot</span>}</dd></div>
              <div><dt>Időtartam</dt><dd>{hours ? `${hours} óra` : '—'}</dd></div>
              <div><dt>Létszám</dt><dd>{people} fő</dd></div>
              <div><dt>Óradíj</dt><dd>{ft(perHour)}</dd></div>
            </dl>
            {user && credit > 0 && (
              <label className="credit-toggle">
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                <span>
                  Kredit felhasználása <span className="muted small">(egyenleg: {ft(credit)})</span>
                </span>
                {creditApplied > 0 && <strong>−{ft(creditApplied)}</strong>}
              </label>
            )}
            <div className="summary-total">
              <span>{creditApplied > 0 ? 'Fizetendő' : 'Összesen'}</span>
              <strong>{ft(toPay)}</strong>
            </div>
            {user && (
              <label className="checkbox terms-check">
                <input type="checkbox" checked={termsOk} onChange={(e) => setTermsOk(e.target.checked)} />
                <span>
                  Elfogadom az <Link to="/aszf" target="_blank" className="link-accent">ÁSZF</Link>-et, és tudomásul veszem a lemondási feltételeket.
                </span>
              </label>
            )}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-block btn-lg" disabled={!sel || busy || (user && profileComplete && !termsOk)} onClick={pay}>
              <IconCard />{' '}
              {busy
                ? 'Feldolgozás…'
                : !user
                  ? 'Belépés Google-lel és foglalás'
                  : !profileComplete
                    ? 'Profil kitöltése és foglalás'
                    : sel && toPay === 0
                      ? 'Foglalás kreditből'
                      : 'Tovább a fizetéshez'}
            </button>
            <p className="secure-note"><IconShield width={16} height={16} /> Biztonságos fizetés a Stripe rendszerén keresztül.</p>
            <p className="secure-note"><IconClock width={16} height={16} /> A kiválasztott időpontot 30 percig fenntartjuk a fizetéshez.</p>
          </aside>
        </div>

        <div className="mt-xl">
          <Policy />
        </div>
      </div>
    </div>
  );
}
