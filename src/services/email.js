/**
 * Invio email tramite Resend REST API (https://resend.com/docs/api-reference).
 * Nessuna dipendenza: usa fetch nativo (Node >= 18).
 *
 * Le email della sequenza vengono PROGRAMMATE su Resend (scheduled_at):
 * non serve un cron e sopravvivono ai riavvii/spin-down di Render.
 */
const crypto = require('crypto');

const RESEND_API = 'https://api.resend.com';

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function resendRequest(pathname, body, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const resp = await fetch(`${RESEND_API}${pathname}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(`Resend ${resp.status}: ${data.message || data.name || 'errore sconosciuto'}`);
  }
  return data;
}

/**
 * Invia (o programma) una email.
 * @param {object} opts { to, subject, html, text, scheduledAt?, unsubscribeUrl?, tags?, idempotencyKey? }
 * @returns {Promise<string|null>} id email Resend, null se email non configurata
 */
async function sendEmail({ to, subject, html, text, scheduledAt, unsubscribeUrl, tags, idempotencyKey }) {
  if (!isEmailConfigured()) {
    console.warn(`Email non configurata (RESEND_API_KEY/EMAIL_FROM): salto "${subject}" → ${to}`);
    return null;
  }

  const payload = {
    from: process.env.EMAIL_FROM,
    to: [to],
    subject,
    html,
    text,
  };
  if (process.env.EMAIL_REPLY_TO) payload.reply_to = process.env.EMAIL_REPLY_TO;
  if (scheduledAt) payload.scheduled_at = new Date(scheduledAt).toISOString();
  if (tags?.length) payload.tags = tags;
  if (unsubscribeUrl) {
    payload.headers = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }

  const data = await resendRequest('/emails', payload, idempotencyKey);
  return data.id || null;
}

/**
 * Annulla una email programmata (ignora errori: può essere già partita).
 */
async function cancelScheduledEmail(emailId) {
  if (!emailId || !isEmailConfigured()) return false;
  try {
    await resendRequest(`/emails/${encodeURIComponent(emailId)}/cancel`);
    return true;
  } catch (e) {
    console.warn(`Annullamento email ${emailId} non riuscito:`, e.message);
    return false;
  }
}

// ── Token disiscrizione (HMAC, nessun dato salvato) ─────────────────────────
function getSecret() {
  return process.env.APP_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'gustoai-dev-secret';
}

function unsubscribeToken(email) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(String(email).trim().toLowerCase())
    .digest('hex')
    .slice(0, 32);
}

function verifyUnsubscribeToken(email, token) {
  const expected = unsubscribeToken(email);
  const given = String(token || '');
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  cancelScheduledEmail,
  unsubscribeToken,
  verifyUnsubscribeToken,
};
