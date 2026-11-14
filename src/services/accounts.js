/**
 * Gestione account ristoratori (1 account = 1 abbonamento Stripe = 1 botId).
 *
 * Fonte di verità: la subscription Stripe, che porta nei metadata
 * { botId, plan, restaurantName }. Lo store locale è una cache: se si azzera
 * (riavvio Render senza disco) l'account viene ricostruito da Stripe.
 */
const store = require('./store');
const { getStripe } = require('./stripeClient');

// Stati Stripe per cui il widget resta acceso.
// past_due incluso: Stripe ritenta l'incasso, non spegniamo subito il cliente.
const ACTIVE_STATUSES = ['trialing', 'active', 'past_due'];

const DEMO_BOT_ID = 'demo';
const CACHE_TTL_MS = 5 * 60 * 1000;
const negativeCache = new Map(); // botId → timestamp (evita ricerche Stripe ripetute)

function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Crea/aggiorna l'account a partire da una subscription Stripe.
 */
function upsertFromSubscription(subscription, extra = {}) {
  const meta = subscription.metadata || {};
  const botId = meta.botId;
  if (!botId) return null;

  const existing = store.get('accounts', botId);
  const account = {
    ...(existing || { createdAt: new Date().toISOString() }),
    botId,
    plan: meta.plan || existing?.plan || 'basic',
    restaurantName: meta.restaurantName || existing?.restaurantName || '',
    customerId: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    subscriptionId: subscription.id,
    status: subscription.status,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    ...extra,
    updatedAt: new Date().toISOString(),
  };

  negativeCache.delete(botId);
  return store.set('accounts', botId, account);
}

/**
 * Attiva l'account dopo un checkout completato.
 * Idempotente: può essere chiamata sia dal webhook sia dalla pagina di successo.
 * Ritorna { account, isNew }.
 */
async function activateFromCheckoutSession(session) {
  const stripe = getStripe();
  if (!stripe || session.mode !== 'subscription' || !session.subscription) {
    return { account: null, isNew: false };
  }

  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription.id;

  const subscription = typeof session.subscription === 'object'
    ? session.subscription
    : await stripe.subscriptions.retrieve(subscriptionId);

  const botId = subscription.metadata?.botId || session.metadata?.botId || session.client_reference_id;
  if (!botId) {
    console.error(`Checkout ${session.id} senza botId nei metadata`);
    return { account: null, isNew: false };
  }
  subscription.metadata = { ...session.metadata, ...subscription.metadata, botId };

  const existing = store.get('accounts', botId);
  const email = session.customer_details?.email || session.customer_email || existing?.email || '';

  const account = upsertFromSubscription(subscription, {
    email,
    checkoutSessionId: session.id,
    activatedAt: existing?.activatedAt || new Date().toISOString(),
  });

  return { account, isNew: !existing?.activatedAt };
  // Nota: l'onboarding (email di benvenuto) è tracciato con account.onboardedAt
  // nel webhook, indipendentemente da chi ha attivato per primo l'account.
}

/**
 * Ritorna l'account per botId (store locale → fallback ricerca Stripe).
 */
async function getAccount(botId) {
  if (!botId || typeof botId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(botId)) return null;

  const local = store.get('accounts', botId);
  if (local) return local;

  const cachedMiss = negativeCache.get(botId);
  if (cachedMiss && Date.now() - cachedMiss < CACHE_TTL_MS) return null;

  const stripe = getStripe();
  if (!stripe) return null;

  try {
    const result = await stripe.subscriptions.search({
      query: `metadata['botId']:'${botId.replace(/'/g, '')}'`,
      limit: 1,
    });
    const sub = result.data[0];
    if (sub) return upsertFromSubscription(sub);
  } catch (e) {
    console.warn('Ricerca subscription Stripe fallita:', e.message);
  }

  negativeCache.set(botId, Date.now());
  return null;
}

/**
 * true se il bot può rispondere (demo sempre attivo).
 */
async function isBotActive(botId) {
  if (!botId || botId === DEMO_BOT_ID) return true;
  const account = await getAccount(botId);
  return Boolean(account && isActiveStatus(account.status));
}

module.exports = {
  ACTIVE_STATUSES,
  DEMO_BOT_ID,
  isActiveStatus,
  upsertFromSubscription,
  activateFromCheckoutSession,
  getAccount,
  isBotActive,
};
