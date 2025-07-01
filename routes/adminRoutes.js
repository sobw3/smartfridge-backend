const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');

// Rota de Login não protegida
router.post('/login', adminController.loginAdmin);

// Todas as outras rotas de admin são protegidas pelo middleware 'protectAdmin'
router.post('/condominiums', protectAdmin, adminController.createCondominium);
router.get('/condominiums', protectAdmin, adminController.getCondominiums);
router.put('/condominiums/:id', protectAdmin, adminController.updateCondominium);
router.delete('/condominiums/:id', protectAdmin, adminController.deleteCondominium);

router.post('/products', protectAdmin, adminController.createProduct);
router.get('/products', protectAdmin, adminController.getProducts);
router.put('/products/:id', protectAdmin, adminController.updateProduct);
router.delete('/products/:id', protectAdmin, adminController.deleteProduct);

router.get('/inventory', protectAdmin, adminController.getInventoryByCondo);
router.post('/inventory', protectAdmin, adminController.updateInventory);

router.get('/profits', protectAdmin, adminController.getProfitReport);

router.get('/sales/summary', protectAdmin, adminController.getSalesSummary);
router.get('/sales/log', protectAdmin, adminController.getSalesLog);

module.exports = router;