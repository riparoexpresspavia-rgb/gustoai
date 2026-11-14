/**
 * Lead generation: salvataggio lead + sequenza di 3 email di vendita.
 *
 * Le email 2 e 3 vengono programmate su Resend (scheduled_at), quindi
 * partono anche se il server Render è in sleep o viene riavviato.
 */
const crypto = require('crypto');
const store = require('./store');
const email = require('./email');
const templates = require('./emailTemplates');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function emailHash(value) {
  return crypto.createHash('sha256').update(normalizeEmail(value)).digest('hex').slice(0, 16);
}

function buildLinks(baseUrl, leadEmail) {
  const token = email.unsubscribeToken(leadEmail);
  const utm = 'utm_source=email&utm_medium=sequenza_demo';
  return {
    demoUrl: `${baseUrl}/?${utm}&utm_campaign=email1#demo`,
    pricingUrl: `${baseUrl}/?${utm}&utm_campaign=followup#pricing`,
    unsubscribeUrl: `${baseUrl}/api/leads/unsubscribe?email=${encodeURIComponent(leadEmail)}&token=${token}`,
  };
}

/**
 * Programma le 3 email della sequenza. Ritorna gli id Resend.
 */
async function scheduleSequence(lead, baseUrl) {
  const links = buildLinks(baseUrl, lead.email);
  const now = Date.now();
  const ids = [];

  for (let step = 0; step < templates.SEQUENCE_DELAYS_DAYS.length; step++) {
    const delayDays = templates.SEQUENCE_DELAYS_DAYS[step];
    const message = templates.salesEmail(step, { ...lead, ...links });

    try {
      const id = await email.sendEmail({
        to: lead.email,
        subject: message.subject,
        html: message.html,
        text: message.text,
        scheduledAt: delayDays > 0 ? new Date(now + delayDays * DAY_MS) : undefined,
        unsubscribeUrl: links.unsubscribeUrl,
        tags: [
          { name: 'type', value: 'sales_sequence' },
          { name: 'step', value: String(step + 1) },
        ],
        idempotencyKey: `lead-${emailHash(lead.email)}-step${step + 1}`,
      });
      ids.push(id);
    } catch (e) {
      console.error(`Email ${step + 1} per ${lead.email} non inviata:`, e.message);
      ids.push(null);
    }
  }
  return ids;
}

async function notifyAdmin(title, fields) {
  if (!process.env.ADMIN_EMAIL) return;
  const msg = templates.adminNotification(title, fields);
  try {
    await email.sendEmail({ to: process.env.ADMIN_EMAIL, ...msg });
  } catch (e) {
    console.warn('Notifica admin non inviata:', e.message);
  }
}

/**
 * Registra un nuovo lead e avvia la sequenza.
 * @returns {{ lead, alreadyRegistered: boolean }}
 */
async function createLead({ name, email: rawEmail, restaurantName, phone, source }, baseUrl) {
  const leadEmail = normalizeEmail(rawEmail);
  const existing = store.get('leads', leadEmail);

  // Già iscritto con sequenza attiva: non reinviare (niente spam)
  if (existing && existing.sequenceStatus === 'scheduled') {
    return { lead: existing, alreadyRegistered: true };
  }

  const lead = store.set('leads', leadEmail, {
    ...(existing || {}),
    email: leadEmail,
    name: String(name).trim(),
    restaurantName: String(restaurantName || '').trim(),
    phone: String(phone || '').trim(),
    source: source || 'landing',
    consentAt: new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    sequenceStatus: 'pending',
    emailIds: [],
  });

  const emailIds = await scheduleSequence(lead, baseUrl);
  const updated = store.update('leads', leadEmail, {
    emailIds,
    sequenceStatus: emailIds.some(Boolean) ? 'scheduled' : 'not_sent',
  });

  notifyAdmin('Nuovo lead demo', {
    Nome: lead.name,
    Email: lead.email,
    Ristorante: lead.restaurantName || '-',
    Telefono: lead.phone || '-',
    Fonte: lead.source,
  });

  return { lead: updated, alreadyRegistered: false };
}

/**
 * Ferma le email non ancora partite (disiscrizione o cliente diventato pagante).
 */
async function stopSequence(rawEmail, reason) {
  const leadEmail = normalizeEmail(rawEmail);
  const lead = store.get('leads', leadEmail);

  if (lead?.emailIds?.length) {
    // L'email 1 è già partita: annulliamo solo quelle programmate
    await Promise.all(lead.emailIds.slice(1).map(id => email.cancelScheduledEmail(id)));
  }

  store.update('leads', leadEmail, {
    email: leadEmail,
    sequenceStatus: reason, // 'unsubscribed' | 'converted'
    stoppedAt: new Date().toISOString(),
  });
  return Boolean(lead);
}

module.exports = { createLead, stopSequence, notifyAdmin, normalizeEmail };
