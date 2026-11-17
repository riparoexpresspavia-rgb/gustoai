const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getBaseUrl } = require('../utils/baseUrl');
const { getStripe } = require('../services/stripeClient');
const accounts = require('../services/accounts');
const leads = require('../services/leads');
const email = require('../services/email');
const templates = require('../services/emailTemplates');
const store = require('../services/store');
const { dashboardUrl } = require('./dashboard');

const stripe = getStripe();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SESSION_ID_RE = /^cs_(test|live)_[a-zA-Z0-9]+$/;

// Giorni di prova gratuita (0 = nessuna prova)
const TRIAL_DAYS = Math.max(0, parseInt(process.env.STRIPE_TRIAL_DAYS ?? '14', 10) || 0);

const PLANS = {
  basic: {
    name: 'Piano Base',
    price: 4900, // €49.00 in centesimi
    priceId: process.env.STRIPE_PRICE_ID_BASIC,
    features: ['1 chatbot', 'AI GPT-4o-mini', 'Widget sito web', 'Dashboard', '500 messaggi/mese'],
  },
  pro: {
    name: 'Piano Pro',
    price: 9900, // €99.00 in centesimi
    priceId: process.env.STRIPE_PRICE_ID_PRO,
    features: ['3 chatbot', 'AI GPT-4o', 'Widget + WhatsApp', 'Dashboard analytics', 'Messaggi illimitati', 'Supporto prioritario'],
  },
};

function storeOnboarded(botId) {
  store.update('accounts', botId, { onboardedAt: new Date().toISOString() });
}

function newBotId() {
  return `bot_${crypto.randomBytes(6).toString('hex')}`; // es. bot_3fa94c1b2e7d
}

function embedCode(baseUrl, botId) {
  return `<script src="${baseUrl}/api/widget/${botId}/embed" defer></script>`;
}

/**
 * POST /api/stripe/checkout
 * Crea una sessione di checkout Stripe (abbonamento + prova gratuita)
 */
router.post('/checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Pagamenti non ancora configurati. Contattaci!' });
    }

    const { plan, restaurantName, email: customerEmail } = req.body || {};
    const planConfig = PLANS[plan];

    if (!planConfig) {
      return res.status(400).json({ error: 'Piano non valido' });
    }
    if (!planConfig.priceId) {
      console.error(`STRIPE_PRICE_ID_${plan.toUpperCase()} non impostata`);
      return res.status(503).json({ error: 'Piano non ancora disponibile. Contattaci!' });
    }
    if (!customerEmail || typeof customerEmail !== 'string' || !EMAIL_RE.test(customerEmail.trim())) {
      return res.status(400).json({ error: 'Inserisci un indirizzo email valido.' });
    }

    const baseUrl = getBaseUrl(req);
    const botId = newBotId();
    const cleanName = String(restaurantName || '').trim().slice(0, 100);
    const metadata = { botId, plan, restaurantName: cleanName };

    const subscriptionData = { metadata };
    if (TRIAL_DAYS > 0) subscriptionData.trial_period_days = TRIAL_DAYS;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: customerEmail.trim(),
      client_reference_id: botId,
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      // metadata sia sulla session sia sulla subscription:
      // la subscription è la fonte di verità per attivare/disattivare il bot
      metadata,
      subscription_data: subscriptionData,
      success_url: `${baseUrl}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/#pricing`,
      locale: 'it',
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true }, // P.IVA per la fattura
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Errore Stripe checkout:', error.message);
    res.status(500).json({ error: 'Errore nella creazione del pagamento' });
  }
});

/**
 * GET /api/stripe/session/:sessionId
 * Usato dalla pagina /welcome: verifica il pagamento, attiva l'account
 * (idempotente col webhook) e restituisce lo snippet del widget.
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Pagamenti non configurati' });

    const { sessionId } = req.params;
    if (!SESSION_ID_RE.test(sessionId)) {
      return res.status(400).json({ error: 'Sessione non valida' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });

    if (session.status !== 'complete') {
      return res.status(402).json({ error: 'Pagamento non completato' });
    }

    const { account } = await accounts.activateFromCheckoutSession(session);
    if (!account) return res.status(404).json({ error: 'Account non trovato' });

    const baseUrl = getBaseUrl(req);
    const dbUrl = account.email
      ? dashboardUrl(baseUrl, account.botId, account.email)
      : null;
    res.json({
      botId: account.botId,
      plan: account.plan,
      planName: PLANS[account.plan]?.name || account.plan,
      restaurantName: account.restaurantName,
      email: account.email,
      status: account.status,
      active: accounts.isActiveStatus(account.status),
      trialEnd: account.trialEnd,
      embedCode: embedCode(baseUrl, account.botId),
      dashboardUrl: dbUrl,
    });
  } catch (error) {
    console.error('Errore lettura sessione:', error.message);
    res.status(500).json({ error: 'Impossibile verificare il pagamento' });
  }
});

/**
 * POST /api/stripe/portal
 * Body: { sessionId } → link al Customer Portal Stripe (gestione/disdetta)
 */
