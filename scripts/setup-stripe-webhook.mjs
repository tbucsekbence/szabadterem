// Létrehozza (vagy újra létrehozza) a Stripe webhook endpointot, és a kapott
// aláíró titkot STRIPE_WEBHOOK_SECRET néven a Firebase Secret Managerbe menti.
// A Stripe kulcsot a Firebase Secret Managerből olvassa (STRIPE_SECRET_KEY) —
// sem a kulcs, sem a webhook titok nem kerül kiírásra.
//
// Használat: node scripts/setup-stripe-webhook.mjs
import { execSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const PROJECT = 'szabadterem';
const ENDPOINT_URL = `https://europe-central2-${PROJECT}.cloudfunctions.net/stripeWebhook`;
const EVENTS = ['checkout.session.completed', 'checkout.session.expired', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed'];

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const Stripe = require('stripe');

const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true }).trim();

let key;
try {
  key = run(`firebase functions:secrets:access STRIPE_SECRET_KEY --project ${PROJECT}`);
} catch {
  console.error('✗ A STRIPE_SECRET_KEY még nincs beállítva. Futtasd: firebase functions:secrets:set STRIPE_SECRET_KEY --project ' + PROJECT);
  process.exit(1);
}
if (!/^(sk|rk)_(test|live)_/.test(key)) {
  console.error('✗ A STRIPE_SECRET_KEY nem Stripe titkos kulcsnak tűnik (sk_... vagy rk_... kellene).');
  process.exit(1);
}
const mode = key.includes('_live_') ? 'ÉLES' : 'TESZT';
const stripe = new Stripe(key);

const account = await stripe.accounts.retrieve();
console.log(`✓ Stripe fiók: ${account.settings?.dashboard?.display_name || account.id} (${mode} mód)`);

// Korábbi, azonos URL-re mutató endpoint törlése (a titka utólag nem kérdezhető le)
const existing = await stripe.webhookEndpoints.list({ limit: 100 });
for (const ep of existing.data.filter((e) => e.url === ENDPOINT_URL)) {
  await stripe.webhookEndpoints.del(ep.id);
  console.log(`  régi endpoint törölve: ${ep.id}`);
}

const ep = await stripe.webhookEndpoints.create({
  url: ENDPOINT_URL,
  enabled_events: EVENTS,
  description: 'Performance Studio terembérlés (szabadterem.hu)',
});
console.log(`✓ Webhook létrehozva: ${ep.id} → ${ENDPOINT_URL}`);

const res = spawnSync('firebase', ['functions:secrets:set', 'STRIPE_WEBHOOK_SECRET', '--data-file', '-', '--project', PROJECT, '--force'], {
  input: ep.secret,
  encoding: 'utf8',
  shell: true,
});
if (res.status !== 0) {
  console.error('✗ Nem sikerült elmenteni a webhook titkot:', (res.stderr || res.stdout || '').trim());
  process.exit(1);
}
console.log('✓ STRIPE_WEBHOOK_SECRET elmentve a Firebase Secret Managerbe.');
