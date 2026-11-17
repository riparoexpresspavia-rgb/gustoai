// ============================================================
// GustoAI -- Dashboard Cliente (/dashboard?botId=...&token=...)
// ============================================================
(function () {
  'use strict';

  const params  = new URLSearchParams(window.location.search);
  const botId   = params.get('botId');
  const token   = params.get('token');

  const elLoading   = document.getElementById('dbLoading');
  const elError     = document.getElementById('dbError');
  const elErrorMsg  = document.getElementById('dbErrorMsg');
  const elMain      = document.getElementById('dbMain');
  const elForm      = document.getElementById('dbForm');
  const elSaveBar   = document.getElementById('dbSaveBar');
  const elSaveBtn   = document.getElementById('dbSaveBtn');
  const elSubmitBtn = document.getElementById('dbSubmitBtn');
  const elFeedback  = document.getElementById('dbFeedback');
  const elStatus    = document.getElementById('dbStatus');
  const elPlanBadge = document.getElementById('dbPlanBadge');
  const elEmail     = document.getElementById('dbEmail');
  const elPortal    = document.getElementById('dbPortalLink');
  const elColorPick = document.getElementById('f_primaryColor');
  const elColorText = document.getElementById('f_primaryColorText');
  const elColorPrev = document.getElementById('dbColorPreview');

  let isDirty = false;

  function show(el) { el.style.display = ''; }
  function hide(el) { el.style.display = 'none'; }

  function showError(msg) {
    hide(elLoading);
    if (elErrorMsg) elErrorMsg.textContent = msg || 'Errore sconosciuto.';
    show(elError);
  }

  function showFeedback(msg, type) {
    elFeedback.textContent = msg;
    elFeedback.className = 'db-feedback ' + type;
    if (type === 'success') setTimeout(function() { elFeedback.className = 'db-feedback'; }, 5000);
  }

  function getFieldValue(name) {
    var el = elForm.elements[name];
    return el ? el.value.trim() : undefined;
  }

  function setFieldValue(name, value) {
    var el = elForm.elements[name];
    if (el) el.value = (value == null) ? '' : value;
  }
  // -- Color picker --
  function syncColor(hex) {
    var val = (hex && /^#[0-9a-fA-F]{6}$/.test(hex)) ? hex : '#e74c3c';
    if (elColorPick) elColorPick.value = val;
    if (elColorText) elColorText.value = val;
    if (elColorPrev) elColorPrev.style.background = val;
  }

  if (elColorPick) {
    elColorPick.addEventListener('input', function() { syncColor(elColorPick.value); markDirty(); });
  }
  if (elColorText) {
    elColorText.addEventListener('input', function() {
      var v = elColorText.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) syncColor(v);
      markDirty();
    });
  }

  // -- Dirty tracking --
  function markDirty() {
    if (!isDirty) { isDirty = true; show(elSaveBar); }
  }
  function markClean() {
    isDirty = false; hide(elSaveBar);
  }
  if (elForm) {
    elForm.addEventListener('input', markDirty);
    elForm.addEventListener('change', markDirty);
  }
  window.addEventListener('beforeunload', function(e) {
    if (isDirty) { e.preventDefault(); e.returnValue = ''; }
  });

  var TEXT_FIELDS = [
    'restaurantName','phone','address','cuisine',
    'openingHours','closingDays',
    'menuText','allergens',
    'reservationLink',
    'welcomeMessage','customInstructions',
    'instagramUrl','facebookUrl'
  ];

  function populateForm(config) {
    TEXT_FIELDS.forEach(function(name) {
      setFieldValue(name, config[name] || '');
    });
    syncColor(config.primaryColor || '#e74c3c');
    markClean();
  }

  function collectFormData() {
    var data = {};
    TEXT_FIELDS.forEach(function(name) {
      data[name] = getFieldValue(name) || '';
    });
    var hex = elColorPick ? elColorPick.value : '#e74c3c';
    data.primaryColor = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#e74c3c';
    return data;
  }
  // -- Carica config --
  async function loadConfig() {
    if (!botId || !token) {
      showError('Link non valido: manca il botId o il token di accesso.');
      return;
    }
    try {
      var resp = await fetch(
        '/api/dashboard/' + encodeURIComponent(botId) + '/config?token=' + encodeURIComponent(token)
      );
      var json = await resp.json().catch(function() { return {}; });
      if (!resp.ok) {
        showError(json.error || 'Errore ' + resp.status + ': accesso non consentito.');
        return;
      }
      var cfg = json.config || {};

      if (elEmail)     elEmail.textContent    = cfg.email || '';
      if (elPlanBadge) elPlanBadge.textContent = cfg.plan === 'pro' ? 'Piano Pro' : 'Piano Base';

      if (elStatus) {
        var STATUS_MAP = {
          trialing:   ['Prova gratuita attiva', ''],
          active:     ['Abbonamento attivo', ''],
          past_due:   ['Pagamento in sospeso', 'warning'],
          canceled:   ['Abbonamento cancellato', 'danger'],
          unpaid:     ['Non pagato', 'danger'],
          incomplete: ['In attesa', 'warning']
        };
        var info = STATUS_MAP[cfg.status] || [cfg.status || '', ''];
        elStatus.textContent = info[0];
        elStatus.className = ('db-status-pill ' + info[1]).trim();
        if (cfg.trialEnd) {
          elStatus.textContent += ' fino al ' + new Date(cfg.trialEnd).toLocaleDateString('it-IT');
        }
      }

      populateForm(cfg);
      hide(elLoading);
      show(elMain);
    } catch (err) {
      showError('Errore di connessione. Riprova tra qualche secondo.');
    }
  }

  // -- Salva config --
  async function saveConfig(e) {
    if (e) e.preventDefault();
    var data = collectFormData();
    if (!data.restaurantName) {
      showFeedback('Il nome del ristorante e obbligatorio.', 'error');
      return;
    }
    var saveBtn = elSubmitBtn;
    var origText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Salvataggio...'; }
    try {
      var resp = await fetch(
        '/api/dashboard/' + encodeURIComponent(botId) + '/config',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.assign({}, data, { token: token }))
        }
      );
      var json = await resp.json().catch(function() { return {}; });
      if (resp.ok) {
        markClean();
        showFeedback('Modifiche salvate! Il bot e gia aggiornato.', 'success');
      } else {
        showFeedback(json.error || 'Errore nel salvataggio. Riprova.', 'error');
      }
    } catch (err) {
      showFeedback('Errore di connessione. Riprova.', 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText; }
    }
  }

  if (elSaveBtn)   elSaveBtn.addEventListener('click', saveConfig);
  if (elForm)      elForm.addEventListener('submit', saveConfig);

  loadConfig();

})();