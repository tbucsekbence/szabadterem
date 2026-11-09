import { Link } from 'react-router-dom';
import { ROOMS, BASE_INCLUDED_PEOPLE, EXTRA_PERSON_PRICE, HOLD_MINUTES, OPEN_HOUR, CLOSE_HOUR, TERMS_VERSION } from '../../functions/shared/rooms.js';
import { STUDIO, ft, prettyDate } from '../lib/format';

// Kitöltendő / egyeztetendő adat jelölése
const T = ({ children }) => <mark className="todo">[kitöltendő: {children}]</mark>;

export default function Terms() {
  return (
    <div className="page">
      <div className="container narrow legal">
        <header className="page-head">
          <p className="eyebrow">Jogi információk</p>
          <h1>Általános Szerződési Feltételek</h1>
          <p className="muted">Hatályos: {prettyDate(TERMS_VERSION, { year: 'numeric', month: 'long', day: 'numeric' })} napjától · Verzió: {TERMS_VERSION}</p>
        </header>

        <nav className="toc card" aria-label="Tartalomjegyzék">
          <ol>
            <li><a href="#szolgaltato">A Szolgáltató adatai</a></li>
            <li><a href="#fogalmak">Fogalmak</a></li>
            <li><a href="#hataly">Az ÁSZF hatálya és elfogadása</a></li>
            <li><a href="#fiok">Felhasználói fiók</a></li>
            <li><a href="#foglalas">A foglalás menete, a szerződés létrejötte</a></li>
            <li><a href="#dijak">Bérleti díjak</a></li>
            <li><a href="#fizetes">Fizetés</a></li>
            <li><a href="#lemondas">Lemondás, kredit</a></li>
            <li><a href="#elallas">Elállási jog</a></li>
            <li><a href="#hazirend">A termek használata (házirend)</a></li>
            <li><a href="#felelosseg">Felelősség</a></li>
            <li><a href="#panasz">Panaszkezelés, jogorvoslat</a></li>
            <li><a href="#adat">Adatkezelés</a></li>
            <li><a href="#zaro">Záró rendelkezések</a></li>
          </ol>
        </nav>

        <section id="szolgaltato">
          <h2>1. A Szolgáltató adatai</h2>
          <dl className="legal-dl">
            <dt>Név</dt><dd>Tóth-Bucsek Bence egyéni vállalkozó (Performance Tánc és Rekreációs Stúdió)</dd>
            <dt>Székhely</dt><dd>3181 Karancsalja, Petőfi út 8.</dd>
            <dt>Nyilvántartási szám</dt><dd><T>egyéni vállalkozói nyilvántartási szám</T></dd>
            <dt>Adószám</dt><dd>56756137-1-32</dd>
            <dt>A szolgáltatás helye</dt><dd>{STUDIO.address} ({STUDIO.addressNote})</dd>
            <dt>E-mail</dt><dd><a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a></dd>
            <dt>Telefon</dt><dd><a href={STUDIO.phoneHref}>{STUDIO.phone}</a></dd>
            <dt>Weboldal</dt><dd>https://szabadterem.hu</dd>
          </dl>
          <p>Közreműködő szolgáltatók:</p>
          <ul>
            <li><strong>Tárhely:</strong> GitHub, Inc. (GitHub Pages), 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA</li>
            <li><strong>Felhasználói fiókok és adatbázis:</strong> Google Ireland Ltd. (Firebase), Gordon House, Barrow Street, Dublin 4, Írország</li>
            <li><strong>Online fizetés:</strong> Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Írország</li>
          </ul>
        </section>

        <section id="fogalmak">
          <h2>2. Fogalmak</h2>
          <ul>
            <li><strong>Szolgáltató:</strong> az 1. pontban megjelölt vállalkozó.</li>
            <li><strong>Bérlő:</strong> az a természetes vagy jogi személy, aki a weboldalon fiókot hoz létre és termet foglal (lehet fogyasztó vagy vállalkozás, pl. tánctanár, egyesület).</li>
            <li><strong>Terem:</strong> a Szolgáltató által bérbe adott helyiségek ({ROOMS.map((r) => r.name).join(', ')}).</li>
            <li><strong>Foglalás:</strong> egy adott terem egy adott napon, egész órás idősávban történő, díjfizetéssel megerősített lefoglalása.</li>
            <li><strong>Kredit:</strong> a Bérlő fiókjában forintban nyilvántartott, kizárólag a weboldalon történő újabb foglalásra felhasználható egyenleg (lásd 8. pont).</li>
          </ul>
        </section>

        <section id="hataly">
          <h2>3. Az ÁSZF hatálya és elfogadása</h2>
          <p>Jelen ÁSZF a Szolgáltató és a Bérlő között a szabadterem.hu weboldalon keresztül létrejövő, órabér alapú terembérleti szerződésekre vonatkozik. A Bérlő a profilja kitöltésekor, valamint minden foglalás előtt kifejezetten elfogadja az ÁSZF mindenkor hatályos változatát; a foglalásnál elfogadott változat verzióját a rendszer rögzíti.</p>
          <p>A szerződés nyelve magyar. A szerződés elektronikus úton jön létre, a Szolgáltató a foglalás adatait elektronikusan tárolja, amelyek a Bérlő számára a fiókjában bármikor elérhetők.</p>
        </section>

        <section id="fiok">
          <h2>4. Felhasználói fiók</h2>
          <p>Foglalni kizárólag Google-fiókkal történő bejelentkezés után lehet. Első belépéskor a Bérlő rövid profilt tölt ki (név, telefonszám, a bérlés célja, oktatás esetén az iskola / egyesület neve, várható létszám, foglalási gyakoriság). A Bérlő felel a megadott adatok valódiságáért; valótlan adatok esetén a Szolgáltató a foglalást törölheti.</p>
          <p>A Bérlő köteles a fiókjához való hozzáférést megőrizni; a fiókjából indított foglalásokért ő felel.</p>
        </section>

        <section id="foglalas">
          <h2>5. A foglalás menete, a szerződés létrejötte</h2>
          <ol>
            <li>A Bérlő kiválasztja a termet, a napot, az idősávot (egész órák, {String(OPEN_HOUR).padStart(2, '0')}:00 és {CLOSE_HOUR}:00 között) és a létszámot.</li>
            <li>A rendszer kiszámolja a bérleti díjat, és – ha a Bérlőnek van kreditje – lehetőséget ad annak felhasználására.</li>
            <li>A Bérlő elfogadja az ÁSZF-et, majd a fizetési oldalon kifizeti a díjat. A kiválasztott időpontot a rendszer a fizetéshez {HOLD_MINUTES} percig fenntartja; ha ez alatt a fizetés nem történik meg, az időpont felszabadul.</li>
            <li>A szerződés a díj sikeres megfizetésével (illetve teljes kreditfedezet esetén a foglalás véglegesítésével) jön létre. A visszaigazolás a fiókban és e-mailben (fizetési nyugta) érkezik.</li>
          </ol>
          <p>Adatbeviteli hibát a Bérlő a fizetés elindítása előtt bármikor javíthat (a kiválasztott paraméterek módosításával).</p>
        </section>

        <section id="dijak">
          <h2>6. Bérleti díjak</h2>
          <ul>
            {ROOMS.map((r) => (
              <li key={r.id}><strong>{r.name}</strong> ({r.size} m², legfeljebb {r.maxPeople} fő): {ft(r.basePrice)} / óra</li>
            ))}
          </ul>
          <p>Az óradíj {BASE_INCLUDED_PEOPLE} főig érvényes; minden további fő után +{ft(EXTRA_PERSON_PRICE)} / óra. A díjak forintban értendők, <T>ÁFA-státusz, pl. „alanyi adómentes” vagy „az ÁFA-t tartalmazzák”</T>. A Szolgáltató a díjakat a jövőre nézve módosíthatja; a már létrejött foglalásokat ez nem érinti.</p>
          <p>A létszám a foglalt időre a teremben tartózkodó összes személyre vonatkozik (az oktatót is beleértve). A ténylegesen megjelent, a foglalásnál megadottnál nagyobb létszám esetén a Szolgáltató a különbözetet utólag kiszámlázhatja.</p>
        </section>

        <section id="fizetes">
          <h2>7. Fizetés</h2>
          <p>A díj fizetése online, bankkártyával (illetve Apple Pay / Google Pay szolgáltatással) a Stripe biztonságos fizetési oldalán történik. A kártyaadatok kizárólag a Stripe-hoz kerülnek, azokat a Szolgáltató nem látja és nem tárolja. A sikeres fizetésről a Stripe e-mailes nyugtát küld. <T>számlázás módja, pl. „Számlát a Szolgáltató elektronikusan állít ki a fizetést követően.”</T></p>
          <p>A díj részben vagy egészben kreditből is kiegyenlíthető. Ha a kredittel nem fedezett maradék a kártyás fizetés minimumánál (175 Ft) kevesebb lenne, a rendszer annyival kevesebb kreditet használ fel, hogy a kártyával fizetendő rész legalább 175 Ft legyen; a fel nem használt kredit az egyenlegen marad.</p>
        </section>

        <section id="lemondas">
          <h2>8. Lemondás, kredit</h2>
          <p>A Bérlő a foglalását a kezdés időpontjáig a fiókjában bármikor lemondhatja. <strong>A lemondás után visszajáró összeget a Szolgáltató kredit formájában írja jóvá</strong> a Bérlő fiókjában, az alábbiak szerint:</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Lemondás ideje a kezdéshez képest</th><th>Jóváírt kredit</th></tr></thead>
              <tbody>
                <tr><td>több mint 48 órával előtte</td><td><strong>a teljes díj (100%)</strong> — a lemondás díjtalan</td></tr>
                <tr><td>48 órán belül, de több mint 24 órával előtte</td><td><strong>a díj 50%-a</strong></td></tr>
                <tr><td>24 órán belül, illetve meg nem jelenés esetén</td><td><strong>nincs jóváírás</strong> — a teljes díj elvész</td></tr>
              </tbody>
            </table>
          </div>
          <p>A kredit szabályai:</p>
          <ul>
            <li>a kredit kizárólag a szabadterem.hu weboldalon történő újabb teremfoglalásra használható fel, bármely teremre;</li>
            <li>a kredit készpénzre nem váltható, pénzben nem fizethető vissza, más felhasználóra nem ruházható át;</li>
            <li>a kredit felhasználására nyitva álló határidő: <T>pl. a jóváírástól számított 12 hónap</T>;</li>
            <li>az egyenleg és a mozgások a fiókban („Fiókom”) mindig megtekinthetők.</li>
          </ul>
          <p>Foglalás módosítására lemondással és új foglalással van lehetőség; a lemondásra a fenti szabályok vonatkoznak.</p>
          <p><strong>Ha a foglalást a Szolgáltató mondja le</strong> (pl. műszaki hiba, vis maior), a Bérlőnek a teljes díj jár vissza: választása szerint kreditként vagy a fizetéshez használt kártyára visszautalva.</p>
        </section>

        <section id="elallas">
          <h2>9. Elállási jog</h2>
          <p>A fogyasztó és a vállalkozás közötti szerződések részletes szabályairól szóló 45/2014. (II. 26.) Korm. rendelet 29. § (1) bekezdés l) pontja alapján a fogyasztót nem illeti meg a 14 napos indokolás nélküli elállási jog, mivel a terembérlés szabadidős tevékenységhez kapcsolódó, meghatározott teljesítési időpontra szóló szolgáltatás. A lemondásra a 8. pont szabályai irányadók.</p>
        </section>

        <section id="hazirend">
          <h2>10. A termek használata (házirend)</h2>
          <ul>
            <li>A terem a foglalt idősáv kezdetétől annak végéig használható; az érkezésnek, átöltözésnek, pakolásnak és a terem elhagyásának is a foglalt időn belül kell megtörténnie, hogy a következő Bérlő időben kezdhessen.</li>
            <li>A teremben a foglalásnál megadott, de legfeljebb a terem befogadóképességének megfelelő létszám tartózkodhat.</li>
            <li>A termekbe csak tiszta, váltott (beltéri) cipőben lehet belépni; a parkettát sértő lábbeli (pl. tűsarok gumi védő nélkül) használata tilos.</li>
            <li>A teremben étkezni, valamint vízen kívül egyéb italt fogyasztani tilos. Az épületben a dohányzás és az alkohol- vagy kábítószer-fogyasztás tilos.</li>
            <li>A Bérlő köteles a termet és annak berendezéseit (tükör, hangtechnika, világítás) rendeltetésszerűen használni, és a terem állapotát a használat után az átvételkori állapotban hagyni.</li>
            <li>A hangerőt úgy kell megválasztani, hogy az a szomszédos termeket és az épület lakóit ne zavarja.</li>
            <li>Kiskorúak csak felnőtt felügyelete mellett tartózkodhatnak a teremben; a felügyeletért a Bérlő felel.</li>
            <li>A Bérlő az általa tartott óráért, foglalkozásért, annak résztvevőiért és szakmai tartalmáért maga felel; a Szolgáltató kizárólag a helyiséget biztosítja.</li>
            <li>A házirend súlyos vagy ismételt megsértése esetén a Szolgáltató a további foglalásokat kredit-jóváírás nélkül törölheti, és a Bérlő fiókját felfüggesztheti.</li>
          </ul>
        </section>

        <section id="felelosseg">
          <h2>11. Felelősség</h2>
          <p>A Bérlő teljes kártérítési felelősséggel tartozik a terem berendezésében, felszerelésében általa vagy az óráján részt vevő személyek által okozott károkért. A Szolgáltató nem felel a termekben hagyott személyes tárgyakért, valamint a sporttevékenység során bekövetkező, nem a Szolgáltató által okozott sérülésekért. A Szolgáltató nem felel a vis maior (pl. áramszünet, hatósági intézkedés) miatt elmaradt foglalásokért; ilyenkor a 8. pont utolsó bekezdése szerint jár el.</p>
        </section>

        <section id="panasz">
          <h2>12. Panaszkezelés, jogorvoslat</h2>
          <p>Panaszát a Bérlő a <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> címen vagy a {STUDIO.phone} telefonszámon jelezheti. A Szolgáltató az írásbeli panaszt 30 napon belül érdemben megvizsgálja és megválaszolja.</p>
          <p>Fogyasztói jogvita esetén a fogyasztó a lakóhelye vagy tartózkodási helye szerint illetékes, illetve a Szolgáltató székhelye szerint illetékes békéltető testülethez fordulhat. A Szolgáltató székhelye szerint illetékes: Nógrád Vármegyei Békéltető Testület <T>cím és elérhetőség ellenőrzése</T>. A fogyasztó panasszal fordulhat a fogyasztóvédelmi hatósághoz (kormányhivatal) is, illetve igényét bíróság előtt is érvényesítheti.</p>
        </section>

        <section id="adat">
          <h2>13. Adatkezelés</h2>
          <p>A személyes adatok kezelésére a Szolgáltató <a href="https://www.performancestudio.hu/adatvedelem/" target="_blank" rel="noreferrer">adatkezelési tájékoztatója</a> az irányadó. A foglaláshoz megadott adatokat (név, e-mail, telefonszám, profiladatok, foglalási és kreditadatok) a Szolgáltató a szerződés teljesítése és a kapcsolattartás céljából kezeli.</p>
        </section>

        <section id="zaro">
          <h2>14. Záró rendelkezések</h2>
          <p>A Szolgáltató jogosult az ÁSZF-et egyoldalúan módosítani; a módosítás a közzétételt követően létrejövő foglalásokra vonatkozik. A jelen ÁSZF-ben nem szabályozott kérdésekben a Polgári Törvénykönyvről szóló 2013. évi V. törvény, valamint a vonatkozó fogyasztóvédelmi jogszabályok rendelkezései az irányadók.</p>
          <p className="muted small">Kérdésed van? <Link to="/kapcsolat" className="link-accent">Írj nekünk!</Link></p>
        </section>
      </div>
    </div>
  );
}
