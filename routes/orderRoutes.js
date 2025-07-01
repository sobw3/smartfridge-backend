const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create-pix', orderController.createOrder);
router.post('/create-card', protect, orderController.createCardOrder);
router.post('/:orderId/simulate-payment', orderController.simulatePaymentApproval);
router.get('/:orderId/status', protect, orderController.getOrderStatus);

module.exports = router;
