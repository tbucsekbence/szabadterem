import { Link } from 'react-router-dom';
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
      <p className="muted small">Lemondáskor a visszajáró összeget <strong>kreditként</strong> írjuk jóvá a fiókodban, amit bármelyik következő foglalásodnál felhasználhatsz.</p>
      <ul>
        <li><strong>48 órán túl</strong> a lemondás díjtalan — a teljes összeg kreditként jóváírásra kerül.</li>
        <li><strong>48 órán belül</strong> az összeg 50%-a kerül jóváírásra kreditként.</li>
        <li><strong>24 órán belül</strong> a teljes összeg elvész.</li>
      </ul>
      <p className="muted small">
        A lemondást a fiókodban egy kattintással intézheted. Részletek az <Link to="/aszf#lemondas" className="link-accent">ÁSZF</Link>-ben.
      </p>
    </div>
  );
}
