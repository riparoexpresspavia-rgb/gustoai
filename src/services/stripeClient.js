/**
 * Client Stripe condiviso. Ritorna null se STRIPE_SECRET_KEY non è impostata
 * (modalità demo: il server parte comunque).
 */
let stripe = null;
let initialized = false;

function getStripe() {
  if (initialized) return stripe;
  initialized = true;

  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('Stripe non configurato - modalità demo');
    return null;
  }
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  } catch (e) {
    console.warn('Errore inizializzazione Stripe:', e.message);
    stripe = null;
  }
  return stripe;
}

module.exports = { getStripe };
