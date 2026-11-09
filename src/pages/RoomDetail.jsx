import { Link, useParams } from 'react-router-dom';
import { ROOMS, getRoom } from '../../functions/shared/rooms.js';
import { ft, img } from '../lib/format';
import Gallery from '../components/Gallery';
import Policy, { PricingNote } from '../components/Policy';
import RoomCard from '../components/RoomCard';
import NotFound from './NotFound';
import { IconArrowLeft, IconCalendar, IconCheck, IconSquare, IconUsers } from '../components/Icons';

export default function RoomDetail() {
  const { id } = useParams();
  const room = getRoom(id);
  if (!room) return <NotFound />;
  const others = ROOMS.filter((r) => r.id !== room.id);

  return (
    <div className="page">
      <div className="container">
        <Link to="/termeink" className="back-link"><IconArrowLeft width={18} height={18} /> Összes terem</Link>

        <div className="detail-hero">
          <img src={img(room.cover)} alt={room.name} />
        </div>

        <div className="detail-grid">
          <div>
            <h1>{room.name}</h1>
            <p className="lead">{room.tagline}</p>
            <p className="muted">{room.description}</p>
            <ul className="check-list two-col">
              {room.features.map((f) => (
                <li key={f}><IconCheck width={18} height={18} /> {f}</li>
              ))}
            </ul>
          </div>
          <aside className="booking-aside card">
            <p className="room-price big"><strong>{ft(room.basePrice)}</strong> / óra</p>
            <p className="aside-meta"><IconSquare width={18} height={18} /> {room.size} m²</p>
            <p className="aside-meta"><IconUsers width={18} height={18} /> legfeljebb {room.maxPeople} fő</p>
            <Link to={`/foglalas?terem=${room.id}`} className="btn btn-primary btn-block">
              <IconCalendar /> Szabad időpontok
            </Link>
            <PricingNote />
          </aside>
        </div>

        <h2 className="mt-xl">Képek</h2>
        <Gallery images={room.images} alt={room.name} />

        <div className="mt-xl">
          <Policy />
        </div>

        <h2 className="mt-xl">További termeink</h2>
        <div className="room-grid two">
          {others.map((r) => (
            <RoomCard key={r.id} room={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
