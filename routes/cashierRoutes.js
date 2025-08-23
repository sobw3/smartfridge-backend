const express = require('express');
const router = express.Router();
const cashierController = require('../controllers/cashierController');
const { protectAdmin } = require('../middleware/authMiddleware');

// Rotas protegidas para admin
router.get('/', protectAdmin, cashierController.getCashierSummary);
router.post('/withdraw', protectAdmin, cashierController.createWithdrawal);
router.get('/history', protectAdmin, cashierController.getWithdrawalHistory);

module.exports = router;
