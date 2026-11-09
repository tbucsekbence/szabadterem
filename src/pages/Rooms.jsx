import { Link } from 'react-router-dom';
import { ROOMS } from '../../functions/shared/rooms.js';
import { ft, img } from '../lib/format';
import { PricingNote } from '../components/Policy';
import { IconArrow, IconCalendar, IconCheck } from '../components/Icons';

export default function Rooms() {
  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Termeink</p>
          <h1>Három terem, három hangulat</h1>
          <p className="lead muted">Válaszd ki az órádhoz, próbádhoz vagy workshopodhoz illő teret.</p>
        </header>

        <div className="room-list">
          {ROOMS.map((r) => (
            <article key={r.id} className="room-row">
              <Link to={`/termeink/${r.id}`} className="room-row-media">
                <img src={img(r.cover)} alt={r.name} loading="lazy" />
              </Link>
              <div className="room-row-body">
                <h2>{r.name}</h2>
                <p className="muted">{r.tagline}</p>
                <ul className="check-list">
                  {r.features.map((f) => (
                    <li key={f}><IconCheck width={18} height={18} /> {f}</li>
                  ))}
                </ul>
                <p className="room-price big">
                  <strong>{ft(r.basePrice)}</strong> / óra
                </p>
                <div className="row-actions">
                  <Link to={`/foglalas?terem=${r.id}`} className="btn btn-primary">
                    <IconCalendar /> Foglalás
                  </Link>
                  <Link to={`/termeink/${r.id}`} className="btn btn-outline">
                    Részletek <IconArrow width={18} height={18} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
        <PricingNote />
      </div>
    </div>
  );
}
