import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoUrl } from '../lib/format';
import { IconMenu, IconX, IconUser } from './Icons';

const NAV = [
  { to: '/termeink', label: 'Termeink' },
  { to: '/foglalas', label: 'Terembérlés' },
  { to: '/hogyan-mukodik', label: 'Hogyan működik?' },
  { to: '/kapcsolat', label: 'Kapcsolat' },
];

export default function Header({ overlay }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header ${overlay && !scrolled && !open ? 'is-overlay' : 'is-solid'}`}>
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="Performance Studio – főoldal">
          <img src={logoUrl} alt="Performance Studio" className="brand-logo" />
          <span className="brand-sub">Terembérlés</span>
        </Link>

        <nav className={`main-nav ${open ? 'open' : ''}`} aria-label="Fő navigáció">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-link">
              {n.label}
            </NavLink>
          ))}
          <div className="nav-actions">
            {user ? (
              <>
                {isAdmin && (
                  <NavLink to="/admin" className="btn btn-ghost btn-sm">
                    Admin
                  </NavLink>
                )}
                <NavLink to="/fiokom" className="btn btn-outline btn-sm">
                  <IconUser width={18} height={18} /> Fiókom
                </NavLink>
                <button className="btn btn-ghost btn-sm" onClick={logout}>
                  Kilépés
                </button>
              </>
            ) : (
              <>
                <Link to="/belepes" className="btn btn-outline btn-sm">
                  Belépés
                </Link>
                <Link to="/regisztracio" className="btn btn-primary btn-sm">
                  Regisztráció
                </Link>
              </>
            )}
          </div>
        </nav>

        <button className="menu-toggle" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Menü bezárása' : 'Menü megnyitása'} aria-expanded={open}>
          {open ? <IconX /> : <IconMenu />}
        </button>
      </div>
    </header>
  );
}
