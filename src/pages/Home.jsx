import { Link } from 'react-router-dom';
import { ROOMS } from '../../functions/shared/rooms.js';
import RoomCard from '../components/RoomCard';
import Steps from '../components/Steps';
import Gallery from '../components/Gallery';
import { img } from '../lib/format';
import { IconArrow, IconCalendar, IconCard, IconLayers, IconSparkle } from '../components/Icons';

const FEATURES = [
  { icon: IconCalendar, text: ['Online foglalás', 'néhány kattintással'] },
  { icon: IconLayers, text: ['Többféle teremméret', 'és felszereltség'] },
  { icon: IconSparkle, text: ['Ideális órákhoz,', 'próbákhoz, workshopokhoz'] },
  { icon: IconCard, text: ['Biztonságos,', 'online fizetés'] },
];

const TECH = [
  { title: 'Luxus vinyl parketta', text: 'Ízületkímélő, csúszásbiztos burkolat minden teremben.' },
  { title: 'Prémium hangtechnika', text: 'Bose és Harman/Kardon rendszerek, kristálytiszta hangzás.' },
  { title: 'Klíma és légcsere', text: 'Fűt, hűt, és 15 perc alatt a teljes levegőt kicseréli.' },
  { title: 'Hangszigetelés', text: 'Mély-, közép- és magashangokra is hatékony szigetelés.' },
  { title: 'Egyedi világítás', text: 'Termenként tervezett, az óra jellegéhez állítható fények.' },
  { title: 'Központi helyszín', text: 'IX. kerület, Ipar utca 3. — a Boráros térnél.' },
];

const GALLERY = ['ps-1', 'ps-38', 'ps-29', 'ps-31', 'ps-33', 'ps-30', 'ps-24', 'ps-25', 'ps-17', 'ps-39', 'ps-34', 'ps-36'];

export default function Home() {
  return (
    <>
      <section className="hero">
        <img className="hero-bg" src={img('ps-43')} alt="" fetchpriority="high" />
        <div className="hero-shade" />
        <div className="container hero-content">
          <h1>Bérelj tánctermet rugalmasan, online!</h1>
          <p className="lead">Professzionális tánctermek órákra, próbákra, workshopokra és eseményekre — Budapest szívében.</p>
          <div className="hero-actions">
            <Link to="/foglalas" className="btn btn-primary btn-lg">
              <IconCalendar /> Teremfoglalás
            </Link>
            <Link to="/termeink" className="btn btn-outline btn-lg">
              Termeink megtekintése
            </Link>
          </div>
        </div>
      </section>

      <section className="feature-strip">
        <div className="container feature-grid">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div className="feature" key={text[0]}>
              <Icon width={34} height={34} />
              <p>{text[0]}<br />{text[1]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Termeink</h2>
            <Link to="/termeink" className="link-accent">
              Összes terem megtekintése <IconArrow width={18} height={18} />
            </Link>
          </div>
          <div className="room-grid">
            {ROOMS.map((r) => (
              <RoomCard key={r.id} room={r} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Hogyan működik?</h2>
          </div>
          <Steps />
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <div>
            <p className="eyebrow">A stúdió</p>
            <h2>Minden, ami egy jó órához kell</h2>
            <p className="muted">
              A Performance Tánc és Rekreációs Stúdió három egyedi hangulatú termét óradíjas bérlésre is kínáljuk táncoktatóknak, edzőknek, csapatoknak és mindenkinek, aki minőségi
              környezetben szeretne mozogni, próbálni vagy alkotni.
            </p>
            <div className="tech-grid">
              {TECH.map((t) => (
                <div key={t.title} className="tech">
                  <h4>{t.title}</h4>
                  <p>{t.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="split-media">
            <img src={img('ps-29', true)} alt="A stúdió előtere" loading="lazy" />
            <img src={img('ps-2', true)} alt="Részlet a stúdióból" loading="lazy" />
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <h2>Galéria</h2>
          </div>
          <Gallery images={GALLERY} />
        </div>
      </section>

      <section className="section">
        <div className="container cta">
          <div>
            <h2>Foglald le a következő órád helyszínét</h2>
            <p className="muted">Nézd meg a szabad időpontokat, és foglalj pár kattintással.</p>
          </div>
          <Link to="/foglalas" className="btn btn-primary btn-lg">
            <IconCalendar /> Szabad időpontok
          </Link>
        </div>
      </section>
    </>
  );
}
