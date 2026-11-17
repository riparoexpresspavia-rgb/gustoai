/**
 * Template email GustoAI.
 * I testi sono riportati anche in MARKETING_SETUP.md: se li modifichi qui,
 * aggiorna anche la guida.
 */

// Ritardo (in giorni) di ciascuna email della sequenza dal momento dell'iscrizione
const SEQUENCE_DELAYS_DAYS = [0, 2, 5];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'ciao';
}

// ── Layout HTML comune ───────────────────────────────────────────────────────
function layout({ preheader, bodyHtml, footerNote, unsubscribeUrl }) {
  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 0;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="background:#e74c3c;padding:20px 28px;color:#ffffff;font-size:20px;font-weight:bold;">🍽️ GustoAI</td></tr>
<tr><td style="padding:28px;font-size:16px;line-height:1.6;">${bodyHtml}</td></tr>
<tr><td style="padding:16px 28px;background:#fafafa;font-size:12px;color:#888;line-height:1.5;">
${escapeHtml(footerNote)}<br>
${unsubscribeUrl ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">Non voglio più ricevere queste email</a>` : ''}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href, label) {
  return `<p style="margin:28px 0;"><a href="${escapeHtml(href)}" style="background:#e74c3c;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

const LEAD_FOOTER = 'Ricevi questa email perché hai richiesto la demo gratuita di GustoAI.';
const CUSTOMER_FOOTER = 'Ricevi questa email perché hai attivato un abbonamento GustoAI.';

// ── Sequenza di vendita (3 email) ────────────────────────────────────────────
// Ogni builder riceve v = { nome, nomeHtml, locale, localeHtml, demoUrl, pricingUrl }

// EMAIL 1 — inviata subito
function email1(v) {
  return {
    subject: 'La tua demo di GustoAI è pronta 🍽️',
    preheader: 'Prova il chatbot che risponde ai tuoi clienti anche quando sei chiuso.',
    html: `
<p>Ciao ${v.nomeHtml},</p>
<p>grazie per aver richiesto la demo di <strong>GustoAI</strong>! Ecco il link per provare subito l'assistente AI così come lo vedrebbero i clienti di ${v.localeHtml}:</p>
${button(v.demoUrl, 'Prova la demo live →')}
<p>Fagli qualche domanda come farebbe un cliente:</p>
<ul>
  <li>“Siete aperti domenica sera?”</li>
  <li>“Avete piatti senza glutine?”</li>
  <li>“Vorrei prenotare per 4 persone sabato”</li>
</ul>
<p>Il tuo GustoBot risponderà così, ma con <strong>il tuo menù, i tuoi orari e i colori del tuo locale</strong>. Si installa con una riga di codice su qualsiasi sito (WordPress, Wix, Squarespace…) e, se preferisci, lo installiamo noi gratis.</p>
<p>Hai 14 giorni di prova gratuita per vederlo all'opera sul tuo sito.</p>
<p>A presto,<br>Il team GustoAI</p>
<p style="font-size:14px;color:#666;">P.S. Rispondi pure a questa email per qualsiasi domanda: ti risponde una persona vera.</p>`,
    text: `Ciao ${v.nome},

grazie per aver richiesto la demo di GustoAI! Prova subito l'assistente AI come lo vedrebbero i clienti di ${v.locale}:
${v.demoUrl}

Fagli qualche domanda come farebbe un cliente:
- "Siete aperti domenica sera?"
- "Avete piatti senza glutine?"
- "Vorrei prenotare per 4 persone sabato"

Il tuo GustoBot risponderà così, ma con il tuo menù, i tuoi orari e i colori del tuo locale. Si installa con una riga di codice su qualsiasi sito (WordPress, Wix, Squarespace...) e, se preferisci, lo installiamo noi gratis.

Hai 14 giorni di prova gratuita per vederlo all'opera sul tuo sito.

A presto,
Il team GustoAI

P.S. Rispondi pure a questa email per qualsiasi domanda: ti risponde una persona vera.`,
  };
}

// EMAIL 2 — dopo 2 giorni
function email2(v) {
  return {
    subject: 'Quanti clienti perdi quando non puoi rispondere?',
    preheader: 'Basta un tavolo in più al mese per ripagare GustoAI.',
    html: `
<p>Ciao ${v.nomeHtml},</p>
<p>una domanda veloce: cosa succede quando un cliente scrive al tuo ristorante alle 23:30, o durante il servizio del sabato sera, quando nessuno ha tempo di rispondere?</p>
<p>Spesso… <strong>prenota altrove</strong>. Non perché il tuo locale non gli piaccia, ma perché qualcun altro ha risposto prima.</p>
<p>GustoAI risolve esattamente questo:</p>
<ul>
  <li>⏱️ <strong>Risponde in pochi secondi</strong>, 24 ore su 24, anche a locale chiuso</li>
  <li>📅 <strong>Porta il cliente alla prenotazione</strong> (link, telefono o WhatsApp)</li>
  <li>🍝 <strong>Conosce il tuo menù</strong>: prezzi, specialità, opzioni vegane e senza glutine</li>
  <li>🙌 <strong>Toglie al tuo staff</strong> le solite domande su orari, parcheggio e menù</li>
</ul>
<p>Facciamo due conti: con il Piano Base a €49/mese, <strong>basta un tavolo da 2–3 persone in più al mese</strong> per ripagare l'abbonamento. Tutto il resto è guadagno.</p>
${button(v.pricingUrl, 'Attiva la prova gratuita di 14 giorni →')}
<p>Nessun vincolo: disdici quando vuoi, con un clic.</p>
<p>Buon servizio,<br>Il team GustoAI</p>`,
    text: `Ciao ${v.nome},

una domanda veloce: cosa succede quando un cliente scrive al tuo ristorante alle 23:30, o durante il servizio del sabato sera, quando nessuno ha tempo di rispondere?

Spesso... prenota altrove. Non perché il tuo locale non gli piaccia, ma perché qualcun altro ha risposto prima.

GustoAI risolve esattamente questo:
- Risponde in pochi secondi, 24 ore su 24, anche a locale chiuso
- Porta il cliente alla prenotazione (link, telefono o WhatsApp)
- Conosce il tuo menù: prezzi, specialità, opzioni vegane e senza glutine
- Toglie al tuo staff le solite domande su orari, parcheggio e menù

Facciamo due conti: con il Piano Base a €49/mese, basta un tavolo da 2-3 persone in più al mese per ripagare l'abbonamento. Tutto il resto è guadagno.

Attiva la prova gratuita di 14 giorni: ${v.pricingUrl}

Nessun vincolo: disdici quando vuoi, con un clic.

Buon servizio,
Il team GustoAI`,
  };
}

// EMAIL 3 — dopo 5 giorni
function email3(v) {
  return {
    subject: `${v.nome === 'ciao' ? 'Ciao' : v.nome}, te lo installiamo noi (gratis)`,
    preheader: 'Le 3 domande che ci fanno tutti i ristoratori, con le risposte.',
    html: `
<p>Ciao ${v.nomeHtml},</p>
<p>è l'ultima email che ti mando su questo argomento, promesso. Prima però voglio rispondere alle 3 domande che ci fanno quasi tutti i ristoratori:</p>
<p><strong>1. “Non sono pratico di tecnologia.”</strong><br>
Non serve. Ci mandi menù e orari, configuriamo noi il tuo GustoBot e lo installiamo sul tuo sito. Tu non tocchi niente.</p>
<p><strong>2. “E se il bot dice qualcosa di sbagliato?”</strong><br>
GustoBot risponde solo usando le informazioni del tuo locale. Se non sa qualcosa, invita il cliente a chiamarti: non inventa piatti né prezzi.</p>
<p><strong>3. “E se non mi trovo bene?”</strong><br>
Hai 14 giorni gratis per provarlo. Se non fa per te, disdici con un clic prima della fine della prova e non paghi nulla.</p>
${button(v.pricingUrl, 'Inizia la prova gratuita →')}
<p>Oppure <strong>rispondi semplicemente “SÌ” a questa email</strong>: ti ricontattiamo noi e in 24 ore il tuo assistente è online su ${v.localeHtml}.</p>
<p>Grazie per il tuo tempo,<br>Il team GustoAI</p>`,
    text: `Ciao ${v.nome},

è l'ultima email che ti mando su questo argomento, promesso. Prima però voglio rispondere alle 3 domande che ci fanno quasi tutti i ristoratori:

1. "Non sono pratico di tecnologia."
Non serve. Ci mandi menù e orari, configuriamo noi il tuo GustoBot e lo installiamo sul tuo sito. Tu non tocchi niente.

2. "E se il bot dice qualcosa di sbagliato?"
GustoBot risponde solo usando le informazioni del tuo locale. Se non sa qualcosa, invita il cliente a chiamarti: non inventa piatti né prezzi.

3. "E se non mi trovo bene?"
Hai 14 giorni gratis per provarlo. Se non fa per te, disdici con un clic prima della fine della prova e non paghi nulla.

Inizia la prova gratuita: ${v.pricingUrl}

Oppure rispondi semplicemente "SÌ" a questa email: ti ricontattiamo noi e in 24 ore il tuo assistente è online su ${v.locale}.

Grazie per il tuo tempo,
Il team GustoAI`,
  };
}

const SALES_BUILDERS = [email1, email2, email3];

/**
 * @param {number} step 0, 1 o 2
 * @param {object} lead { name, restaurantName, demoUrl, pricingUrl, unsubscribeUrl }
 */
function salesEmail(step, lead) {
  const nome = firstName(lead.name);
  const locale = String(lead.restaurantName || '').trim() || 'il tuo ristorante';
  const e = SALES_BUILDERS[step]({
    nome,
    nomeHtml: escapeHtml(nome),
    locale,
    localeHtml: escapeHtml(locale),
    demoUrl: lead.demoUrl,
    pricingUrl: lead.pricingUrl,
  });

  return {
    subject: e.subject,
    text: `${e.text}\n\n---\nNon vuoi più ricevere queste email? ${lead.unsubscribeUrl}`,
    html: layout({
      preheader: e.preheader,
      bodyHtml: e.html,
      footerNote: LEAD_FOOTER,
      unsubscribeUrl: lead.unsubscribeUrl,
    }),
  };
}

// ── Email di benvenuto dopo il pagamento ─────────────────────────────────────
/**
 * @param {object} v { restaurantName, planName, embedCode, welcomeUrl, dbUrl, trialEnd }
 */
function welcomeEmail(v) {
  const locale = String(v.restaurantName || '').trim() || 'il tuo ristorante';
  const trialDate = v.trialEnd ? new Date(v.trialEnd).toLocaleDateString('it-IT') : null;

  const html = `
<p>Benvenuto in GustoAI! 🎉</p>
<p>Il chatbot di <strong>${escapeHtml(locale)}</strong> è <strong>attivo</strong> (${escapeHtml(v.planName)}).</p>
${trialDate ? `<p>La tua prova gratuita termina il <strong>${trialDate}</strong>: fino ad allora non ti verrà addebitato nulla.</p>` : ''}
${v.dbUrl ? button(v.dbUrl, '⚙️ Configura subito il tuo bot →') : ''}
<p><strong>Nella dashboard puoi personalizzare in autonomia:</strong> nome del ristorante, orari, menù, allergeni, link prenotazioni e istruzioni per l'AI.</p>
<p><strong>Come installare il widget sul tuo sito (1 minuto):</strong> copia questa riga e incollala prima di <code>&lt;/body&gt;</code>:</p>
<pre style="background:#f4f4f4;border-radius:8px;padding:14px;font-size:13px;white-space:pre-wrap;word-break:break-all;">${escapeHtml(v.embedCode)}</pre>
${button(v.welcomeUrl, 'Apri la pagina di attivazione →')}
<p>Dalla pagina di attivazione puoi gestire o disdire l'abbonamento in qualsiasi momento.</p>
<p>Buon lavoro,<br>Il team GustoAI</p>`;

  const text = `Benvenuto in GustoAI!

Il chatbot di ${locale} è attivo (${v.planName}).
${trialDate ? `La prova gratuita termina il ${trialDate}: fino ad allora non ti verrà addebitato nulla.\n` : ''}
${v.dbUrl ? `⚙️ Configura subito il tuo bot dalla dashboard:\n${v.dbUrl}\n\n` : ''}Nella dashboard puoi personalizzare: nome, orari, menù, allergeni, link prenotazioni e istruzioni per l'AI.

Come installare il widget: incolla questa riga nel tuo sito, prima di </body>:
${v.embedCode}

Pagina di attivazione (anche per gestire/disdire l'abbonamento):
${v.welcomeUrl}

Buon lavoro,
Il team GustoAI`;

  return {
    subject: `✅ Il chatbot di ${locale} è attivo`,
    html: layout({
      preheader: 'Ecco il codice da incollare nel tuo sito.',
      bodyHtml: html,
      footerNote: CUSTOMER_FOOTER,
      unsubscribeUrl: null,
    }),
    text,
  };
}

// ── Notifica interna (nuovo lead / nuovo cliente / disdetta) ────────────────
function adminNotification(title, fields) {
  const entries = Object.entries(fields);
  const rows = entries
    .map(([k, val]) => `<tr><td style="padding:4px 12px 4px 0;color:#888;">${escapeHtml(k)}</td><td style="padding:4px 0;"><strong>${escapeHtml(val)}</strong></td></tr>`)
    .join('');
  return {
    subject: `[GustoAI] ${title}`,
    html: `<h2 style="font-family:Arial">${escapeHtml(title)}</h2><table style="font-family:Arial;font-size:14px">${rows}</table>`,
    text: `${title}\n\n${entries.map(([k, val]) => `${k}: ${val}`).join('\n')}`,
  };
}

module.exports = {
  SEQUENCE_DELAYS_DAYS,
  salesEmail,
  welcomeEmail,
  adminNotification,
  escapeHtml,
};
