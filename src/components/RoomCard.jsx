import { Link } from 'react-router-dom';
import { ft, img } from '../lib/format';

export default function RoomCard({ room }) {
  return (
    <Link to={`/termeink/${room.id}`} className="room-card">
      <img src={img(room.cover, true)} alt={room.name} loading="lazy" />
      <div className="room-card-body">
        <h3>{room.name}</h3>
        <p className="room-meta">
          <span>{room.size} m²</span>
          <span>{room.features[1].toLowerCase()}</span>
          <span>{room.features[2].toLowerCase()}</span>
        </p>
        <p className="room-price">
          <strong>{ft(room.basePrice)}</strong> / óra
        </p>
      </div>
    </Link>
  );
}
