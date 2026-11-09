import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { STUDIO, img } from '../lib/format';
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin } from '../components/Icons';

export default function Contact() {
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [state, setState] = useState('idle');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    try {
      await addDoc(collection(db, 'contactMessages'), {
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        message: f.message.trim(),
        createdAt: serverTimestamp(),
      });
      setState('sent');
      setF({ name: '', email: '', phone: '', message: '' });
    } catch {
      setState('error');
    }
  };

  return (
    <div className="page">
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Kapcsolat</p>
          <h1>Kérdésed van? Írj nekünk!</h1>
          <p className="lead muted">Rendszeres bérlés, rendezvény, fotózás vagy egyedi igény esetén is szívesen segítünk.</p>
        </header>
        <div className="contact-layout">
          <div className="contact-info">
            <img src={img('ps-38', true)} alt="A Performance Studio bejárata" className="contact-img" />
            <ul className="contact-list">
              <li><IconPin /><div><strong>{STUDIO.address}</strong><span className="muted">{STUDIO.addressNote} · <a href={STUDIO.mapsUrl} target="_blank" rel="noreferrer" className="link-accent">Útvonaltervezés</a></span></div></li>
              <li><IconPhone /><div><a href={STUDIO.phoneHref}><strong>{STUDIO.phone}</strong></a><span className="muted">Hívás vagy SMS</span></div></li>
              <li><IconMail /><div><a href={`mailto:${STUDIO.email}`}><strong>{STUDIO.email}</strong></a><span className="muted">Általában 1 munkanapon belül válaszolunk</span></div></li>
            </ul>
            <div className="socials">
              <a href={STUDIO.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><IconFacebook /></a>
              <a href={STUDIO.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><IconInstagram /></a>
            </div>
          </div>
          <form className="card form" onSubmit={submit}>
            <h2 className="card-title">Üzenet küldése</h2>
            <label>Név<input required maxLength={100} value={f.name} onChange={set('name')} autoComplete="name" /></label>
            <div className="form-row">
              <label>E-mail<input type="email" required maxLength={200} value={f.email} onChange={set('email')} autoComplete="email" /></label>
              <label>Telefonszám<input type="tel" maxLength={30} value={f.phone} onChange={set('phone')} autoComplete="tel" /></label>
            </div>
            <label>Üzenet<textarea required rows={6} maxLength={3000} value={f.message} onChange={set('message')} /></label>
            {state === 'sent' && <p className="form-info">Köszönjük, üzenetedet megkaptuk!</p>}
            {state === 'error' && <p className="form-error">Nem sikerült elküldeni. Írj nekünk e-mailt: {STUDIO.email}</p>}
            <button className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Küldés…' : 'Küldés'}</button>
          </form>
        </div>
        <div className="map-wrap">
          <iframe
            title="Térkép – Performance Studio"
            src="https://www.google.com/maps?q=Budapest%2C%20Ipar%20utca%203&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
