/**
 * Smoke test locale (nessuna chiamata esterna reale).
 * - Mock di fetch verso api.resend.com
 * - Mock delle API Stripe usate (checkout.sessions.create, subscriptions.*)
 * - Webhook firmati con stripe.webhooks.generateTestHeaderString
 *
 * Uso: npm run test:smoke
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gustoai-'));
Object.assign(process.env, {
  PORT: '3998',
  DATA_DIR,
  OPENAI_API_KEY: '',
  STRIPE_SECRET_KEY: 'sk_test_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
  STRIPE_PRICE_ID_BASIC: 'price_basic',
  STRIPE_PRICE_ID_PRO: 'price_pro',
  RESEND_API_KEY: 're_fake',
  EMAIL_FROM: 'GustoAI <test@example.com>',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_TOKEN: 'admintoken123',
  APP_SECRET: 'appsecret',
  FRONTEND_URL: 'http://localhost:3998',
});

// ── Mock Resend ──────────────────────────────────────────────
const sentEmails = [];
const cancelled = [];
const realFetch = global.fetch;
global.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com')) {
    if (u.endsWith('/cancel')) {
      cancelled.push(u.split('/')[4]);
      return new Response(JSON.stringify({ object: 'email', id: 'x' }), { status: 200 });
    }
    const body = JSON.parse(opts.body);
    const id = `email_${sentEmails.length + 1}`;
    sentEmails.push({ id, ...body });
    return new Response(JSON.stringify({ id }), { status: 200 });
  }
  return realFetch(url, opts);
};

// ── Mock Stripe ──────────────────────────────────────────────
const { getStripe } = require('../src/services/stripeClient');
const stripe = getStripe();
let lastCheckoutParams = null;
let currentBotId = null;
stripe.checkout.sessions.create = async (params) => {
  lastCheckoutParams = params;
  return { url: 'https://checkout.stripe.com/c/pay/cs_test_123' };
};
const fakeSub = (botId, status) => ({
  id: 'sub_123', object: 'subscription', customer: 'cus_123', status,
  trial_end: Math.floor(Date.now() / 1000) + 14 * 86400,
  metadata: { botId, plan: 'pro', restaurantName: 'Trattoria Test' },
});
stripe.subscriptions.retrieve = async () => fakeSub(currentBotId, 'trialing');
stripe.subscriptions.search = async () => ({ data: [] });

require('../src/server');
const BASE = `http://localhost:${process.env.PORT}`;

let failures = 0;
function check(label, cond, extra = '') {
  console.log(`${cond ? '✅' : '❌'} ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
}
async function post(p, body, headers = {}) {
  const r = await realFetch(BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function get(p) {
  const r = await realFetch(BASE + p);
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html */ }
  return { status: r.status, json, text };
}
function sendWebhook(event) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return post('/api/stripe/webhook', payload, { 'stripe-signature': header });
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function testLeads() {
  let r = await post('/api/leads', { name: 'Mario Rossi', email: 'Mario@Example.com', restaurantName: 'Da Mario', consent: true });
  check('lead creato', r.status === 200 && r.json.success, JSON.stringify(r.json));
  const leadMails = sentEmails.filter(e => e.to[0] === 'mario@example.com');
  check('3 email della sequenza inviate a Resend', leadMails.length === 3);
  check('email 1 immediata', leadMails[0] && !leadMails[0].scheduled_at);
  const d2 = (new Date(leadMails[1]?.scheduled_at) - Date.now()) / 86400000;
  const d3 = (new Date(leadMails[2]?.scheduled_at) - Date.now()) / 86400000;
  check('email 2 a +2gg, email 3 a +5gg', Math.round(d2) === 2 && Math.round(d3) === 5);
  check('header List-Unsubscribe', Boolean(leadMails[0]?.headers?.['List-Unsubscribe']));
  check('oggetto email 3 personalizzato', leadMails[2]?.subject.startsWith('Mario,'), leadMails[2]?.subject);
  check('notifica admin nuovo lead', sentEmails.some(e => e.to[0] === 'admin@example.com' && e.subject.includes('lead')));

  r = await post('/api/leads', { name: 'Mario Rossi', email: 'mario@example.com', consent: true });
  check('lead duplicato: nessun reinvio', r.json.alreadyRegistered === true && sentEmails.filter(e => e.to[0] === 'mario@example.com').length === 3);
  r = await post('/api/leads', { name: 'Xy', email: 'non-valida', consent: true });
  check('email non valida → 400', r.status === 400);
  r = await post('/api/leads', { name: 'Luca', email: 'luca@example.com' });
  check('senza consenso → 400', r.status === 400);
  const before = sentEmails.length;
  r = await post('/api/leads', { name: 'Bot', email: 'bot@example.com', consent: true, website: 'http://spam' });
  check('honeypot: finto successo, 0 email', r.json.success && sentEmails.length === before);

  const unsubPath = leadMails[0].headers['List-Unsubscribe'].slice(1, -1).replace(BASE, '');
  const u = await get(unsubPath);
  check('disiscrizione → annulla email 2 e 3', u.status === 200 && cancelled.includes(leadMails[1].id) && cancelled.includes(leadMails[2].id));
  const bad = await get('/api/leads/unsubscribe?email=mario@example.com&token=deadbeef');
  check('disiscrizione con token falso → 400', bad.status === 400);
}

