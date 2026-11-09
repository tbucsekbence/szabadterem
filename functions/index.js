// Firebase Cloud Functions — foglalás + Stripe fizetés.
// A weboldal statikus (GitHub Pages), ezért minden pénzügyi és foglalási
// művelet itt, a szerveren történik, a Firestore-ba a kliens nem írhat foglalást.
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import {
  getRoom,
  calcPrice,
  refundRatio,
  zonedTime,
  budapestDate,
  addDays,
  isValidDateStr,
  OPEN_HOUR,
  CLOSE_HOUR,
  MAX_DAYS_AHEAD,
  MAX_HOURS_PER_BOOKING,
  HOLD_MINUTES,
  isSuperadminEmail,
  weekdayIndex,
  cancelCredit,
  creditToApply,
  isProfileComplete,
  TERMS_VERSION,
} from './shared/rooms.js';

setGlobalOptions({ region: 'europe-central2', maxInstances: 10 });
initializeApp();
const db = getFirestore();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
// A weboldal publikus címe (sikeres / megszakított fizetés utáni visszairányításhoz)
const SITE_URL = defineString('SITE_URL', { default: 'https://szabadterem.hu' });

const stripeClient = () => new Stripe(STRIPE_SECRET_KEY.value());

// ---------- segédfüggvények ----------

const occRef = (roomId, date) => db.doc(`occupancy/${roomId}_${date}`);

/** Szuperadmin (igazolt e-mail alapján) vagy admins/{uid} dokumentummal rendelkező felhasználó. */
async function isAdmin(auth) {
  if (!auth?.uid) return false;
  if (isSuperadminEmail(auth.token?.email, auth.token?.email_verified)) return true;
  const snap = await db.doc(`admins/${auth.uid}`).get();
  return snap.exists;
}

function hoursRange(start, end) {
  const out = [];
  for (let h = start; h < end; h++) out.push(h);
  return out;
}

function validateSlot({ roomId, date, startHour, endHour }) {
  const room = getRoom(roomId);
  if (!room) throw new HttpsError('invalid-argument', 'Ismeretlen terem.');
  if (!isValidDateStr(date)) throw new HttpsError('invalid-argument', 'Érvénytelen dátum.');
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour)) throw new HttpsError('invalid-argument', 'Érvénytelen időpont.');
  if (startHour < OPEN_HOUR || endHour > CLOSE_HOUR || endHour <= startHour) throw new HttpsError('invalid-argument', 'Az időpont a nyitvatartáson kívül esik.');
  if (endHour - startHour > MAX_HOURS_PER_BOOKING) throw new HttpsError('invalid-argument', `Egyszerre legfeljebb ${MAX_HOURS_PER_BOOKING} óra foglalható.`);
  if (zonedTime(date, startHour).getTime() <= Date.now()) throw new HttpsError('failed-precondition', 'Múltbeli időpontot nem lehet foglalni.');
  if (date > addDays(budapestDate(), MAX_DAYS_AHEAD)) throw new HttpsError('failed-precondition', `Legfeljebb ${MAX_DAYS_AHEAD} napra előre lehet foglalni.`);
  return room;
}

/** Tranzakción belül lefoglalja az órákat; ütközés esetén hibát dob. */
async function claimHours(tx, { roomId, date, startHour, endHour }, bookingId) {
  const ref = occRef(roomId, date);
  const snap = await tx.get(ref);
  const hours = (snap.exists && snap.data().hours) || {};
  for (const h of hoursRange(startHour, endHour)) {
    if (hours[h] && hours[h] !== bookingId) {
      throw new HttpsError('already-exists', 'A kiválasztott időpont (egy része) már foglalt.');
    }
  }
  const patch = {};
  for (const h of hoursRange(startHour, endHour)) patch[h] = bookingId;
  return () => tx.set(ref, { roomId, date, hours: patch }, { merge: true });
}

