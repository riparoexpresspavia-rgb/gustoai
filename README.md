# 🍽️ GustoAI — Chatbot AI per Ristoranti

**GustoAI** è un Micro-SaaS che fornisce chatbot AI personalizzabili per ristoranti italiani. I ristoratori si abbonano e ottengono un chatbot AI sul loro sito che risponde ai clienti 24/7.

---

## 🚀 Setup in 5 minuti

### 1. Clona e installa
```bash
git clone https://github.com/tuousername/gustoai
cd gustoai
npm install
```

### 2. Configura variabili d'ambiente
```bash
cp .env.example .env
# Modifica .env con le tue chiavi API
```

Variabili richieste:
- `OPENAI_API_KEY` → [platform.openai.com](https://platform.openai.com)
- `STRIPE_SECRET_KEY` → [dashboard.stripe.com](https://dashboard.stripe.com)
- `STRIPE_WEBHOOK_SECRET` → generato da Stripe CLI
- `STRIPE_PRICE_ID_BASIC` e `STRIPE_PRICE_ID_PRO` → crea i piani su Stripe

### 3. Avvia in locale
```bash
npm run dev     # sviluppo con hot-reload
npm start       # produzione
```

---

## 🚀 Deploy su Render

Il repository include un Blueprint (`render.yaml`) già configurato.

1. Carica il progetto su GitHub (branch `main`)
2. Vai su [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
3. Seleziona il repository: Render legge `render.yaml` e crea il Web Service `gustoai`
4. Inserisci le variabili richieste (`OPENAI_API_KEY`, chiavi Stripe, `FRONTEND_URL`)
5. ✅ Online su `https://gustoai.onrender.com` (o il nome assegnato) con HTTPS

Note:
- `PORT` è impostata da Render automaticamente, non definirla.
- Se `FRONTEND_URL` non è impostata viene usata `RENDER_EXTERNAL_URL`.
- Health check: `GET /health` (mostra anche se OpenAI/Stripe sono configurati).
- Webhook Stripe: punta a `https://<tuo-servizio>.onrender.com/api/stripe/webhook`.
- Piano Free: il servizio va in sleep dopo 15 min di inattività (primo avvio lento) e i dati in memoria si perdono ad ogni riavvio.

---

## 🎨 Come funziona

### Per il ristoratore (cliente)
1. Si registra su GustoAI.app
2. Inserisce: nome ristorante, menù, orari, colori
3. Copia 1 riga di codice nel suo sito
4. Il chatbot è live!

### Per te (proprietario del SaaS)
- Ogni cliente paga €49–€99/mese su Stripe automaticamente
- Il backend gestisce tutte le chiamate AI
- La dashboard mostra statistiche e clienti

---

## 📁 Struttura Progetto

```
gustoai/
├── public/           # Frontend statico
│   ├── index.html    # Landing page
│   ├── styles.css    # CSS principale
│   ├── app.js        # JS frontend
│   ├── widget.js     # Widget embeddabile
│   └── widget.css    # CSS widget
├── src/
│   ├── server.js     # Entry point Express
│   └── routes/
│       ├── chat.js   # API chatbot AI
│       ├── widget.js # Script embed
│       ├── stripe.js # Pagamenti
│       └── dashboard.js
├── .env.example
├── package.json
├── render.yaml       # Blueprint deploy Render
└── railway.toml      # (legacy) config Railway
```

---

## 💰 Business Model

| Piano | Prezzo | Clienti target |
|-------|--------|----------------|
| Base | €49/mese | Ristoranti piccoli |
| Pro | €99/mese | Catene, locali grandi |

**Break-even**: ~21 clienti Piano Base = €1.029/mese

---

## 📣 Come Integrare il Widget

Ogni cliente incolla sul suo sito:
```html
<script src="https://gustoai.onrender.com/api/widget/BOT_ID/embed"></script>
```

---

## 🔧 Prossimi Step (Roadmap)

- [ ] Auth utenti con Supabase
- [ ] Dashboard cliente completa
- [ ] Integrazione WhatsApp Business API
- [ ] Analytics messaggi
- [ ] Multi-lingua (EN, ES, DE)
- [ ] App mobile React Native

---

## 📞 Supporto

Per configurazioni avanzate, apri un issue o contatta info@gustoai.app
