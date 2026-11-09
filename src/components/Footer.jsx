import { Link } from 'react-router-dom';
import { STUDIO, logoUrl } from '../lib/format';
import { IconFacebook, IconInstagram, IconMail, IconPhone, IconPin } from './Icons';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <img src={logoUrl} alt="Performance Studio" className="brand-logo footer-logo" />
          <p className="muted small">{STUDIO.fullName}. Professzionális tánctermek bérlése online foglalással, Budapest szívében.</p>
          <div className="socials">
            <a href={STUDIO.facebook} target="_blank" rel="noreferrer" aria-label="Facebook"><IconFacebook /></a>
            <a href={STUDIO.instagram} target="_blank" rel="noreferrer" aria-label="Instagram"><IconInstagram /></a>
          </div>
        </div>
        <div>
          <h4>Oldalak</h4>
          <ul className="footer-links">
            <li><Link to="/termeink">Termeink</Link></li>
            <li><Link to="/foglalas">Teremfoglalás</Link></li>
            <li><Link to="/hogyan-mukodik">Hogyan működik?</Link></li>
            <li><Link to="/kapcsolat">Kapcsolat</Link></li>
          </ul>
        </div>
        <div>
          <h4>Elérhetőség</h4>
          <ul className="footer-contact">
            <li><IconPin width={18} height={18} /><a href={STUDIO.mapsUrl} target="_blank" rel="noreferrer">{STUDIO.address}</a></li>
            <li><IconPhone width={18} height={18} /><a href={STUDIO.phoneHref}>{STUDIO.phone}</a></li>
            <li><IconMail width={18} height={18} /><a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a></li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} Performance Studio</span>
        <span>
          <Link to="/aszf">ÁSZF</Link>
          {' · '}
          <a href="https://www.performancestudio.hu/impresszum/" target="_blank" rel="noreferrer">Impresszum</a>
          {' · '}
          <a href="https://www.performancestudio.hu/adatvedelem/" target="_blank" rel="noreferrer">Adatvédelem</a>
        </span>
      </div>
    </footer>
  );
}
