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

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get();
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

async function expireBooking(bookingId, reason) {
  const ref = db.doc(`bookings/${bookingId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.data().status !== 'pending') return;
    const release = await releaseHours(tx, snap.data(), bookingId);
    release();
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

  const hours = endHour - startHour;
  const amount = calcPrice(room, people, hours);
  const userSnap = await db.doc(`users/${uid}`).get();
  const profile = userSnap.exists ? userSnap.data() : {};
  const email = req.auth.token.email || profile.email || null;

  const bookingRef = db.collection('bookings').doc();
  const bookingId = bookingRef.id;
  const expiresAt = Timestamp.fromMillis(Date.now() + (HOLD_MINUTES + 2) * 60 * 1000);

  await db.runTransaction(async (tx) => {
    const commit = await claimHours(tx, { roomId, date, startHour, endHour }, bookingId);
    commit();
    tx.set(bookingRef, {
      type: 'booking',
      uid,
      email,
      name: profile.name || req.auth.token.name || null,
      phone: profile.phone || null,
      roomId,
      roomName: room.name,
      date,
      startHour,
      endHour,
      hours,
      people,
      amount,
      currency: 'HUF',
      status: 'pending',
      startsAt: Timestamp.fromDate(zonedTime(date, startHour)),
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const site = SITE_URL.value().replace(/\/$/, '');
  try {
    const session = await stripeClient().checkout.sessions.create(
      {
        mode: 'payment',
        locale: 'hu',
        customer_email: email || undefined,
        client_reference_id: uid,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'huf',
              // A Stripe a HUF-ot két tizedesjeggyel kezeli: 1 Ft = 100 egység
              unit_amount: amount * 100,
              product_data: {
                name: `${room.name} – ${date} ${startHour}:00–${endHour}:00`,
                description: `${hours} óra, ${people} fő — Performance Studio terembérlés`,
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
        conflict = true;
        tx.update(ref, { status: 'refunded', refundReason: 'slot-taken-after-expiry', paymentIntentId: session.payment_intent, updatedAt: FieldValue.serverTimestamp() });
        return;
      }
    }
    tx.update(ref, {
      status: 'paid',
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
  const admin = await isAdmin(uid);
  const ref = db.doc(`bookings/${bookingId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Nincs ilyen foglalás.');
  const b = snap.data();
  if (b.uid !== uid && !admin) throw new HttpsError('permission-denied', 'Ezt a foglalást nem mondhatod le.');
  if (!['paid', 'blocked'].includes(b.status)) throw new HttpsError('failed-precondition', 'Ez a foglalás már nem aktív.');

  const startsAt = zonedTime(b.date, b.startHour).getTime();
  if (startsAt <= Date.now() && !admin) throw new HttpsError('failed-precondition', 'Elmúlt időpontot nem lehet lemondani.');

  let refundAmount = 0;
  if (b.status === 'paid') {
    const ratio = admin ? 1 : refundRatio((startsAt - Date.now()) / 3600000);
    refundAmount = Math.round(((b.paidAmount ?? b.amount) * ratio) / 100) * 100; // kerek 100 Ft
    if (refundAmount > 0 && b.paymentIntentId) {
      await stripeClient().refunds.create(
        { payment_intent: b.paymentIntentId, amount: refundAmount * 100, metadata: { bookingId } },
        { idempotencyKey: `cancel-refund-${bookingId}` },
      );
    }
  }

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    const release = await releaseHours(tx, fresh.data(), bookingId);
    release();
    tx.update(ref, {
      status: 'cancelled',
      refundAmount,
      cancelledBy: admin && b.uid !== uid ? 'admin' : 'user',
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { status: 'cancelled', refundAmount };
});

// ---------- 5) Admin: időpont blokkolása (saját órák, karbantartás) ----------

export const createBlock = onCall(async (req) => {
  const uid = req.auth?.uid;
  if (!(await isAdmin(uid))) throw new HttpsError('permission-denied', 'Csak adminisztrátor.');
  const { roomId, date, startHour, endHour } = req.data || {};
  const note = String(req.data?.note || '').slice(0, 200);
  const room = validateSlot({ roomId, date, startHour, endHour });
  const ref = db.collection('bookings').doc();
  await db.runTransaction(async (tx) => {
    const commit = await claimHours(tx, { roomId, date, startHour, endHour }, ref.id);
    commit();
    tx.set(ref, {
      type: 'block',
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
  return { bookingId: ref.id };
});

// ---------- 6) Lejárt, ki nem fizetett tartások takarítása ----------

export const cleanupExpiredHolds = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Europe/Budapest' }, async () => {
  const snap = await db.collection('bookings').where('status', '==', 'pending').where('expiresAt', '<', Timestamp.now()).limit(200).get();
  for (const doc of snap.docs) await expireBooking(doc.id, 'hold-timeout');
  if (snap.size) logger.info(`${snap.size} lejárt tartás felszabadítva`);
});