/** Tranzakción belül felszabadítja a foglaláshoz tartozó órákat. */
async function releaseHours(tx, booking, bookingId) {
  const ref = occRef(booking.roomId, booking.date);
  const snap = await tx.get(ref);
  if (!snap.exists) return () => {};
  const hours = snap.data().hours || {};
  const patch = {};
  for (const h of hoursRange(booking.startHour, booking.endHour)) {
    if (hours[h] === bookingId) patch[`hours.${h}`] = FieldValue.delete();
  }
  return () => {
    if (Object.keys(patch).length) tx.update(ref, patch);
  };
}

// ---------- kredit ----------
// credits/{uid}            { balance }            — csak a szerver írja
// credits/{uid}/ledger/{id} { amount, type, ... } — mozgások naplója

const creditRef = (uid) => db.doc(`credits/${uid}`);

async function readCredit(tx, uid) {
  const s = await tx.get(creditRef(uid));
  return s.exists ? Number(s.data().balance) || 0 : 0;
}

/** Tranzakción belül (az összes olvasás UTÁN) módosítja az egyenleget és naplóz. */
function writeCredit(tx, uid, balanceBefore, delta, entry) {
  const balance = balanceBefore + delta;
  tx.set(creditRef(uid), { balance, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  tx.set(creditRef(uid).collection('ledger').doc(), { ...entry, amount: delta, balanceAfter: balance, createdAt: FieldValue.serverTimestamp() });
  return balance;
}

async function expireBooking(bookingId, reason) {
  const ref = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== 'pending') return;
    const b = snap.data();
    const release = await releaseHours(tx, b, bookingId);
    const creditUsed = b.creditUsed || 0;
    const balance = creditUsed > 0 ? await readCredit(tx, b.uid) : 0;
    release();
    if (creditUsed > 0) writeCredit(tx, b.uid, balance, creditUsed, { type: 'restore', bookingId, note: 'Félbeszakadt fizetés — kredit visszaírva' });
    tx.update(ref, { status: 'expired', expiredReason: reason, updatedAt: FieldValue.serverTimestamp() });
  });
}

// ---------- 1) Fizetés indítása ----------

