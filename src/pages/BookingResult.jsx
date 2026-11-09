import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ft, hh, prettyDate } from '../lib/format';
import { IconCheck, IconClock, IconX } from '../components/Icons';

export default function BookingResult({ success = false }) {
  const [params] = useSearchParams();
  const bookingId = params.get('b');
  const { user, loading } = useAuth();
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    if (!user || !bookingId) return;
    return onSnapshot(doc(db, 'bookings', bookingId), (s) => setBooking(s.exists() ? s.data() : null), () => setBooking(null));
  }, [user, bookingId]);

  // megszakított fizetés: az időpontot azonnal felszabadítjuk
  useEffect(() => {
    if (success || !user || !bookingId) return;
    httpsCallable(functions, 'releasePendingBooking')({ bookingId }).catch(() => {});
  }, [success, user, bookingId]);

  const paid = booking?.status === 'paid';

  return (
    <div className="page">
      <div className="container narrow center">
        {success ? (
          <>
            <div className={`result-icon ${paid ? 'ok' : 'wait'}`}>{paid ? <IconCheck width={40} height={40} /> : <IconClock width={40} height={40} />}</div>
            <h1>{paid ? 'Sikeres foglalás!' : 'Fizetés feldolgozása…'}</h1>
            <p className="lead muted">
              {paid ? 'Köszönjük! A foglalásod rögzítettük, a Stripe-tól e-mailben megkapod a nyugtát.' : 'A fizetést megkaptuk, a visszaigazolás néhány másodpercen belül megérkezik.'}
            </p>
          </>
        ) : (
          <>
            <div className="result-icon fail"><IconX width={40} height={40} /></div>
            <h1>A fizetés megszakadt</h1>
            <p className="lead muted">Nem történt terhelés, az időpontot felszabadítottuk. Bármikor újra próbálkozhatsz.</p>
          </>
        )}

        {booking && (
          <div className="card result-card">
            <dl className="summary-list">
              <div><dt>Terem</dt><dd>{booking.roomName}</dd></div>
              <div><dt>Dátum</dt><dd>{prettyDate(booking.date)}</dd></div>
              <div><dt>Időpont</dt><dd>{hh(booking.startHour)} – {hh(booking.endHour)}</dd></div>
              <div><dt>Létszám</dt><dd>{booking.people} fő</dd></div>
              <div><dt>Összeg</dt><dd>{ft(booking.amount)}</dd></div>
            </dl>
          </div>
        )}
        {!loading && !user && <p className="muted">A foglalás részleteihez <Link to="/belepes" className="link-accent">jelentkezz be</Link>.</p>}

        <div className="row-actions center">
          <Link to="/fiokom" className="btn btn-primary">Foglalásaim</Link>
          <Link to="/foglalas" className="btn btn-outline">Új foglalás</Link>
        </div>
      </div>
    </div>
  );
}
