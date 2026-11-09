import { Link } from 'react-router-dom';
import Steps from '../components/Steps';
import Policy, { PricingNote } from '../components/Policy';
import { IconCalendar } from '../components/Icons';

const FAQ = [
  { q: 'Mennyi időre lehet termet bérelni?', a: 'Egész órás sávokban, egyszerre legfeljebb 8 órára. Hosszabb vagy rendszeres bérléshez keress minket, egyedi árat adunk.' },
  { q: 'Hogyan fizethetek?', a: 'Online, bankkártyával (Visa, Mastercard, Amex), Apple Pay-jel vagy Google Pay-jel a Stripe biztonságos fizetési oldalán. Kártyaadataidat mi nem látjuk és nem tároljuk.' },
  { q: 'Kapok számlát / nyugtát?', a: 'A sikeres fizetésről a Stripe automatikusan e-mailes nyugtát küld. Ha céges számlára van szükséged, írj nekünk a foglalás után.' },
  { q: 'Mi történik, ha nem fejezem be a fizetést?', a: 'A kiválasztott időpontot 30 percig fenntartjuk neked. Ha addig nem fizetsz, az időpont automatikusan újra szabaddá válik.' },
  { q: 'Hogyan mondhatom le a foglalásom?', a: 'A Fiókom oldalon egy kattintással. A visszatérítés összege a lemondási feltételek szerint automatikusan számolódik, és a kártyádra érkezik.' },
  { q: 'Mikor van nyitva a stúdió?', a: 'A termek reggel 7 és este 11 óra között foglalhatók. Ezen kívüli időpontra egyedi egyeztetéssel van lehetőség.' },
];

export default function HowItWorks() {
  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Hogyan működik?</p>
          <h1>Foglalás négy egyszerű lépésben</h1>
          <p className="lead muted">Telefonálgatás és üzengetés nélkül — a szabad időpontokat élőben látod.</p>
        </header>
        <Steps />
        <div className="row-actions mt-l">
          <Link to="/foglalas" className="btn btn-primary btn-lg"><IconCalendar /> Kezdjük!</Link>
        </div>

        <div className="split mt-xl">
          <Policy />
          <div className="policy">
            <h3>Árak</h3>
            <ul>
              <li><strong>Nagyterem:</strong> 4 000 Ft / óra</li>
              <li><strong>Egyiptomi terem:</strong> 3 000 Ft / óra</li>
              <li><strong>Industrial terem:</strong> 3 000 Ft / óra</li>
            </ul>
            <PricingNote />
          </div>
        </div>

        <h2 className="mt-xl">Gyakori kérdések</h2>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
