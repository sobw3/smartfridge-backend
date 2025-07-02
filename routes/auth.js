const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);
router.put('/update-condo', protect, authController.updateUserCondo);

// Rota para o utilizador atualizar os seus próprios dados
router.put('/me', protect, authController.updateMe);

module.exports = router;
