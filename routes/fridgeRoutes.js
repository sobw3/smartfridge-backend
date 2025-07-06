const express = require('express');
const router = express.Router();
const fridgeController = require('../controllers/fridgeController');
const { protectFridge } = require('../middleware/authMiddleware');

// Rota que a geladeira irá chamar para verificar se há um token de desbloqueio
router.post('/check-unlock', protectFridge, fridgeController.checkUnlock);

module.exports = router;
