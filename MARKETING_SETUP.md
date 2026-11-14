# 📣 GustoAI — Setup Marketing, Email e Stripe

Guida rapida per attivare **pagamenti automatici** e **sequenza email di vendita**.
Tempo stimato: 30–45 minuti.

---

## 🔄 Come funziona il flusso

```
LEAD                                         CLIENTE
Form "Demo gratuita" (#richiedi-demo)        Bottone "Inizia gratis 14 giorni"
        │                                            │
POST /api/leads                              POST /api/stripe/checkout
        │                                            │
Resend: Email 1 subito                       Stripe Checkout (carta, prova 14 gg)
        Email 2 dopo 2 giorni (programmata)          │
        Email 3 dopo 5 giorni (programmata)  Webhook checkout.session.completed
        │                                            │
Link disiscrizione → annulla email 2-3       ✅ Account attivo → widget acceso
                                             ✉️ Email di benvenuto con lo snippet
                                             🛑 Stop sequenza vendita (se era un lead)
                                             📄 Pagina /welcome con codice + portale abbonamento

Disdetta / mancato pagamento → webhook customer.subscription.* → widget spento
```

- Le email 2 e 3 sono **programmate su Resend** (`scheduled_at`): partono anche se Render è in sleep.
- Lo **stato dell'abbonamento Stripe** decide se il widget risponde: `trialing`, `active`, `past_due` = acceso; `canceled`, `unpaid`, `incomplete_expired`, `paused` = spento.
- Se i dati locali si azzerano (riavvio Render), l'account viene **ricostruito da Stripe** al primo messaggio.

---

## 1️⃣ Stripe (15 minuti)

> Fai tutto prima in **modalità Test** (interruttore in alto a destra), poi ripeti in **Live**.

1. **Crea i prodotti** → Dashboard Stripe → *Product catalog* → *+ Add product*
   - `GustoAI Piano Base` → prezzo **ricorrente**, €49,00, mensile
   - `GustoAI Piano Pro` → prezzo **ricorrente**, €99,00, mensile
   - Apri ogni prodotto e copia il **Price ID** (`price_...`) → `STRIPE_PRICE_ID_BASIC` / `STRIPE_PRICE_ID_PRO`
2. **Chiave segreta** → *Developers → API keys* → copia la **Secret key** (`sk_test_...` / `sk_live_...`) → `STRIPE_SECRET_KEY`
3. **Webhook** → *Developers → Webhooks → + Add endpoint*
   - URL: `https://<tuo-servizio>.onrender.com/api/stripe/webhook`
   - Eventi da selezionare:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
   - Copia il **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`
4. **Customer Portal** (per il bottone "Gestisci abbonamento") → *Settings → Billing → Customer portal* → **Activate** e abilita *Cancel subscriptions* e *Update payment methods*.
5. **Email automatiche Stripe** (consigliato) → *Settings → Billing → Subscriptions and emails*: attiva le ricevute e il promemoria di fine prova.
6. **Test**: dal sito clicca "Inizia gratis 14 giorni", paga con la carta `4242 4242 4242 4242`, data futura qualsiasi, CVC `123`.
   Devi arrivare su `/welcome` con lo snippet e ricevere l'email di benvenuto. In *Webhooks* l'evento deve risultare `200 OK`.

---

## 2️⃣ Resend — invio email (15 minuti)

1. Crea un account su [resend.com](https://resend.com) (piano gratuito: 3.000 email/mese, 100/giorno).
2. **Domini → Add Domain** → inserisci il tuo dominio (es. `gustoai.it`) e aggiungi i record **DNS** (SPF, DKIM, MX) che Resend ti mostra, nel pannello del tuo registrar. Attendi lo stato **Verified**.
   > Senza dominio verificato puoi inviare solo al tuo indirizzo, usando `onboarding@resend.dev` come mittente (solo per test).
3. **API Keys → Create API Key** (permesso *Sending access*) → `RESEND_API_KEY` (`re_...`)
4. Imposta:
   - `EMAIL_FROM` → `GustoAI <ciao@tuodominio.it>` (indirizzo sul dominio verificato)
   - `EMAIL_REPLY_TO` → la casella che leggi davvero (le email invitano a rispondere!)
   - `ADMIN_EMAIL` → dove ricevere le notifiche di nuovi lead/clienti
5. **Test**: compila il form "Demo gratuita" sul sito con la tua email. In Resend → *Emails* vedrai l'email 1 **Delivered** e le email 2 e 3 **Scheduled**.

> 💡 **Brevo** al posto di Resend? Va sostituito solo `src/services/email.js` (stessa interfaccia `sendEmail` / `cancelScheduledEmail`). Resend è stato scelto perché supporta l'invio programmato via API senza cron.

---

## 3️⃣ Variabili su Render

*Render → servizio gustoai → Environment* → aggiungi le variabili elencate in fondo al README/risposta, poi **Save, rebuild and deploy**.

Verifica su `https://<tuo-servizio>.onrender.com/health`: tutti i campi devono essere `true`:
```json
{ "status":"ok", "openai":true, "stripe":true, "stripeWebhook":true, "stripePrices":true, "email":true }
```

