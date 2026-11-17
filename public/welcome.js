// ══════════════════════════════════════════════════════════════
// GustoAI — Pagina post-pagamento (/welcome?session_id=cs_...)
// ══════════════════════════════════════════════════════════════
(function () {
  const box = document.getElementById('welcomeBox');
  const sessionId = new URLSearchParams(window.location.search).get('session_id');

  const STATUS_LABELS = {
    trialing: '✅ Prova gratuita attiva',
    active: '✅ Abbonamento attivo',
    past_due: '⚠️ Pagamento in sospeso',
    canceled: '❌ Abbonamento cancellato',
    unpaid: '❌ Abbonamento non pagato',
    incomplete: '⏳ In attesa di conferma',
  };

  function render(tplId) {
    box.innerHTML = '';
    box.appendChild(document.getElementById(tplId).content.cloneNode(true));
  }

  function field(name) {
    return box.querySelector(`[data-field="${name}"]`);
  }

  function showError(message) {
    render('tplError');
    field('message').textContent = message;
    box.querySelector('[data-action="retry"]').addEventListener('click', () => window.location.reload());
  }

  function showSuccess(data) {
    render('tplSuccess');

    const status = field('status');
    status.textContent = STATUS_LABELS[data.status] || data.status;
    if (!data.active) status.classList.add('inactive');

    field('restaurantName').textContent = data.restaurantName || 'Il tuo ristorante';
    field('planName').textContent = data.planName;
    field('trial').textContent = data.trialEnd
      ? ` · prova gratuita fino al ${new Date(data.trialEnd).toLocaleDateString('it-IT')}`
      : '';
    field('embedCode').textContent = data.embedCode;

    // Pulsante Dashboard
    const dashBtn = box.querySelector('[data-action="dashboard"]');
    if (dashBtn) {
      if (data.dashboardUrl) {
        dashBtn.href = data.dashboardUrl;
        dashBtn.removeAttribute('data-action'); // comportamento link normale
      } else {
        dashBtn.style.display = 'none';
      }
    }

    box.querySelector('[data-action="copy"]').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(data.embedCode);
        e.target.textContent = '✓ Copiato!';
      } catch {
        // Fallback: seleziona il testo per la copia manuale
        const range = document.createRange();
        range.selectNodeContents(field('embedCode'));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        e.target.textContent = 'Premi Ctrl+C per copiare';
      }
      setTimeout(() => { e.target.textContent = '📋 Copia codice'; }, 2500);
    });

    box.querySelector('[data-action="portal"]').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Apertura…';
      try {
        const resp = await fetch('/api/stripe/portal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json.url) {
          window.location.href = json.url;
          return;
        }
        field('feedback').textContent = json.error || 'Area abbonamento non disponibile.';
        field('feedback').className = 'lead-feedback error';
      } catch {
        field('feedback').textContent = 'Errore di connessione. Riprova.';
        field('feedback').className = 'lead-feedback error';
      }
      btn.disabled = false;
      btn.textContent = '⚙️ Gestisci abbonamento';
    });
  }

  async function load(attempt = 1) {
    if (!sessionId) {
      showError('Link non valido: manca l\'identificativo della sessione di pagamento.');
      return;
    }
    try {
      const resp = await fetch(`/api/stripe/session/${encodeURIComponent(sessionId)}`);
      const data = await resp.json().catch(() => ({}));

      if (resp.ok) return showSuccess(data);

      // 402 = Stripe non ha ancora confermato: riprova qualche volta
      if (resp.status === 402 && attempt < 5) {
        setTimeout(() => load(attempt + 1), 2000);
        return;
      }
      showError(data.error || 'Errore imprevisto.');
    } catch {
      if (attempt < 3) {
        // Render free può impiegare qualche secondo a "svegliarsi"
        setTimeout(() => load(attempt + 1), 3000);
        return;
      }
      showError('Il server non risponde. Riprova tra qualche secondo.');
    }
  }

  load();
})();
