const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Database in-memory semplice (sostituire con Supabase in produzione)
const botConfigs = new Map();

// Config default per demo
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

    // Carica configurazione bot (default se non trovata)
    const config = botId && botConfigs.has(botId)
      ? botConfigs.get(botId)
      : DEFAULT_CONFIG;

    // Costruisce il prompt di sistema personalizzato per il ristorante
    const systemPrompt = buildSystemPrompt(config);

    // Prepara la history della conversazione (max ultimi 10 messaggi)
    const recentHistory = (conversationHistory || []).slice(-10).map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: msg.content,
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message },
    ];

    // Chiamata OpenAI
    const completion = await openai.chat.completions.create({
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
router.get('/config/:botId', (req, res) => {
  const { botId } = req.params;
  const config = botConfigs.get(botId) || DEFAULT_CONFIG;

  // Ritorna solo i campi pubblici (non dati sensibili)
  res.json({
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
 * Salva la configurazione del bot (protetto)
 */
router.post('/config/:botId', (req, res) => {
  const { botId } = req.params;
  const config = { ...DEFAULT_CONFIG, ...req.body };
  botConfigs.set(botId, config);
  res.json({ success: true, botId });
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