export const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'A foglaláshoz be kell jelentkezned.');

  const { roomId, date, startHour, endHour } = req.data || {};
  const people = Number(req.data?.people);
  const room = validateSlot({ roomId, date, startHour, endHour });
  if (!Number.isInteger(people) || people < 1 || people > room.maxPeople) {
    throw new HttpsError('invalid-argument', `A létszám 1 és ${room.maxPeople} fő között lehet.`);
  }

  if (req.data?.termsAccepted !== true) {
    throw new HttpsError('failed-precondition', 'A foglaláshoz el kell fogadnod az Általános Szerződési Feltételeket.');
  }
  const useCredit = req.data?.useCredit === true;

  const hours = endHour - startHour;
  const amount = calcPrice(room, people, hours);
  const userSnap = await db.doc(`users/${uid}`).get();
  const profile = userSnap.exists ? userSnap.data() : {};
  if (!isProfileComplete(profile)) {
    throw new HttpsError('failed-precondition', 'A foglalás előtt töltsd ki a profilodat.');
  }
  const email = req.auth.token.email || profile.email || null;

  const bookingRef = db.collection('bookings').doc();
  const bookingId = bookingRef.id;
  const expiresAt = Timestamp.fromMillis(Date.now() + (HOLD_MINUTES + 2) * 60 * 1000);

  let creditUsed = 0;
  let cardAmount = amount;
  await db.runTransaction(async (tx) => {
    // olvasások
    const commit = await claimHours(tx, { roomId, date, startHour, endHour }, bookingId);
    const balance = useCredit ? await readCredit(tx, uid) : 0;
    creditUsed = useCredit ? creditToApply(amount, balance) : 0;
    cardAmount = amount - creditUsed;
    const fullyCredit = cardAmount === 0;
    // írások
    commit();
    if (creditUsed > 0) writeCredit(tx, uid, balance, -creditUsed, { type: 'use', bookingId, note: `${room.name}, ${date} ${startHour}:00–${endHour}:00` });
    tx.set(bookingRef, {
      type: 'booking',
      uid,
      email,
      name: profile.name || req.auth.token.name || null,
      phone: profile.phone || null,
      role: profile.role || null,
      school: profile.school || null,
      roomId,
      roomName: room.name,
      date,
      startHour,
      endHour,
      hours,
      people,
      amount, // teljes ár
      creditUsed, // ebből kreditből
      cardAmount, // ebből kártyával
      currency: 'HUF',
      status: fullyCredit ? 'paid' : 'pending',
      paymentMethod: fullyCredit ? 'credit' : creditUsed > 0 ? 'credit+card' : 'card',
      termsVersion: TERMS_VERSION,
      startsAt: Timestamp.fromDate(zonedTime(date, startHour)),
      ...(fullyCredit ? { paidAt: FieldValue.serverTimestamp(), paidAmount: 0 } : { expiresAt }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (cardAmount === 0) return { bookingId, paidWithCredit: true };

  const site = SITE_URL.value().replace(/\/$/, '');
  try {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'hu',
        customer_email: email || undefined,
        client_reference_id: uid,
        // Számlázáshoz: teljes számlázási cím kötelező, cégeknek cégnév + adószám (opcionális)
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_creation: 'always',
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'huf',
              // A Stripe a HUF-ot két tizedesjeggyel kezeli: 1 Ft = 100 egység
              unit_amount: cardAmount * 100,
              product_data: {
                name: `${room.name} – ${date} ${startHour}:00–${endHour}:00`,
                description: `${hours} óra, ${people} fő — Performance Studio terembérlés${creditUsed ? ` (${creditUsed} Ft kredit levonva)` : ''}`,
              },
            },
          },
        ],
        metadata: { bookingId },
        payment_intent_data: { metadata: { bookingId } },
        expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60 + 30,
        success_url: `${site}/foglalas/sikeres?b=${bookingId}`,
        cancel_url: `${site}/foglalas/megszakitva?b=${bookingId}`,
      },
      { idempotencyKey: `checkout-${bookingId}` },
    );
    await bookingRef.update({ stripeSessionId: session.id, updatedAt: FieldValue.serverTimestamp() });
    return { url: session.url, bookingId };
  } catch (err) {
    logger.error('Stripe session hiba', err);
    await expireBooking(bookingId, 'stripe-error');
    throw new HttpsError('internal', 'Nem sikerült elindítani a fizetést. Próbáld újra később.');
  }
});

// ---------- 2) Megszakított fizetés: időpont azonnali felszabadítása ----------

export const releasePendingBooking = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  const bookingId = req.data?.bookingId;
  if (!uid || typeof bookingId !== 'string') throw new HttpsError('invalid-argument', 'Hiányzó adat.');
  const snap = await db.doc(`bookings/${bookingId}`).get();
  if (!snap.exists || snap.data().uid !== uid) throw new HttpsError('not-found', 'Nincs ilyen foglalás.');
  const b = snap.data();
  if (b.status !== 'pending') return { status: b.status };
  if (b.stripeSessionId) {
    try {
      await stripeClient().checkout.sessions.expire(b.stripeSessionId);
    } catch (err) {
      // ha közben kifizették, a webhook rendezi
      logger.warn('Session expire sikertelen', err.message);
      return { status: 'pending' };
    }
  }
  await expireBooking(bookingId, 'user-cancelled-checkout');
  return { status: 'expired' };
});

// ---------- 3) Stripe webhook ----------