async function testStripe() {
  let r = await post('/api/stripe/checkout', { plan: 'pro', restaurantName: 'Trattoria Test', email: 'chef@example.com' });
  check('checkout → URL Stripe', r.status === 200 && r.json.url.includes('checkout.stripe.com'));
  const botId = lastCheckoutParams.metadata.botId;
  currentBotId = botId;
  check('trial 14gg + botId nei metadata della subscription',
    lastCheckoutParams.subscription_data.trial_period_days === 14 && lastCheckoutParams.subscription_data.metadata.botId === botId);
  check('success_url → /welcome', lastCheckoutParams.success_url.endsWith('/welcome?session_id={CHECKOUT_SESSION_ID}'));
  r = await post('/api/stripe/checkout', { plan: 'gold', email: 'a@b.it' });
  check('piano non valido → 400', r.status === 400);

  r = await post('/api/chat', { message: 'ciao', botId });
  check('chat bot non pagato → 402', r.status === 402);
  let c = await get(`/api/chat/config/${botId}`);
  check('config bot non pagato → active:false', c.json.active === false);

  r = await post('/api/stripe/webhook', '{}', { 'stripe-signature': 't=1,v1=bad' });
  check('webhook con firma falsa → 400', r.status === 400);

  const session = {
    id: 'cs_test_abc123', object: 'checkout.session', mode: 'subscription', status: 'complete',
    subscription: 'sub_123', customer: 'cus_123', client_reference_id: botId,
    customer_details: { email: 'chef@example.com' },
    metadata: { botId, plan: 'pro', restaurantName: 'Trattoria Test' },
  };
  r = await sendWebhook({ id: 'evt_1', type: 'checkout.session.completed', data: { object: session } });
  check('webhook checkout.session.completed → 200', r.status === 200);
  await wait(200);
  const welcome = sentEmails.filter(e => e.to[0] === 'chef@example.com');
  check('email di benvenuto con snippet', welcome.length === 1 && welcome[0].html.includes(`/api/widget/${botId}/embed`));
  check('notifica admin nuovo cliente', sentEmails.some(e => e.to[0] === 'admin@example.com' && e.subject.includes('Nuovo cliente')));

  await sendWebhook({ id: 'evt_1b', type: 'checkout.session.completed', data: { object: session } });
  await wait(200);
  check('retry webhook: nessuna email duplicata', sentEmails.filter(e => e.to[0] === 'chef@example.com').length === 1);

  c = await get(`/api/chat/config/${botId}`);
  check('dopo pagamento → active:true + nome ristorante', c.json.active === true && c.json.restaurantName === 'Trattoria Test');
  r = await post('/api/chat', { message: 'ciao', botId });
  check('chat bot attivo supera il controllo (503 = solo OpenAI mancante)', r.status === 503);

  r = await post(`/api/chat/config/${botId}`, { openingHours: 'Sempre' });
  check('config POST senza token → 401', r.status === 401);
  r = await post(`/api/chat/config/${botId}`, { openingHours: 'Mar-Dom 12-23', evil: 'x' }, { 'x-admin-token': 'admintoken123' });
  check('config POST con token → 200 (solo campi ammessi)', r.status === 200 && r.json.config.openingHours === 'Mar-Dom 12-23' && !('evil' in r.json.config));

  r = await sendWebhook({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: fakeSub(botId, 'canceled') } });
  check('webhook subscription.deleted → 200', r.status === 200);
  c = await get(`/api/chat/config/${botId}`);
  check('dopo disdetta → widget spento', c.json.active === false);
  r = await post('/api/chat', { message: 'ciao', botId });
  check('dopo disdetta → chat 402', r.status === 402);
  return botId;
}

(async () => {
  await wait(500);
  const h = await get('/health');
  check('health: stripe/webhook/prices/email = true', h.json.stripe && h.json.stripeWebhook && h.json.stripePrices && h.json.email);

  await testLeads();
  const botId = await testStripe();

  const c = await get('/api/chat/config/demo');
  check('bot demo sempre attivo (La Bella Italia)', c.json.active === true && c.json.restaurantName.includes('Bella Italia'));
  const w = await get('/welcome?session_id=cs_test_x');
  check('/welcome servita', w.status === 200 && w.text.includes('welcome.js'));
  const plans = await get('/api/stripe/plans');
  check('/plans non espone i priceId', !JSON.stringify(plans.json).includes('price_basic'));
  const home = await get('/');
  check('landing contiene il form lead', home.text.includes('id="leadForm"'));

  const db = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'db.json'), 'utf8'));
  check('db.json persistito', db.accounts[botId]?.status === 'canceled' && db.leads['mario@example.com']?.sequenceStatus === 'unsubscribed');

  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`\n${failures === 0 ? '🎉 Tutti i test superati' : `⚠️ ${failures} test falliti`}`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
