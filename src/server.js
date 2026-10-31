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

const app = express();
const PORT = process.env.PORT || 3000;

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

// ── Health Check (per Railway) ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'GustoAI' }));

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
