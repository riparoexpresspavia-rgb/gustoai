const express = require('express');
const router = express.Router();

/**
 * GET /api/widget/:botId/embed
 * Ritorna lo script JavaScript del widget da embeddare
 */
router.get('/:botId/embed', (req, res) => {
  const { botId } = req.params;
  const baseUrl = process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`;

  const script = `
(function() {
  var GUSTO_BOT_ID = '${botId}';
  var GUSTO_API_URL = '${baseUrl}';
  
  // Carica il widget CSS
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GUSTO_API_URL + '/widget.css';
  document.head.appendChild(link);
  
  // Carica il widget JS
  var script = document.createElement('script');
  script.src = GUSTO_API_URL + '/widget.js';
  script.setAttribute('data-bot-id', GUSTO_BOT_ID);
  script.setAttribute('data-api-url', GUSTO_API_URL);
  script.defer = true;
  document.body.appendChild(script);
})();
`;

  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(script);
});

module.exports = router;
