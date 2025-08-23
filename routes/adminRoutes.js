const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protectAdmin } = require('../middleware/authMiddleware');
const ticketController = require('../controllers/ticketController');
const promotionController = require('../controllers/promotionController');
const creditController = require('../controllers/creditController'); 

// Login
router.post('/login', adminController.loginAdmin);

// Condomínios
router.post('/condominiums', protectAdmin, adminController.createCondominium);
router.get('/condominiums', protectAdmin, adminController.getCondominiums);
router.put('/condominiums/:id', protectAdmin, adminController.updateCondominium);
router.delete('/condominiums/:id', protectAdmin, adminController.deleteCondominium);

// Produtos
router.post('/products', protectAdmin, adminController.createProduct);
router.get('/products', protectAdmin, adminController.getProducts);
router.put('/products/:id', protectAdmin, adminController.updateProduct);
router.delete('/products/:id', protectAdmin, adminController.deleteProduct);

// PONTO 2: Rota para buscar promoções (já existia, mas confirmando)
router.get('/promotions/daily', protectAdmin, promotionController.getDailyPromotions);


// Inventário e Estoque
router.get('/inventory', protectAdmin, adminController.getInventoryByCondo);
router.post('/inventory', protectAdmin, adminController.updateInventory);
router.get('/critical-stock', protectAdmin, adminController.getCriticalStock);

// Relatórios
router.get('/profits', protectAdmin, adminController.getProfitReport);
router.get('/sales', protectAdmin, adminController.getSalesSummaryAndLog);
router.get('/users-by-condo', protectAdmin, adminController.getUsersByCondo);

// Gestão de Utilizadores
router.get('/users-paginated', protectAdmin, adminController.getUsersByCondoPaginated);
router.put('/users/:id', protectAdmin, adminController.updateUserByAdmin);
router.post('/users/:id/add-balance', protectAdmin, adminController.addWalletBalanceByAdmin);
router.post('/users/:id/toggle-status', protectAdmin, adminController.toggleUserStatus);

// Tiquetes (Admin)
router.post('/users/:userId/tickets', protectAdmin, ticketController.createTicketForUser);
router.get('/users/:userId/tickets', protectAdmin, ticketController.getTicketsForUserByAdmin);
router.delete('/tickets/:ticketId', protectAdmin, ticketController.deleteTicketByAdmin);

router.get('/users/:userId/invoices', protectAdmin, creditController.getInvoicesForUser);

module.exports = router;
