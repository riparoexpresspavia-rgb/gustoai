require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const chatRouter = require('./routes/chat');
const widgetRouter = require('./routes/widget');
const stripeRouter = require('./routes/stripe');
const dashboardRouter = require('./routes/dashboard');
const leadsRouter = require('./routes/leads');
const { isEmailConfigured } = require('./services/email');

const app = express();
const PORT = process.env.PORT || 3000;

// Render (come ogni PaaS) sta dietro un reverse proxy: serve per avere
// l'IP reale del client (rate limit) e il protocollo https corretto.
app.set('trust proxy', 1);

// ── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // disabilitato per permettere iframe widget
}));
app.use(cors({
  origin: '*', // permette embedding widget su qualsiasi sito
  methods: ['GET', 'POST'],
}));

// ── Rate Limiting ────────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 20,             // max 20 messaggi/minuto per IP
  message: { error: 'Troppi messaggi. Riprova tra un minuto.' }
});

// ── Body Parsing ─────────────────────────────────────────────────────────────
// Stripe webhook richiede il body RAW
app.use('/api/stripe/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// ── Static Files (Landing Page + Dashboard) ──────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/chat',      chatLimiter, chatRouter);
app.use('/api/widget',    widgetRouter);
app.use('/api/stripe',    stripeRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/leads',     leadsRouter);

// ── Pagina post-pagamento (attivazione widget) ────────────────────────────────
app.get('/welcome', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/welcome.html'));
});

// ── Dashboard cliente (configurazione self-service) ───────────────────────────
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// ── Anteprima live del chatbot ────────────────────────────────────────────────
app.get('/preview', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/preview.html'));
});

// ── Health Check (per Render) ─────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok',
  service: 'GustoAI',
  openai: Boolean(process.env.OPENAI_API_KEY),
  stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  stripePrices: Boolean(process.env.STRIPE_PRICE_ID_BASIC && process.env.STRIPE_PRICE_ID_PRO),
  email: isEmailConfigured(),
}));

// ── SPA Fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🍽️  GustoAI server avviato su porta ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
});

module.exports = app;
