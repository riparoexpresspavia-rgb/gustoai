const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getBaseUrl } = require('../utils/baseUrl');
const leads = require('../services/leads');
const { verifyUnsubscribeToken } = require('../services/email');
const { escapeHtml } = require('../services/emailTemplates');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Max 5 richieste demo per IP ogni ora (anti-spam)
const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste. Riprova più tardi.' },
});

/**
 * POST /api/leads
 * Body: { name, email, restaurantName?, phone?, consent, website (honeypot) }
 */
router.post('/', leadLimiter, async (req, res) => {
  try {
    const { name, email, restaurantName, phone, consent, website, source } = req.body || {};

    // Honeypot: i bot compilano il campo nascosto → fingiamo successo
    if (website) return res.json({ success: true });

    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'Inserisci il tuo nome.' });
    }
    if (!email || typeof email !== 'string' || email.length > 120 || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Inserisci un indirizzo email valido.' });
    }
    if (restaurantName && (typeof restaurantName !== 'string' || restaurantName.length > 100)) {
      return res.status(400).json({ error: 'Nome ristorante non valido.' });
    }
    if (phone && (typeof phone !== 'string' || phone.length > 30)) {
      return res.status(400).json({ error: 'Telefono non valido.' });
    }
    if (consent !== true && consent !== 'true' && consent !== 'on') {
      return res.status(400).json({ error: 'Devi accettare di ricevere le email per avere la demo.' });
    }

    const { alreadyRegistered } = await leads.createLead(
      { name, email, restaurantName, phone, source: typeof source === 'string' ? source.slice(0, 40) : 'landing' },
      getBaseUrl(req)
    );

    res.json({
      success: true,
      alreadyRegistered,
      message: alreadyRegistered
        ? 'Sei già iscritto! Controlla la tua casella email (anche spam).'
        : 'Perfetto! Ti abbiamo inviato la demo via email.',
    });
  } catch (error) {
    console.error('Errore lead:', error.message);
    res.status(500).json({ error: 'Errore interno. Riprova tra poco.' });
  }
});

/**
 * GET/POST /api/leads/unsubscribe?email=...&token=...
 * GET = link nell'email, POST = one-click unsubscribe (RFC 8058, Gmail/Yahoo)
 */
async function handleUnsubscribe(req, res) {
  const email = String(req.query.email || '');
  const token = String(req.query.token || '');

  if (!email || !verifyUnsubscribeToken(email, token)) {
    return res.status(400).send(page('Link non valido', 'Il link di disiscrizione non è valido o è scaduto.'));
  }

  try {
    await leads.stopSequence(email, 'unsubscribed');
  } catch (e) {
    console.error('Errore disiscrizione:', e.message);
  }

  if (req.method === 'POST') return res.json({ success: true });
  res.send(page('Disiscrizione completata', `L'indirizzo <strong>${escapeHtml(email)}</strong> non riceverà più email da GustoAI.`));
}

router.get('/unsubscribe', handleUnsubscribe);
router.post('/unsubscribe', handleUnsubscribe);

function page(title, body) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — GustoAI</title><link rel="stylesheet" href="/styles.css"></head>
<body style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f6f6f6;">
<div class="modal-box" style="max-width:480px"><div class="modal-icon">🍽️</div><h3>${escapeHtml(title)}</h3><p>${body}</p>
<a href="/" class="btn btn-primary">Torna al sito</a></div></body></html>`;
}

module.exports = router;
