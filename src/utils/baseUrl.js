/**
 * Restituisce l'URL pubblico del servizio.
 * Priorità: FRONTEND_URL → RENDER_EXTERNAL_URL (impostata da Render) → host della richiesta → localhost
 */
function getBaseUrl(req) {
  const fromEnv = process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (req && req.get && req.get('host')) {
    return `${req.protocol}://${req.get('host')}`;
  }

  return `http://localhost:${process.env.PORT || 3000}`;
}

module.exports = { getBaseUrl };
