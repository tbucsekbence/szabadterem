import { BASE_INCLUDED_PEOPLE, EXTRA_PERSON_PRICE } from '../../functions/shared/rooms.js';
import { ft } from '../lib/format';

export function PricingNote() {
  return (
    <p className="muted small">
      Az óradíj {BASE_INCLUDED_PEOPLE} főig érvényes, minden további fő +{ft(EXTRA_PERSON_PRICE)} / óra. Hosszabb távú, rendszeres bérlés esetén egyedi árat adunk — keress minket!
    </p>
  );
}

export default function Policy() {
  return (
    <div className="policy">
      <h3>Lemondási feltételek</h3>
      <ul>
        <li><strong>48 órával előtte</strong> díjmentesen lemondható — a teljes összeget visszatérítjük.</li>
        <li><strong>48 órán belül</strong> a bérleti díj 50%-át számítjuk fel.</li>
        <li><strong>24 órán belül</strong> a teljes összeget felszámítjuk.</li>
      </ul>
      <p className="muted small">A lemondást a fiókodban egy kattintással intézheted, a visszatérítés automatikusan a fizetéshez használt kártyára érkezik.</p>
    </div>
  );
}
