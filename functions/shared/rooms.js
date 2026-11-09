// Közös adatok és üzleti logika — ezt használja a weboldal ÉS a Cloud Functions is,
// így az ár mindig a szerveren számolódik ugyanazzal a szabállyal.

export const TIMEZONE = 'Europe/Budapest';
export const OPEN_HOUR = 7; // első foglalható óra kezdete
export const CLOSE_HOUR = 23; // utolsó foglalható óra vége
export const BASE_INCLUDED_PEOPLE = 3; // ennyi főig az alapár érvényes
export const EXTRA_PERSON_PRICE = 500; // Ft / fő / óra a fenti létszám felett
export const MAX_DAYS_AHEAD = 90; // ennyi napra előre lehet foglalni
export const MAX_HOURS_PER_BOOKING = 8;
export const HOLD_MINUTES = 30; // fizetésig ennyi ideig van fenntartva az időpont (Stripe minimum)

// Szuperadminok: ezek az (igazolt) e-mail címek mindig admin jogot kapnak.
// FIGYELEM: módosításkor a firestore.rules isSuperadmin() listáját is frissíteni kell!
export const SUPERADMIN_EMAILS = ['bucsek93@gmail.com'];

export function isSuperadminEmail(email, emailVerified) {
  return Boolean(emailVerified && email && SUPERADMIN_EMAILS.includes(String(email).toLowerCase()));
}

export const WEEKDAYS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']; // index: 0 = hétfő

/** 0 = hétfő ... 6 = vasárnap */
export function weekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const ROOMS = [
  {
    id: 'nagyterem',
    name: 'Nagyterem',
    size: 55,
    basePrice: 4000,
    maxPeople: 25,
    cover: 'ps-45',
    tagline: 'Letisztult, minimalista tér háromszintes LED-mennyezettel.',
    description:
      'A stúdió legnagyobb terme fehér falakkal, szürke kőbetétekkel és sötét parkettával. A háromszintes, színváltós LED-mennyezettel a hangulat percek alatt az óra stílusához igazítható. Társastánchoz, latinhoz, fitneszhez, csoportos órákhoz és próbákhoz egyaránt ideális.',
    features: ['55 m²', 'Tükörfal', 'Prémium hangtechnika', 'Színváltós LED-mennyezet', 'Klíma és légcsere'],
    images: ['ps-45', 'ps-43', 'ps-44', 'ps-47', 'ps-40', 'ps-42', 'ps-46', 'ps-6', 'ps-5-1', 'ps-6-1', 'ps-1-1', 'ps-9', 'ps-8', 'ps-2-1', 'ps-4-1'],
  },
  {
    id: 'egyiptomi',
    name: 'Egyiptomi terem',
    size: 20,
    basePrice: 3000,
    maxPeople: 8,
    cover: 'ps-13',
    tagline: 'Sivatagi homokszínek, hieroglifás kőtáblák, rejtett RGB-fények.',
    description:
      'Egyedi, egyiptomi hangulatú terem homokszínű falakkal és hieroglifás kőtáblákkal. A két rövidebb fal kőburkolata mögött rejtett RGB LED-világítás fut, a hangról Bose rendszer gondoskodik. Kiscsoportos órákhoz, magánórákhoz, jógához és beszéd- vagy mozgásalapú foglalkozásokhoz.',
    features: ['20 m²', 'Tükörfal', 'Bose hangrendszer', 'Rejtett RGB világítás', 'Klíma és légcsere'],
    images: ['ps-13', 'ps-14', 'ps-4', 'ps-15', 'ps-10', 'ps-11', 'ps-12', 'ps-16'],
  },
  {
    id: 'industrial',
    name: 'Industrial terem',
    size: 25,
    basePrice: 3000,
    maxPeople: 10,
    cover: 'ps-20',
    tagline: 'Nyers csövek, vasablak, bordásfal — ipari karakter.',
    description:
      'Ipari stílusú terem szabadon futó csövekkel, szürke falakkal, bordásfallal és RGB háttérvilágítású vasablakkal. Kiscsoportos köredzésekhez, saját testsúlyos edzéshez és bármilyen mozgásformához kiváló választás.',
    features: ['25 m²', 'Tükörfal', 'Bordásfal', 'RGB háttérvilágítás', 'Klíma és légcsere'],
    images: ['ps-20', 'ps-21', 'ps-22', 'ps-3-2'],
  },
];

export function getRoom(id) {
  return ROOMS.find((r) => r.id === id) || null;
}

/** Óradíj adott létszámra (Ft). */
export function hourlyPrice(room, people) {
  const extra = Math.max(0, people - BASE_INCLUDED_PEOPLE) * EXTRA_PERSON_PRICE;
  return room.basePrice + extra;
}

/** Teljes ár (Ft). */
export function calcPrice(room, people, hours) {
  return hourlyPrice(room, people) * hours;
}

/**
 * Lemondási szabály: 48 órával előtte díjmentes (100% vissza),
 * 48 órán belül 50% díj (50% vissza), 24 órán belül teljes díj (0% vissza).
 */
export function refundRatio(hoursUntilStart) {
  if (hoursUntilStart >= 48) return 1;
  if (hoursUntilStart >= 24) return 0.5;
  return 0;
}

function tzOffsetMs(ts) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ts));
  const g = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ts;
}

/** 'YYYY-MM-DD' + óra (budapesti idő) -> Date */
export function zonedTime(dateStr, hour) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour);
  let t = guess - tzOffsetMs(guess);
  const second = guess - tzOffsetMs(t);
  if (second !== t) t = second;
  return new Date(t);
}

/** Budapesti dátum 'YYYY-MM-DD' formában */
export function budapestDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(date);
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}