---

## 4️⃣ Personalizzare il bot di un nuovo cliente

Dopo il pagamento ricevi la notifica con il `BotId`. Quando il ristoratore ti risponde con menù e orari:

```bash
curl -X POST https://<tuo-servizio>.onrender.com/api/chat/config/<BOT_ID> \
  -H "Content-Type: application/json" \
  -H "x-admin-token: <ADMIN_TOKEN>" \
  -d '{"restaurantName":"Trattoria Da Mario","openingHours":"Mar-Dom 12-15 / 19-23","phone":"+39 06 1234567","reservationLink":"https://...","primaryColor":"#2e7d32","menu":[{"name":"Cacio e pepe","description":"Tonnarelli freschi","price":"12"}]}'
```

`ADMIN_TOKEN` lo trovi in *Render → Environment* (generato automaticamente da `render.yaml`).

---

## ⚖️ Note legali (GDPR / anti-spam)

- Il form richiede un **consenso esplicito** (checkbox) e salva data/ora del consenso.
- Ogni email di vendita ha il **link di disiscrizione** + header `List-Unsubscribe` one-click (richiesto da Gmail/Yahoo).
- Aggiungi **Privacy Policy** e **Termini** reali (i link nel footer sono ancora `#`) indicando Resend e Stripe come responsabili del trattamento.

---

## ✉️ Testi completi della sequenza (3 email)

> I testi sono in `src/services/emailTemplates.js` (versione HTML + testo). Se li modifichi lì, aggiorna anche qui.
> `{nome}` = primo nome del lead · `{ristorante}` = nome del locale (o "il tuo ristorante").
> Ogni email include in fondo il link di disiscrizione.

### Email 1 — inviata subito
**Oggetto:** La tua demo di GustoAI è pronta 🍽️
**Anteprima:** Prova il chatbot che risponde ai tuoi clienti anche quando sei chiuso.

> Ciao {nome},
>
> grazie per aver richiesto la demo di **GustoAI**! Ecco il link per provare subito l'assistente AI così come lo vedrebbero i clienti di {ristorante}:
>
> **[Prova la demo live →]** (link: sito `#demo`)
>
> Fagli qualche domanda come farebbe un cliente:
> - "Siete aperti domenica sera?"
> - "Avete piatti senza glutine?"
> - "Vorrei prenotare per 4 persone sabato"
>
> Il tuo GustoBot risponderà così, ma con **il tuo menù, i tuoi orari e i colori del tuo locale**. Si installa con una riga di codice su qualsiasi sito (WordPress, Wix, Squarespace…) e, se preferisci, lo installiamo noi gratis.
>
> Hai 14 giorni di prova gratuita per vederlo all'opera sul tuo sito.
>
> A presto,
> Il team GustoAI
>
> P.S. Rispondi pure a questa email per qualsiasi domanda: ti risponde una persona vera.

