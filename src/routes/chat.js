const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

// Client OpenAI creato in modo lazy: il server parte anche senza chiave
// (evita crash al boot su Render se la variabile non è ancora impostata).
let openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

const crypto = require('crypto');
const store = require('../services/store');
const accounts = require('../services/accounts');

// Configurazioni bot salvate nello store JSON (collezione "botConfigs")
const botConfigs = {
  has: (id) => Boolean(store.get('botConfigs', id)),
  get: (id) => store.get('botConfigs', id),
  set: (id, cfg) => store.set('botConfigs', id, cfg),
};

// Config demo (stessa di /api/dashboard/demo-config) usata per botId "demo"
const DEMO_CONFIG = {
  name: 'GustoBot',
  restaurantName: 'Ristorante La Bella Italia',
  cuisine: 'italiana tradizionale',
  welcomeMessage: 'Ciao! 👋 Sono GustoBot di La Bella Italia! Come posso aiutarti oggi?',
  menu: [
    { name: 'Spaghetti alla Carbonara', description: 'Ricetta tradizionale romana', price: '14' },
    { name: 'Risotto ai Funghi Porcini', description: 'Con porcini freschi di stagione', price: '16' },
    { name: 'Bistecca alla Fiorentina', description: 'Chianina DOP, al kg', price: '45' },
    { name: 'Tiramisù della Casa', description: 'Ricetta segreta dello chef', price: '7' },
  ],
  openingHours: 'Mar-Dom: 12:00-15:00 | 19:00-23:00 | Lunedì chiuso',
  phone: '+39 02 1234567',
  address: 'Via Roma 1, Milano',
  reservationLink: '',
  instagramUrl: 'https://instagram.com/gustoai',
  facebookUrl: 'https://facebook.com/gustoai',
  primaryColor: '#e74c3c',
  language: 'it',
};

// Campi modificabili via API config (whitelist)
const EDITABLE_FIELDS = [
  'name', 'restaurantName', 'cuisine', 'welcomeMessage', 'menu', 'openingHours',
  'phone', 'address', 'reservationLink', 'instagramUrl', 'facebookUrl', 'primaryColor', 'language',
];

/**
 * Risolve la config di un bot: config salvata → nome ristorante dall'account → default.
 */
async function resolveConfig(botId) {
  if (!botId || botId === accounts.DEMO_BOT_ID) return DEMO_CONFIG;
  const saved = botConfigs.get(botId);
  if (saved) return { ...DEFAULT_CONFIG, ...saved };
  const account = await accounts.getAccount(botId);
  return account?.restaurantName
    ? { ...DEFAULT_CONFIG, restaurantName: account.restaurantName }
    : DEFAULT_CONFIG;
}

// Config default per bot nuovi non ancora personalizzati
const DEFAULT_CONFIG = {
  name: 'GustoBot',
  restaurantName: 'Il tuo Ristorante',
  cuisine: 'italiana',
  welcomeMessage: 'Ciao! 👋 Sono GustoBot, l\'assistente AI del ristorante. Come posso aiutarti?',
  menu: [],
  openingHours: 'Lun-Dom: 12:00-15:00 | 19:00-23:00',
  phone: '',
  address: '',
  reservationLink: '',
  instagramUrl: '',
  facebookUrl: '',
  primaryColor: '#e74c3c',
  language: 'it',
};

/**
 * POST /api/chat
 * Invia un messaggio al chatbot AI
 */
router.post('/', async (req, res) => {
  try {
    const { message, botId, conversationHistory = [], sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Messaggio non valido' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Messaggio troppo lungo (max 500 caratteri)' });
    }

    // Il bot risponde solo se l'abbonamento è attivo (o in prova). "demo" sempre attivo.
    if (!(await accounts.isBotActive(botId))) {
      return res.status(402).json({
        error: 'Questo assistente non è attivo. Contatta direttamente il ristorante.',
        inactive: true,
      });
    }

    // Carica configurazione bot
    const config = await resolveConfig(botId);

    // Costruisce il prompt di sistema personalizzato per il ristorante
    const systemPrompt = buildSystemPrompt(config);

    // Prepara la history della conversazione (max ultimi 10 messaggi)
    const recentHistory = (Array.isArray(conversationHistory) ? conversationHistory : [])
      .slice(-10)
      .filter(msg => msg && typeof msg.content === 'string')
      .map(msg => ({
        role: msg.role === 'bot' || msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content.slice(0, 1000),
      }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message },
    ];

    // Chiamata OpenAI
    const client = getOpenAI();
    if (!client) {
      return res.status(503).json({ error: 'Servizio AI non ancora configurato.' });
    }

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 300,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'Mi dispiace, non ho capito. Puoi ripetere?';

    // Estrai eventuali quick replies basate sulla risposta
    const quickReplies = generateQuickReplies(reply, config);

    res.json({
      reply,
      quickReplies,
      sessionId,
    });

  } catch (error) {
    console.error('Errore chat:', error.message);
    if (error.status === 429) {
      return res.status(429).json({ error: 'Servizio temporaneamente occupato. Riprova.' });
    }
    res.status(500).json({ error: 'Errore interno. Riprova tra poco.' });
  }
});

