/**
 * Dashboard Cliente — configurazione self-service del bot.
 * AUTH: token HMAC-SHA256(APP_SECRET, "botId:email") — nessuna dipendenza esterna.
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const store = require('../services/store');
const accounts = require('../services/accounts');

// ── Token helpers ─────────────────────────────────────────────────────────────

function getSecret() {
  return process.env.APP_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'gustoai-dev-secret';
}

function makeDashboardToken(botId, email) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(`${botId}:${String(email).trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 48);
}

function verifyDashboardToken(botId, email, token) {
  if (!token || typeof token !== 'string') return false;
  const expected = makeDashboardToken(botId, email);
  if (token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
}

function dashboardUrl(baseUrl, botId, email) {
  const token = makeDashboardToken(botId, email);
  return `${baseUrl}/dashboard?botId=${encodeURIComponent(botId)}&token=${token}`;
}

// ── Whitelist campi modificabili ──────────────────────────────────────────────

const DASHBOARD_FIELDS = [
  'restaurantName', 'phone', 'address', 'openingHours', 'closingDays',
  'menuText', 'menu', 'allergens', 'reservationLink', 'customInstructions',
  'welcomeMessage', 'primaryColor', 'cuisine', 'instagramUrl', 'facebookUrl',
];

// ── Middleware auth ───────────────────────────────────────────────────────────

async function requireDashboardAuth(req, res, next) {
  const { botId } = req.params;
  const token = req.query.token || req.body?.token;

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(botId || '')) {
    return res.status(400).json({ error: 'botId non valido' });
  }

  const account = await accounts.getAccount(botId);
  if (!account) {
    return res.status(404).json({ error: 'Account non trovato' });
  }
  if (!account.email) {
    return res.status(403).json({ error: "Nessuna email associata all'account" });
  }

  if (!verifyDashboardToken(botId, account.email, token)) {
    return res.status(403).json({ error: 'Token non valido. Usa il link dalla tua email di benvenuto.' });
  }

  req.account = account;
  next();
}

// ── GET /api/dashboard/:botId/config ─────────────────────────────────────────

router.get('/:botId/config', requireDashboardAuth, (req, res) => {
  const { botId } = req.params;
  const account = req.account;
  const saved = store.get('botConfigs', botId) || {};

  const config = {
    restaurantName: account.restaurantName || '',
    phone: '', address: '', openingHours: '', closingDays: '',
    menuText: '', menu: [], allergens: '', reservationLink: '',
    customInstructions: '', welcomeMessage: '',
    primaryColor: '#e74c3c', cuisine: 'italiana',
    instagramUrl: '', facebookUrl: '',
    ...saved,
    email: account.email,
    plan: account.plan,
    status: account.status,
    trialEnd: account.trialEnd || null,
    botId,
  };

  res.json({ success: true, config });
});

// ── POST /api/dashboard/:botId/config ────────────────────────────────────────

router.post('/:botId/config', requireDashboardAuth, (req, res) => {
  const { botId } = req.params;
  const body = req.body || {};

  const patch = {};
  for (const key of DASHBOARD_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Nessun campo valido da aggiornare' });
  }

  const existing = store.get('botConfigs', botId) || {};
  const newConfig = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  store.set('botConfigs', botId, newConfig);

  res.json({ success: true, botId, updatedFields: Object.keys(patch) });
});

// ── GET /api/dashboard/stats  (admin) ────────────────────────────────────────

router.get('/stats', (req, res) => {
  const allAccounts = store.all('accounts');
  const active = allAccounts.filter(a => accounts.isActiveStatus(a.status));
  res.json({
    totalClients: allAccounts.length,
    activeSubscriptions: active.length,
    monthlyRevenue: active.reduce((sum, a) => sum + (a.plan === 'pro' ? 99 : 49), 0),
    totalMessages: 0,
    growth: 0,
  });
});

// ── GET /api/dashboard/demo-config ───────────────────────────────────────────

router.get('/demo-config', (req, res) => {
  res.json({
    botId: 'demo',
    restaurantName: 'Ristorante La Bella Italia',
    cuisine: 'italiana tradizionale',
    welcomeMessage: 'Ciao! 👋 Sono GustoBot! Come posso aiutarti oggi?',
    primaryColor: '#e74c3c',
    openingHours: 'Mar-Dom: 12:00-15:00 | 19:00-23:00',
    closingDays: 'Lunedì',
    phone: '+39 02 1234567',
    menu: [
      { name: 'Spaghetti alla Carbonara', description: 'Ricetta tradizionale romana', price: '14' },
      { name: 'Risotto ai Funghi Porcini', description: 'Con porcini freschi di stagione', price: '16' },
    ],
    instagramUrl: 'https://instagram.com/gustoai',
    facebookUrl: 'https://facebook.com/gustoai',
  });
});

module.exports = router;
module.exports.dashboardUrl = dashboardUrl;
module.exports.makeDashboardToken = makeDashboardToken;
