export const img = (name, small = false) => `${import.meta.env.BASE_URL}images/${name}${small ? '-sm' : ''}.webp`;
export const logoUrl = `${import.meta.env.BASE_URL}images/logo.svg`;

// A hu-HU locale a 4 jegyű számokat nem tagolja, ezért kézzel tesszük be a (nem törő) szóközt: 4 000 Ft
export const ft = (n) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Ft`;

export const hh = (h) => `${String(h).padStart(2, '0')}:00`;

export function prettyDate(dateStr, opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('hu-HU', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export const STATUS_LABEL = {
  pending: 'Fizetésre vár',
  paid: 'Fizetve',
  cancelled: 'Lemondva',
  expired: 'Lejárt',
  refunded: 'Visszatérítve',
  blocked: 'Blokkolva',
};

/** Firebase hibakódok magyarul */
export function authError(err) {
  const map = {
    'auth/invalid-credential': 'Hibás e-mail cím vagy jelszó.',
    'auth/wrong-password': 'Hibás e-mail cím vagy jelszó.',
    'auth/user-not-found': 'Ezzel az e-mail címmel nincs regisztráció.',
    'auth/email-already-in-use': 'Ezzel az e-mail címmel már regisztráltak.',
    'auth/weak-password': 'A jelszónak legalább 6 karakterből kell állnia.',
    'auth/invalid-email': 'Érvénytelen e-mail cím.',
    'auth/too-many-requests': 'Túl sok próbálkozás. Próbáld újra pár perc múlva.',
    'auth/popup-closed-by-user': 'A bejelentkezési ablak bezárult.',
    'auth/network-request-failed': 'Hálózati hiba. Ellenőrizd az internetkapcsolatot.',
  };
  return map[err?.code] || err?.message || 'Ismeretlen hiba történt.';
}

export const STUDIO = {
  name: 'Performance Studio',
  fullName: 'Performance Tánc és Rekreációs Stúdió',
  address: '1095 Budapest, Ipar utca 3.',
  addressNote: 'a Boráros térnél',
  phone: '+36 20 322 9195',
  phoneHref: 'tel:+36203229195',
  email: 'hello@performancestudio.hu',
  facebook: 'https://www.facebook.com/performancestudiobudapest',
  instagram: 'https://www.instagram.com/performancestudiobudapest/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Budapest+Ipar+utca+3',
};
