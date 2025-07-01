// ===============================================================
// ARQUIVO: index.js (VERSÃO FINAL PARA PRODUÇÃO)
// ===============================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar todas as rotas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Configuração do CORS (A MAIS IMPORTANTE) ---
// Esta linha lê a variável de ambiente que configurou no Render.
// Se a variável não existir, ele não permite que ninguém aceda.
const corsOptions = {
    origin: process.env.CORS_ORIGIN, 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- Middlewares Essenciais ---
app.use(express.json());

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

// Rota de teste
app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
