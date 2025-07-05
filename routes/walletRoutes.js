// ===============================================================
// ARQUIVO: routes/walletRoutes.js
// ===============================================================
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware'); // Usamos o protetor de cliente

// Rota para obter o saldo da carteira (protegida)
router.get('/balance', protect, walletController.getWalletBalance);

// Rota para criar um pedido de depósito (protegida)
router.post('/deposit', protect, walletController.createDepositOrder);

module.exports = router;
