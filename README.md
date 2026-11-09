# Performance Studio – online terembérlés

React (Vite) weboldal a Performance Studio tánctermeinek online foglalásához.

- **Hosting:** GitHub Pages (statikus, SPA 404-fallbackkel)
- **Felhasználók és adatbázis:** Firebase Authentication + Cloud Firestore
- **Fizetés:** Stripe Checkout, Firebase Cloud Functionsön keresztül (Node.js)

## Fejlesztés

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # dist/ + dist/404.html (SPA fallback)
```

## Felépítés

| Mappa / fájl | Tartalom |
|---|---|
| `src/pages/` | Oldalak: főoldal, termek, terem részletei, foglalás, fiók, admin, kapcsolat |
| `functions/index.js` | Cloud Functions: fizetés indítása, Stripe webhook, lemondás + visszatérítés, admin blokkolás, lejárt tartások takarítása |
| `functions/shared/rooms.js` | Termek, árak, nyitvatartás, lemondási szabály — **ezt használja a weboldal és a szerver is** |
| `firestore.rules` | Biztonsági szabályok (foglalást csak a szerver írhat) |
| `public/images/` | Az eredeti performancestudio.hu képei, WebP-re optimalizálva |
| `scripts/copy-404.mjs` | GitHub Pages fallback: `404.html` = `index.html` |

### Adatmodell (Firestore)

- `occupancy/{teremId}_{YYYY-MM-DD}` — `{ hours: { "17": bookingId, ... } }`, nyilvánosan olvasható foglaltsági térkép
- `bookings/{id}` — foglalás (`pending` → `paid` / `expired` / `cancelled`, admin blokkolás: `blocked`)
- `users/{uid}` — név, telefonszám
- `admins/{uid}` — ha létezik, a felhasználó admin
- `contactMessages/{id}` — kapcsolati űrlap üzenetei

### Foglalási folyamat

1. A felhasználó kiválasztja a termet, napot, idősávot, létszámot.
2. `createCheckoutSession` (Cloud Function) tranzakcióban lefoglalja az órákat (30 perces tartás), kiszámolja az árat, és Stripe Checkout oldalt nyit.
3. A Stripe webhook (`checkout.session.completed`) `paid` állapotra állítja a foglalást; lejárt/megszakított fizetésnél az órák felszabadulnak.
4. Lemondás a Fiókom oldalon: 48 órán túl 100%, 24–48 óra között 50%, 24 órán belül 0% visszatérítés — automatikusan a Stripe-on keresztül.

## Beüzemelés

### 1. Firebase

1. Firebase konzol → **Authentication** → Sign-in method: kapcsold be az **Email/Password** és a **Google** szolgáltatót.
   Authentication → Settings → Authorized domains: add hozzá a `szabadterem.hu` és `www.szabadterem.hu` domaint.
2. **Firestore Database** létrehozása (javasolt hely: `europe-central2`, Varsó).
3. A Cloud Functionshöz **Blaze (pay-as-you-go)** csomag szükséges (kis forgalomnál gyakorlatilag ingyenes).
4. Telepítés:
   ```bash
   npm install -g firebase-tools
   firebase login
   cd functions && npm install && cd ..
   firebase functions:secrets:set STRIPE_SECRET_KEY       # sk_test_... / sk_live_...
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # whsec_... (lásd lent)
   firebase deploy --only firestore,functions
   ```
   Telepítéskor a `SITE_URL` paramétert is bekéri (alapértelmezés: `https://szabadterem.hu`).
5. Admin felvétele: Firestore → `admins` gyűjtemény → új dokumentum, az azonosítója a felhasználó UID-ja (Authentication listából), tartalma pl. `{ role: "admin" }`.

### 2. Stripe

1. Dashboard → Developers → API keys: a **Secret key** kell a fenti `STRIPE_SECRET_KEY`-hez.
2. Developers → Webhooks → **Add endpoint**:
   - URL: `https://europe-central2-szabadterem.cloudfunctions.net/stripeWebhook`
   - Események: `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - A **Signing secret** (`whsec_...`) kell a `STRIPE_WEBHOOK_SECRET`-hez.
3. Settings → Payment methods: kártya, Apple Pay, Google Pay engedélyezése. Settings → Emails: „Successful payments” nyugta bekapcsolása.

### 3. GitHub Pages

A `main` ágra pusholva a `.github/workflows/deploy.yml` automatikusan buildel és kitelepít.
Repository → Settings → Pages → Source: **GitHub Actions**.

Az oldal a **szabadterem.hu** domainen fut (`public/CNAME`). DNS: 4 db A rekord a GitHub Pages IP-ire (185.199.108-111.153), `www` CNAME → `tbucsekbence.github.io`. Settings → Pages → Enforce HTTPS bekapcsolandó, amint elérhető.

## Árak módosítása

Minden ár, terem, nyitvatartás és szabály a `functions/shared/rooms.js` fájlban van. Módosítás után a weboldalt (push) **és** a functionst (`firebase deploy --only functions`) is újra kell telepíteni.
