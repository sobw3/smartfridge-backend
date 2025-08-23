// ===============================================================
// ARQUIVO: routes/walletRoutes.js
// ===============================================================
const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const { protect } = require('../middleware/authMiddleware'); // <-- ESTA LINHA ESTAVA FALTANDO

// Rota para obter o saldo da carteira (protegida)
router.get('/balance', protect, walletController.getWalletBalance);

// Rota para criar um pedido de depósito (protegida)
router.post('/deposit', protect, walletController.createDepositOrder);

router.get('/transactions', protect, walletController.getWalletTransactions);

router.post('/transfer', protect, walletController.transferBalance);

router.post('/verify-recipient', protect, walletController.verifyRecipient);

router.get('/transaction/:id', protect, walletController.getTransactionDetails);

router.post('/deposit-card', protect, walletController.depositWithCard);

module.exports = router;
