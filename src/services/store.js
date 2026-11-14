/**
 * Store JSON minimale su file (nessuna dipendenza esterna).
 *
 * Collezioni: accounts (per botId), leads (per email), botConfigs (per botId).
 *
 * ⚠️ Su Render il filesystem è effimero: senza Persistent Disk i dati si
 * azzerano ad ogni deploy/riavvio. Imposta DATA_DIR sul mount del disco
 * (es. /var/data). Gli account attivi vengono comunque ricostruiti da Stripe
 * (vedi services/accounts.js) e le email programmate restano su Resend.
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const EMPTY_DB = { accounts: {}, leads: {}, botConfigs: {} };

let db = null;

function load() {
  if (db) return db;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    db = { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Store: db.json illeggibile, riparto vuoto:', e.message);
    db = JSON.parse(JSON.stringify(EMPTY_DB));
  }
  return db;
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE); // scrittura atomica
  } catch (e) {
    console.error('Store: errore salvataggio:', e.message);
  }
}

function get(collection, key) {
  return load()[collection][key] || null;
}

function set(collection, key, value) {
  load()[collection][key] = value;
  save();
  return value;
}

function update(collection, key, patch) {
  const current = get(collection, key) || {};
  return set(collection, key, { ...current, ...patch, updatedAt: new Date().toISOString() });
}

function find(collection, predicate) {
  return Object.values(load()[collection]).find(predicate) || null;
}

function all(collection) {
  return Object.values(load()[collection]);
}

module.exports = { get, set, update, find, all, DATA_DIR };