router.post('/portal', async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Pagamenti non configurati' });

    const { sessionId } = req.body || {};
    if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
      return res.status(400).json({ error: 'Sessione non valida' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status !== 'complete' || !session.customer) {
      return res.status(400).json({ error: 'Nessun abbonamento associato' });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: session.customer,
      return_url: `${getBaseUrl(req)}/welcome?session_id=${sessionId}`,
      locale: 'it',
    });
    res.json({ url: portal.url });
  } catch (error) {
    console.error('Errore portal:', error.message);
    res.status(500).json({ error: 'Impossibile aprire l\'area abbonamento' });
  }
});

// ── Webhook handlers ─────────────────────────────────────────────────────────

async function onCheckoutCompleted(session, baseUrl) {
  const { account } = await accounts.activateFromCheckoutSession(session);
  if (!account) return;

  console.log(`✅ Account attivato: ${account.botId} (${account.email}) — ${account.plan}/${account.status}`);

  // Onboarding eseguito una sola volta per account (Stripe può ritentare l'evento,
  // e la pagina /welcome può aver già attivato l'account prima del webhook)
  if (account.onboardedAt) return;
  storeOnboarded(account.botId);

  if (account.email) {
    // Il lead è diventato cliente: stop alla sequenza di vendita
    leads.stopSequence(account.email, 'converted').catch(e => console.warn('Stop sequenza:', e.message));

    // Email di benvenuto con lo snippet del widget
    const msg = templates.welcomeEmail({
      restaurantName: account.restaurantName,
      planName: PLANS[account.plan]?.name || account.plan,
      embedCode: embedCode(baseUrl, account.botId),
      welcomeUrl: `${baseUrl}/welcome?session_id=${session.id}`,
      dbUrl: dashboardUrl(baseUrl, account.botId, account.email),
      trialEnd: account.trialEnd,
    });
    email.sendEmail({
      to: account.email,
      ...msg,
      tags: [{ name: 'type', value: 'welcome' }],
      idempotencyKey: `welcome-${account.botId}`, // Resend deduplica per 24h
    }).catch(e => console.error('Email benvenuto non inviata:', e.message));
  }

  leads.notifyAdmin('💰 Nuovo cliente', {
    Ristorante: account.restaurantName || '-',
    Email: account.email || '-',
    Piano: account.plan,
    Stato: account.status,
    BotId: account.botId,
  });
}

async function onSubscriptionChanged(subscription, eventType) {
  const account = accounts.upsertFromSubscription(subscription);
  if (!account) return; // subscription non creata da GustoAI

  const active = accounts.isActiveStatus(account.status);
  console.log(`${active ? '🟢' : '🔴'} ${eventType}: ${account.botId} → ${account.status}`);

  if (eventType === 'customer.subscription.deleted') {
    leads.notifyAdmin('❌ Abbonamento cancellato', {
      Ristorante: account.restaurantName || '-',
      Email: account.email || '-',
      BotId: account.botId,
    });
  }
}

/**
 * POST /api/stripe/webhook
 * Eventi da abilitare su Stripe:
 *   checkout.session.completed, customer.subscription.created,
 *   customer.subscription.updated, customer.subscription.deleted,
 *   invoice.payment_failed
 */
router.post('/webhook', async (req, res) => {
  if (!stripe) return res.json({ received: true });

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET non impostata: webhook rifiutato');
    return res.status(500).send('Webhook non configurato');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // Buffer raw (vedi server.js)
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn('Firma webhook non valida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const baseUrl = getBaseUrl(req);

    switch (event.type) {
      case 'checkout.session.completed':
        await onCheckoutCompleted(event.data.object, baseUrl);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await onSubscriptionChanged(event.data.object, event.type);
        break;

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.warn(`⚠️ Pagamento fallito: ${invoice.customer_email || invoice.customer}`);
        leads.notifyAdmin('⚠️ Pagamento fallito', {
          Email: invoice.customer_email || '-',
          Cliente: invoice.customer || '-',
          Importo: `€${((invoice.amount_due || 0) / 100).toFixed(2)}`,
        });
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    // 500 → Stripe ritenta automaticamente l'evento
    console.error(`Errore gestione webhook ${event.type}:`, error.message);
    res.status(500).json({ error: 'Webhook error' });
  }
});

/**
 * GET /api/stripe/plans
 * Ritorna i piani disponibili (senza esporre i priceId)
 */
router.get('/plans', (req, res) => {
  const publicPlans = Object.fromEntries(
    Object.entries(PLANS).map(([key, { priceId, ...rest }]) => [key, { ...rest, available: Boolean(priceId && stripe) }])
  );
  res.json({ trialDays: TRIAL_DAYS, plans: publicPlans });
});

module.exports = router;
