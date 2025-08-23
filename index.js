// ARQUIVO: index.js (VERSÃO FINAL E CORRIGIDA)

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar TODAS as suas rotas com os nomes corretos dos arquivos
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const fridgeRoutes = require('./routes/fridgeRoutes');
const walletRoutes = require('./routes/walletRoutes');
const cashierRoutes = require('./routes/cashierRoutes');
const userRoutes = require('./routes/userRoutes'); // <-- ADICIONE ESTA LINHA
const promotionScheduler = require('./services/promotionScheduler');
const creditRoutes = require('./routes/creditRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/fridge', fridgeRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin/central-cashier', cashierRoutes);
app.use('/api/user', userRoutes); // <-- ADICIONE ESTA LINHA
app.use('/api/credit', creditRoutes);


// Rota de teste
app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
     // promotionScheduler.start();
});

app.use((req, res, next) => {
    console.log(`Pedido recebido: ${req.method} ${req.originalUrl}`);
    next();
});