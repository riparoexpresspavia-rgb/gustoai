// ══════════════════════════════════════════════════════════════
// GustoAI — Frontend App JS
// ══════════════════════════════════════════════════════════════

const API_URL = '';  // stesso dominio
let selectedPlan = 'basic';

// ── Navbar scroll effect ──────────────────────────────────────
window.addEventListener('scroll', () => {
  document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 10);
});

// ── Mobile menu ───────────────────────────────────────────────
function toggleMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
}

// ── FAQ accordion ─────────────────────────────────────────────
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const icon   = btn.querySelector('span');
  const isOpen = answer.classList.contains('open');

  // Chiudi tutti gli altri
  document.querySelectorAll('.faq-a.open').forEach(el => {
    el.classList.remove('open');
    el.previousElementSibling.querySelector('span').textContent = '+';
  });

  if (!isOpen) {
    answer.classList.add('open');
    icon.textContent = '−';
  }
}

// ── Checkout flow ─────────────────────────────────────────────
function startCheckout(plan) {
  selectedPlan = plan;
  const names = { basic: 'Piano Base — €49/mese', pro: 'Piano Pro — €99/mese' };
  document.getElementById('selectedPlanName').textContent = names[plan] || plan;
  document.getElementById('checkoutModal').classList.add('open');
}

function closeModal() {
  document.getElementById('checkoutModal').classList.remove('open');
}

async function submitCheckout(e) {
  e.preventDefault();
  const btn = document.getElementById('checkoutSubmitBtn');
  const restaurantName = document.getElementById('restaurantName').value;
  const email = document.getElementById('userEmail').value;

  btn.textContent = 'Reindirizzamento...';
  btn.disabled = true;

  try {
    const resp = await fetch(`${API_URL}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: selectedPlan, restaurantName, email }),
    });

    const data = await resp.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      // Stripe non configurato: mostra messaggio
      alert('✅ Grazie! Ti contatteremo a breve per completare la registrazione.\n\nEmail ricevuta: ' + email);
      closeModal();
    }
  } catch (err) {
    alert('Errore di connessione. Riprova o contattaci via email.');
    btn.textContent = 'Continua al pagamento →';
    btn.disabled = false;
  }
}

// ── Widget demo (nella hero) ──────────────────────────────────
function openWidgetDemo() {
  document.getElementById('widgetWindow').style.display = 'block';
  document.getElementById('widgetBubble').querySelector('.widget-notification').style.display = 'none';
}

function closeWidgetDemo() {
  document.getElementById('widgetWindow').style.display = 'none';
}

async function sendMessage() {
  const input = document.getElementById('widgetInput');
  const text = input?.value.trim();
  if (!text) return;
  input.value = '';
  appendWidgetMsg('user', text);
  appendWidgetMsg('bot', '...');
  try {
    const r = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, botId: 'demo', conversationHistory: [] }),
    });
    const d = await r.json();
    removeLastBot();
    appendWidgetMsg('bot', d.reply || 'Scusa, riprova!');
    if (d.quickReplies) updateWidgetQR(d.quickReplies);
  } catch {
    removeLastBot();
    appendWidgetMsg('bot', 'Servizio non disponibile in demo statica.');
  }
}

function sendQuick(text) {
  document.getElementById('widgetInput').value = text;
  sendMessage();
}

function appendWidgetMsg(role, text) {
  const box = document.getElementById('widgetMessages');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const span = document.createElement('span');
  span.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  div.appendChild(span);
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeLastBot() {
  const box = document.getElementById('widgetMessages');
  const bots = box.querySelectorAll('.msg.bot');
  if (bots.length) bots[bots.length - 1].remove();
}

function updateWidgetQR(replies) {
  const qr = document.getElementById('quickReplies');
  if (!qr || !replies?.length) return;
  qr.innerHTML = replies.map(r =>
    `<button onclick="sendQuick('${r.replace(/'/g,"\\'")}')">` + r + `</button>`
  ).join('');
}

// ── Demo Section Chat ─────────────────────────────────────────
const DEMO_RESPONSES = {
  default: [
    "Ottima domanda! 😊 Posso dirti tutto sul nostro menù, gli orari e le prenotazioni. Cosa ti interessa di più?",
    "Sono qui per aiutarti! Vuoi sapere del menù, prenotare un tavolo o hai altre domande? 🍽️",
  ],
  menu: [
    "🍝 I nostri piatti del momento:\n**Carbonara della Casa** — €14\n**Risotto ai Porcini** — €16\n**Bistecca Fiorentina** — €45/kg\n**Tiramisù Artigianale** — €7\n\nVuoi saperne di più su qualche piatto?",
  ],
  prenota: [
    "📅 Perfetto! Per prenotare puoi:\n1. Chiamarci al **+39 02 1234567**\n2. Scriverci su WhatsApp\n3. Usare il form sul sito\n\nQuante persone siete e per quando?",
  ],
  orari: [
    "🕐 Siamo aperti:\n**Martedì – Domenica**\nPranzo: 12:00 – 15:00\nCena: 19:00 – 23:00\n\nIl **lunedì siamo chiusi**. Vuoi prenotare? 😊",
  ],
  vegano: [
    "🌿 Certo! Abbiamo diverse opzioni vegane e vegetariane. Faccelo sapere quando prenoti e lo chef preparerà qualcosa di speciale! Hai altre allergie o intolleranze?",
  ],
};

let demoHistory = [];

async function demoSend(textOrEvent) {
  const input = document.getElementById('demoInput');
  const text = typeof textOrEvent === 'string' ? textOrEvent : input?.value.trim();
  if (!text) return;
  if (input) input.value = '';

  appendDemoMsg('user', text);

  // Mostra typing
  appendDemoMsg('typing', '...');

  // Prova a chiamare l'API reale, fallback su risposte demo
  try {
    const resp = await fetch(`${API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, botId: 'demo', conversationHistory: demoHistory.slice(-6) }),
    });
    const data = await resp.json();
    removeTypingDemo();
    if (data.reply) {
      appendDemoMsg('bot', data.reply);
      demoHistory.push({ role: 'user', content: text });
      demoHistory.push({ role: 'bot', content: data.reply });
    } else {
      appendDemoMsg('bot', getLocalResponse(text));
    }
  } catch {
    // Risposte locali se non c'è server
    await new Promise(r => setTimeout(r, 900));
    removeTypingDemo();
    appendDemoMsg('bot', getLocalResponse(text));
  }
}

function getLocalResponse(text) {
  const t = text.toLowerCase();
  if (t.includes('menù') || t.includes('menu') || t.includes('piatt') || t.includes('mangia')) return DEMO_RESPONSES.menu[0];
  if (t.includes('prenot') || t.includes('tavol') || t.includes('posto')) return DEMO_RESPONSES.prenota[0];
  if (t.includes('orari') || t.includes('aperto') || t.includes('domenica') || t.includes('chiuso')) return DEMO_RESPONSES.orari[0];
  if (t.includes('vegan') || t.includes('vegetar') || t.includes('allergi')) return DEMO_RESPONSES.vegano[0];
  const defaults = DEMO_RESPONSES.default;
  return defaults[Math.floor(Math.random() * defaults.length)];
}

function appendDemoMsg(role, text) {
  const box = document.getElementById('demoMessages');
  const div = document.createElement('div');
  div.className = role === 'typing' ? 'demo-msg bot demo-msg-typing' : `demo-msg ${role}`;
  if (role === 'typing') div.id = 'demo-typing';
  div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function removeTypingDemo() {
  document.getElementById('demo-typing')?.remove();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Chiudi modal con ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // Smooth scroll per links interni
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});
