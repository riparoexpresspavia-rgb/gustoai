/**
 * GustoAI Widget — Embeddable Chatbot
 * Incolla questo nel tuo sito:
 * <script src="https://gustoai.up.railway.app/api/widget/IL-TUO-BOT-ID/embed"></script>
 */
(function (window, document) {
  'use strict';

  const BOT_ID  = document.currentScript?.getAttribute('data-bot-id') || 'demo';
  const API_URL = document.currentScript?.getAttribute('data-api-url') || 'https://gustoai.up.railway.app';

  let config = {
    name: 'GustoBot',
    restaurantName: 'Il Ristorante',
    welcomeMessage: 'Ciao! 👋 Come posso aiutarti?',
    primaryColor: '#e74c3c',
    openingHours: '',
    instagramUrl: '',
    reservationLink: '',
  };

  let conversationHistory = [];
  let isOpen = false;

  // ── Fetch bot config ───────────────────────────────────────────
  async function loadConfig() {
    try {
      const resp = await fetch(`${API_URL}/api/chat/config/${BOT_ID}`);
      if (resp.ok) Object.assign(config, await resp.json());
    } catch (_) { /* usa default */ }
  }

  // ── Build & inject widget HTML ─────────────────────────────────
  function injectWidget() {
    const c = config.primaryColor;

    const container = document.createElement('div');
    container.className = 'gustoai-widget-container';
    container.id = 'gustoai-root';

    container.innerHTML = `
      <div class="gustoai-window" id="gustoai-window" style="display:none;">
        <div class="gustoai-header" style="background:${c}">
          <div class="gustoai-avatar">🍽️</div>
          <div>
            <div class="gustoai-bot-name">${config.name}</div>
            <div class="gustoai-status">● Online ora</div>
          </div>
          <button class="gustoai-close" onclick="GustoAI.close()" title="Chiudi">✕</button>
        </div>
        <div class="gustoai-messages" id="gustoai-messages"></div>
        <div class="gustoai-quick" id="gustoai-quick">
          <button onclick="GustoAI.quickSend('🍽️ Vedi il menù')" style="color:${c};border-color:${c}20">🍽️ Menù</button>
          <button onclick="GustoAI.quickSend('📅 Voglio prenotare')" style="color:${c};border-color:${c}20">📅 Prenota</button>
          <button onclick="GustoAI.quickSend('🕐 Orari di apertura')" style="color:${c};border-color:${c}20">🕐 Orari</button>
        </div>
        <div class="gustoai-input-row">
          <input class="gustoai-input" id="gustoai-input" type="text"
            placeholder="Scrivi un messaggio..."
            onkeydown="if(event.key==='Enter')GustoAI.send()" />
          <button class="gustoai-send" style="background:${c}" onclick="GustoAI.send()">➤</button>
        </div>
        <div class="gustoai-branding">
          Powered by <a href="https://gustoai.app" target="_blank">GustoAI</a>
        </div>
      </div>
      <button class="gustoai-bubble" id="gustoai-bubble"
        onclick="GustoAI.toggle()" style="background:${c}"
        title="Chatta con noi">
        💬
        <div class="gustoai-badge" id="gustoai-badge">1</div>
      </button>
    `;

    document.body.appendChild(container);

    // Mostra messaggio di benvenuto dopo 1 secondo
    setTimeout(() => addMessage('bot', config.welcomeMessage), 1000);
  }

  // ── Message helpers ────────────────────────────────────────────
  function addMessage(role, text) {
    const box = document.getElementById('gustoai-messages');
    if (!box) return;

    const div = document.createElement('div');
    div.className = `gustoai-msg ${role}`;
    if (role === 'user') div.style.background = config.primaryColor;
    div.innerHTML = sanitize(text);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;

    conversationHistory.push({ role, content: text });
  }

  function showTyping() {
    const box = document.getElementById('gustoai-messages');
    const div = document.createElement('div');
    div.className = 'gustoai-msg bot gustoai-typing';
    div.id = 'gustoai-typing';
    div.textContent = '...';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function removeTyping() {
    const t = document.getElementById('gustoai-typing');
    if (t) t.remove();
  }

  function updateQuickReplies(replies) {
    const qr = document.getElementById('gustoai-quick');
    if (!qr || !replies?.length) return;
    qr.innerHTML = replies.map(r =>
      `<button onclick="GustoAI.quickSend('${r}')" 
        style="color:${config.primaryColor};border-color:${config.primaryColor}20">
        ${sanitize(r)}
      </button>`
    ).join('');
  }

  function sanitize(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  // ── Send message to API ────────────────────────────────────────
  async function sendMessage(text) {
    if (!text?.trim()) return;

    addMessage('user', text);

    const input = document.getElementById('gustoai-input');
    if (input) input.value = '';

    showTyping();

    try {
      const resp = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          botId: BOT_ID,
          conversationHistory: conversationHistory.slice(-8),
        }),
      });

      const data = await resp.json();
      removeTyping();

      if (data.reply) {
        addMessage('bot', data.reply);
        if (data.quickReplies?.length) updateQuickReplies(data.quickReplies);
      } else {
        addMessage('bot', 'Mi dispiace, si è verificato un errore. Riprova!');
      }
    } catch (err) {
      removeTyping();
      addMessage('bot', '⚠️ Connessione persa. Riprova tra un momento.');
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  window.GustoAI = {
    open() {
      const w = document.getElementById('gustoai-window');
      const b = document.getElementById('gustoai-badge');
      if (w) { w.style.display = 'block'; isOpen = true; }
      if (b) b.style.display = 'none';
    },
    close() {
      const w = document.getElementById('gustoai-window');
      if (w) { w.style.display = 'none'; isOpen = false; }
    },
    toggle() {
      isOpen ? this.close() : this.open();
    },
    send() {
      const input = document.getElementById('gustoai-input');
      if (input?.value.trim()) sendMessage(input.value.trim());
    },
    quickSend(text) {
      sendMessage(text);
    },
  };

  // ── Init ───────────────────────────────────────────────────────
  async function init() {
    await loadConfig();
    injectWidget();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