### Email 2 — dopo 2 giorni
**Oggetto:** Quanti clienti perdi quando non puoi rispondere?
**Anteprima:** Basta un tavolo in più al mese per ripagare GustoAI.

> Ciao {nome},
>
> una domanda veloce: cosa succede quando un cliente scrive al tuo ristorante alle 23:30, o durante il servizio del sabato sera, quando nessuno ha tempo di rispondere?
>
> Spesso… **prenota altrove**. Non perché il tuo locale non gli piaccia, ma perché qualcun altro ha risposto prima.
>
> GustoAI risolve esattamente questo:
> - ⏱️ **Risponde in pochi secondi**, 24 ore su 24, anche a locale chiuso
> - 📅 **Porta il cliente alla prenotazione** (link, telefono o WhatsApp)
> - 🍝 **Conosce il tuo menù**: prezzi, specialità, opzioni vegane e senza glutine
> - 🙌 **Toglie al tuo staff** le solite domande su orari, parcheggio e menù
>
> Facciamo due conti: con il Piano Base a €49/mese, **basta un tavolo da 2–3 persone in più al mese** per ripagare l'abbonamento. Tutto il resto è guadagno.
>
> **[Attiva la prova gratuita di 14 giorni →]** (link: sito `#pricing`)
>
> Nessun vincolo: disdici quando vuoi, con un clic.
>
> Buon servizio,
> Il team GustoAI

### Email 3 — dopo 5 giorni
**Oggetto:** {nome}, te lo installiamo noi (gratis)
**Anteprima:** Le 3 domande che ci fanno tutti i ristoratori, con le risposte.

> Ciao {nome},
>
> è l'ultima email che ti mando su questo argomento, promesso. Prima però voglio rispondere alle 3 domande che ci fanno quasi tutti i ristoratori:
>
> **1. "Non sono pratico di tecnologia."**
> Non serve. Ci mandi menù e orari, configuriamo noi il tuo GustoBot e lo installiamo sul tuo sito. Tu non tocchi niente.
>
> **2. "E se il bot dice qualcosa di sbagliato?"**
> GustoBot risponde solo usando le informazioni del tuo locale. Se non sa qualcosa, invita il cliente a chiamarti: non inventa piatti né prezzi.
>
> **3. "E se non mi trovo bene?"**
> Hai 14 giorni gratis per provarlo. Se non fa per te, disdici con un clic prima della fine della prova e non paghi nulla.
>
> **[Inizia la prova gratuita →]** (link: sito `#pricing`)
>
> Oppure **rispondi semplicemente "SÌ" a questa email**: ti ricontattiamo noi e in 24 ore il tuo assistente è online su {ristorante}.
>
> Grazie per il tuo tempo,
> Il team GustoAI

### Email di benvenuto (dopo il pagamento, automatica)
**Oggetto:** ✅ Il chatbot di {ristorante} è attivo
Contiene: piano scelto, data di fine prova, **snippet `<script>` da incollare**, link alla pagina `/welcome` (copia codice + gestione abbonamento) e la richiesta di inviare menù/orari.

---

## 🚀 Come portare traffico al form (idee a costo zero)

- Link in bio Instagram/Facebook → `https://<tuo-sito>/?utm_source=instagram#richiedi-demo`
  (il parametro `utm_source` viene salvato come **fonte del lead**)
- Messaggi diretti a ristoranti su Google Maps senza sito o con recensioni che lamentano "non rispondono mai"
- Gruppi Facebook di ristoratori, associazioni di categoria locali
- Volantino QR code da lasciare nei locali → stesso link con `utm_source=volantino`