export const stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    logger.warn('Érvénytelen webhook aláírás', err.message);
    res.status(400).send('Invalid signature');
    return;
  }

  try {
    const session = event.data.object;
    const bookingId = session?.metadata?.bookingId;

    if (bookingId && (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')) {
      if (session.payment_status === 'paid') await markPaid(bookingId, session);
    } else if (bookingId && (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed')) {
      await expireBooking(bookingId, event.type);
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Webhook feldolgozási hiba', err);
    res.status(500).send('Webhook error');
  }
});

/** A Stripe Checkoutban megadott számlázási adatok (számla kiállításához). */
function billingFromSession(session) {
  const cd = session.customer_details || {};
  const a = cd.address || {};
  return {
    name: cd.name || null,
    businessName: cd.business_name || null,
    email: cd.email || null,
    phone: cd.phone || null,
    taxIds: (cd.tax_ids || []).map((t) => t.value).filter(Boolean),
    taxExempt: cd.tax_exempt || null,
    address: {
      line1: a.line1 || null,
      line2: a.line2 || null,
      postalCode: a.postal_code || null,
      city: a.city || null,
      state: a.state || null,
      country: a.country || null,
    },
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
  };
}

async function markPaid(bookingId, session) {
  const ref = db.doc(`bookings/${bookingId}`);
  let conflict = false;
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const b = snap.data();
    if (b.status === 'paid' || b.status === 'cancelled') return;
    if (b.status === 'expired') {
      // A tartás lejárt, de a fizetés mégis befutott: megpróbáljuk újra lefoglalni.
      try {
        const commit = await claimHours(tx, b, bookingId);
        commit();
      } catch {
        // Időközben más foglalta le: a kártyás részt visszautaljuk. (A kredit a lejáratkor már visszakerült.)
        conflict = true;
        tx.update(ref, { status: 'refunded', refundReason: 'slot-taken-after-expiry', paymentIntentId: session.payment_intent, updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      // Lejáratkor a felhasznált kredit visszakerült — most újra levonjuk.
      if (b.creditUsed > 0) {
        const balance = await readCredit(tx, b.uid);
        writeCredit(tx, b.uid, balance, -b.creditUsed, { type: 'use', bookingId, note: 'Késve beérkezett fizetés' });
      }
    }
    tx.update(ref, {
      status: 'paid',
      billing: billingFromSession(session),
      paymentIntentId: session.payment_intent,
      paidAmount: Math.round((session.amount_total || 0) / 100),
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  if (conflict) {
    await stripeClient().refunds.create({ payment_intent: session.payment_intent }, { idempotencyKey: `conflict-refund-${bookingId}` });
  }
}

// ---------- 4) Lemondás (felhasználó vagy admin) ----------

export const cancelBooking = onCall({ secrets: [STRIPE_SECRET_KEY] }, async (req) => {
  const uid = req.auth?.uid;
  const bookingId = req.data?.bookingId;
  if (!uid || typeof bookingId !== 'string') throw new HttpsError('invalid-argument', 'Hiányzó adat.');
  const admin = await isAdmin(req.auth);
  const ref = db.doc(`bookings/${bookingId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Nincs ilyen foglalás.');
  const b = snap.data();
  if (b.uid !== uid && !admin) throw new HttpsError('permission-denied', 'Ezt a foglalást nem mondhatod le.');
  if (!['paid', 'blocked'].includes(b.status)) throw new HttpsError('failed-precondition', 'Ez a foglalás már nem aktív.');

  const startsAt = zonedTime(b.date, b.startHour).getTime();
  if (startsAt <= Date.now() && !admin) throw new HttpsError('failed-precondition', 'Elmúlt időpontot nem lehet lemondani.');

  // Felhasználói lemondás: a lemondási szabály szerinti összeg KREDITként jár vissza.
  // Admin lemondás (a stúdió mondja le): a teljes összeg jár vissza —
  //   mode 'credit' (alapértelmezés): teljes összeg kreditként,
  //   mode 'refund': a kártyás rész visszautalás a kártyára, a kreditrész kreditként.
  const byAdmin = admin && b.uid !== uid;
  const mode = byAdmin && req.data?.mode === 'refund' ? 'refund' : 'credit';
  let creditIssued = 0;
  let refundAmount = 0;
  if (b.status === 'paid') {
    const total = b.amount || 0;
    if (!byAdmin) {
      creditIssued = cancelCredit(total, (startsAt - Date.now()) / 3600000);
    } else if (mode === 'credit') {
      creditIssued = total;
    } else {
      refundAmount = b.paidAmount ?? b.cardAmount ?? 0;
      creditIssued = b.creditUsed || 0;
      if (refundAmount > 0 && b.paymentIntentId) {
        await stripeClient().refunds.create(
          { payment_intent: b.paymentIntentId, amount: refundAmount * 100, metadata: { bookingId } },
          { idempotencyKey: `cancel-refund-${bookingId}` },
        );
      }
    }
  }

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (!['paid', 'blocked'].includes(fresh.data().status)) throw new HttpsError('failed-precondition', 'Ez a foglalás már nem aktív.');
    const release = await releaseHours(tx, fresh.data(), bookingId);
    const balance = creditIssued > 0 ? await readCredit(tx, b.uid) : 0;
    release();
    if (creditIssued > 0) {
      writeCredit(tx, b.uid, balance, creditIssued, {
        type: 'cancel',
        bookingId,
        note: `Lemondás: ${b.roomName}, ${b.date} ${b.startHour}:00–${b.endHour}:00${byAdmin ? ' (a stúdió mondta le)' : ''}`,
      });
    }
    tx.update(ref, {
      status: 'cancelled',
      creditIssued,
      refundAmount,
      cancelledBy: byAdmin ? 'admin' : 'user',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'cancelled', creditIssued, refundAmount };
});

// ---------- 4/b) Admin: kredit kézi jóváírása / levonása ----------

export const adjustCredit = onCall(async (req) => {
  if (!(await isAdmin(req.auth))) throw new HttpsError('permission-denied', 'Csak adminisztrátor.');
  const email = String(req.data?.email || '').trim().toLowerCase();
  const amount = Number(req.data?.amount);
  const note = String(req.data?.note || '').slice(0, 200);
  if (!email || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000000) {
    throw new HttpsError('invalid-argument', 'Adj meg e-mail címet és egy nem nulla, egész összeget.');
  }
  const users = await db.collection('users').where('email', '==', email).limit(2).get();
  if (users.empty) throw new HttpsError('not-found', 'Nincs regisztrált felhasználó ezzel az e-mail címmel.');
  const targetUid = users.docs[0].id;
  let balance = 0;
  await db.runTransaction(async (tx) => {
    const before = await readCredit(tx, targetUid);
    if (before + amount < 0) throw new HttpsError('failed-precondition', `Az egyenleg nem mehet mínuszba (jelenleg ${before} Ft).`);
    balance = writeCredit(tx, targetUid, before, amount, { type: 'admin', note: note || 'Kézi jóváírás', by: req.auth.uid });
  });
  return { balance, name: users.docs[0].data().name || email };
});

// ---------- 5) Admin: időpont blokkolása (saját órák, karbantartás) ----------

// Egy hívással több terem, dátumtartomány és opcionálisan a hét kiválasztott napjai
// blokkolhatók (pl. "minden kedden 18–20 a Nagyteremben, decemberig").
// A már foglalt / elmúlt időpontokat kihagyja, és visszaadja, mi maradt ki.
const MAX_BLOCK_ITEMS = 400;

export const createBlock = onCall(async (req) => {
  if (!(await isAdmin(req.auth))) throw new HttpsError('permission-denied', 'Csak adminisztrátor.');
  const uid = req.auth.uid;
  const { dateFrom, dateTo, startHour, endHour } = req.data || {};
  const roomIds = Array.isArray(req.data?.roomIds) ? [...new Set(req.data.roomIds)] : [];
  const weekdays = Array.isArray(req.data?.weekdays) ? req.data.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : [];
  const note = String(req.data?.note || '').slice(0, 200);

  if (!roomIds.length || roomIds.some((id) => !getRoom(id))) throw new HttpsError('invalid-argument', 'Válassz legalább egy termet.');
  if (!isValidDateStr(dateFrom) || !isValidDateStr(dateTo) || dateTo < dateFrom) throw new HttpsError('invalid-argument', 'Érvénytelen dátumtartomány.');
  if (dateTo > addDays(dateFrom, 366)) throw new HttpsError('invalid-argument', 'Legfeljebb egy évre lehet egyszerre blokkolni.');
  if (!Number.isInteger(startHour) || !Number.isInteger(endHour) || startHour < OPEN_HOUR || endHour > CLOSE_HOUR || endHour <= startHour) {
    throw new HttpsError('invalid-argument', 'Érvénytelen idősáv.');
  }

  const dates = [];
  for (let d = dateFrom; d <= dateTo; d = addDays(d, 1)) {
    if (!weekdays.length || weekdays.includes(weekdayIndex(d))) dates.push(d);
  }
  const total = dates.length * roomIds.length;
  if (!total) throw new HttpsError('invalid-argument', 'A megadott feltételekre nem esik egyetlen nap sem.');
  if (total > MAX_BLOCK_ITEMS) throw new HttpsError('invalid-argument', `Egyszerre legfeljebb ${MAX_BLOCK_ITEMS} blokkolás hozható létre (most ${total} lenne).`);

  const groupId = db.collection('bookings').doc().id;
  let created = 0;
  const skipped = [];
  for (const date of dates) {
    if (zonedTime(date, startHour).getTime() <= Date.now()) {
      roomIds.forEach((roomId) => skipped.push({ roomId, date, reason: 'elmúlt' }));
      continue;
    }
    for (const roomId of roomIds) {
      const room = getRoom(roomId);
      const ref = db.collection('bookings').doc();
      try {
        await db.runTransaction(async (tx) => {
          const commit = await claimHours(tx, { roomId, date, startHour, endHour }, ref.id);
          commit();
          tx.set(ref, {
            type: 'block',
            groupId,
            uid,
            roomId,
            roomName: room.name,
            date,
            startHour,
            endHour,
            hours: endHour - startHour,
            note,
            status: 'blocked',
            startsAt: Timestamp.fromDate(zonedTime(date, startHour)),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        });
        created++;
      } catch (err) {
        if (err instanceof HttpsError && err.code === 'already-exists') skipped.push({ roomId, date, reason: 'foglalt' });
        else throw err;
      }
    }
  }
  return { groupId, created, skipped };
});

// Egy blokkolás-sorozat összes jövőbeli elemének törlése.
export const cancelBlockGroup = onCall(async (req) => {
  if (!(await isAdmin(req.auth))) throw new HttpsError('permission-denied', 'Csak adminisztrátor.');
  const groupId = req.data?.groupId;
  if (typeof groupId !== 'string' || !groupId) throw new HttpsError('invalid-argument', 'Hiányzó azonosító.');
  const snap = await db.collection('bookings').where('groupId', '==', groupId).where('status', '==', 'blocked').get();
  let cancelled = 0;
  for (const doc of snap.docs) {
    await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data().status !== 'blocked') return;
      const release = await releaseHours(tx, fresh.data(), doc.id);
      release();
      tx.update(doc.ref, { status: 'cancelled', cancelledBy: 'admin', cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    cancelled++;
  }
  return { cancelled };
});

// ---------- 6) Lejárt, ki nem fizetett tartások takarítása ----------

export const cleanupExpiredHolds = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Europe/Budapest' }, async () => {
  const snap = await db.collection('bookings').where('status', '==', 'pending').where('expiresAt', '<', Timestamp.now()).limit(200).get();
  for (const doc of snap.docs) await expireBooking(doc.id, 'hold-timeout');
  if (snap.size) logger.info(`${snap.size} lejárt tartás felszabadítva`);
});
