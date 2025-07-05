// ===============================================================
// ARQUIVO: routes/publicRoutes.js
// Define os endpoints públicos da aplicação.
// ===============================================================
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Rota para buscar todos os condomínios disponíveis para o cadastro
// GET /api/public/condominiums
router.get('/condominiums', publicController.getAvailableCondominiums);

module.exports = router;