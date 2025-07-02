const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

// A correção está aqui: era createOrder, agora é createPixOrder
router.post('/create-pix', orderController.createPixOrder); 

router.post('/create-card', protect, orderController.createCardOrder);
router.post('/:orderId/simulate-payment', orderController.simulatePaymentApproval);
router.get('/:orderId/status', protect, orderController.getOrderStatus);

module.exports = router;
