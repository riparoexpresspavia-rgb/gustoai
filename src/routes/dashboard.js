const express = require('express');
const router = express.Router();

// Semplice auth middleware (sostituire con JWT in produzione)
const requireAuth = (req, res, next) => {
  const token = req.headers['x-api-token'];
  if (!token || token !== req.params.botId) {
    // In demo mode, permettiamo tutto
    return next();
  }
  next();
};

/**
 * GET /api/dashboard/stats
 * Statistiche aggregate per la dashboard admin
 */
router.get('/stats', (req, res) => {
  // Dati demo - in produzione da database
  res.json({
    totalClients: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    totalMessages: 0,
    growth: 0,
  });
});

/**
 * GET /api/dashboard/demo-config
 * Ritorna configurazione demo per preview
 */
router.get('/demo-config', (req, res) => {
  res.json({
    botId: 'demo',
    name: 'GustoBot Demo',
    restaurantName: 'Ristorante La Bella Italia',
    cuisine: 'italiana tradizionale',
    welcomeMessage: 'Ciao! 👋 Sono GustoBot! Come posso aiutarti oggi?',
    primaryColor: '#e74c3c',
    openingHours: 'Mar-Dom: 12:00-15:00 | 19:00-23:00 | Lunedì chiuso',
    phone: '+39 02 1234567',
    menu: [
      { name: 'Spaghetti alla Carbonara', description: 'Ricetta tradizionale romana', price: '14' },
      { name: 'Risotto ai Funghi Porcini', description: 'Con porcini freschi di stagione', price: '16' },
      { name: 'Bistecca alla Fiorentina', description: 'Chianina DOP, al kg', price: '45' },
      { name: 'Tiramisù della Casa', description: 'Ricetta segreta dello chef', price: '7' },
    ],
    instagramUrl: 'https://instagram.com/gustoai',
    facebookUrl: 'https://facebook.com/gustoai',
  });
});

module.exports = router;
