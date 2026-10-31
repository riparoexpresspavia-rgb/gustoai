const express = require('express');
const router = express.Router();
let stripe;

try {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
} catch (e) {
  console.warn('Stripe non configurato - modalità demo');
}

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

/**
 * POST /api/stripe/checkout
 * Crea una sessione di checkout Stripe
 */
router.post('/checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: 'Pagamenti non ancora configurati. Contattaci!' });
    }

    const { plan, restaurantName, email } = req.body;
    const planConfig = PLANS[plan];

    if (!planConfig) {
      return res.status(400).json({ error: 'Piano non valido' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price: planConfig.priceId,
        quantity: 1,
      }],
      metadata: {
        restaurantName: restaurantName || '',
        plan,
      },
      success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}&welcome=1`,
      cancel_url: `${baseUrl}/#pricing`,
      locale: 'it',
      allow_promotion_codes: true,
    });

    res.json({ url: session.url });

  } catch (error) {
    console.error('Errore Stripe checkout:', error.message);
    res.status(500).json({ error: 'Errore nella creazione del pagamento' });
  }
});

/**
 * POST /api/stripe/webhook
 * Gestisce gli eventi Stripe (pagamenti, cancellazioni, ecc.)
 */
router.post('/webhook', async (req, res) => {
  try {
    if (!stripe) return res.json({ received: true });

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log(`✅ Nuovo cliente: ${session.customer_email} - Piano: ${session.metadata?.plan}`);
        // TODO: Salva in database + invia email di benvenuto
        break;

      case 'customer.subscription.deleted':
        console.log(`❌ Abbonamento cancellato: ${event.data.object.customer}`);
        // TODO: Disabilita accesso cliente
        break;

      default:
        break;
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Errore webhook:', error);
    res.status(500).json({ error: 'Webhook error' });
  }
});

/**
 * GET /api/stripe/plans
 * Ritorna i piani disponibili
 */
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

module.exports = router;