/**
 * GET /api/chat/config/:botId
 * Ritorna la configurazione pubblica di un bot
 */
router.get('/config/:botId', async (req, res) => {
  const { botId } = req.params;
  const [config, active] = await Promise.all([resolveConfig(botId), accounts.isBotActive(botId)]);

  // Ritorna solo i campi pubblici (non dati sensibili)
  res.json({
    active,
    name: config.name,
    restaurantName: config.restaurantName,
    welcomeMessage: config.welcomeMessage,
    primaryColor: config.primaryColor,
    openingHours: config.openingHours,
    instagramUrl: config.instagramUrl,
    facebookUrl: config.facebookUrl,
    reservationLink: config.reservationLink,
  });
});

/**
 * POST /api/chat/config/:botId
 * Salva la configurazione del bot.
 * Protetto: header "x-admin-token" = ADMIN_TOKEN (configurazione fatta da te
 * per conto del ristoratore, finché non c'è la dashboard cliente con login).
 */
router.post('/config/:botId', (req, res) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const given = String(req.headers['x-admin-token'] || '');
  const authorized = adminToken
    && given.length === adminToken.length
    && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(adminToken));

  if (!authorized) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  const { botId } = req.params;
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(botId) || botId === accounts.DEMO_BOT_ID) {
    return res.status(400).json({ error: 'botId non valido' });
  }

  const patch = {};
  for (const key of EDITABLE_FIELDS) {
    if (req.body?.[key] !== undefined) patch[key] = req.body[key];
  }
  const config = { ...DEFAULT_CONFIG, ...(botConfigs.get(botId) || {}), ...patch };
  botConfigs.set(botId, config);
  res.json({ success: true, botId, config });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(config) {
  const menuText = config.menu && config.menu.length > 0
    ? `\nMENÙ DISPONIBILE:\n${config.menu.map(item => `- ${item.name}: ${item.description} (€${item.price})`).join('\n')}`
    : '';

  return `Sei ${config.name}, l'assistente AI virtuale di "${config.restaurantName}", un ristorante di cucina ${config.cuisine}.

ISTRUZIONI COMPORTAMENTO:
- Rispondi SEMPRE in italiano in modo cordiale, professionale e caldo
- Rispondi in modo conciso (max 3-4 frasi per risposta)
- Usa emoji quando appropriato per rendere le risposte più vivaci 🍽️
- Sei specializzato nella ristorazione: menu, prenotazioni, orari, allergeni, eventi speciali
- Per prenotazioni: indirizza sempre a ${config.reservationLink || 'chiamare il ristorante'}
- Telefono ristorante: ${config.phone || 'da configurare'}
- Indirizzo: ${config.address || 'da configurare'}
- Orari: ${config.openingHours}
${menuText}

SOCIAL MEDIA:
${config.instagramUrl ? `- Instagram: ${config.instagramUrl}` : ''}
${config.facebookUrl ? `- Facebook: ${config.facebookUrl}` : ''}

NON fare:
- Non inventare prezzi o piatti non nel menù
- Non fornire informazioni mediche sugli allergeni che non conosci
- Non rispondere a domande non inerenti al ristorante
- Se non sai qualcosa, suggerisci di chiamare il ristorante

Inizia ogni conversazione con entusiasmo e disponibilità!`;
}

function generateQuickReplies(reply, config) {
  const lower = reply.toLowerCase();
  
  if (lower.includes('prenot') || lower.includes('tavol')) {
    return ['📅 Prenota ora', '📞 Chiama', '🕐 Orari'];
  }
  if (lower.includes('menù') || lower.includes('piatt') || lower.includes('mangia')) {
    return ['🍝 Primi piatti', '🥩 Secondi', '🍰 Dolci', '🍷 Vini'];
  }
  if (lower.includes('orari') || lower.includes('aperto')) {
    return ['📅 Prenota', '📞 Info', '📍 Come arrivarci'];
  }
  
  // Default quick replies
  return ['🍽️ Vedi menù', '📅 Prenota', '📞 Contattaci'];
}

module.exports = router;
