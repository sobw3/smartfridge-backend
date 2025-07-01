// ===============================================================
// ARQUIVO: index.js (Ponto de entrada principal do servidor)
// Localização: smartfridge-backend/index.js
// VERSÃO COM CORREÇÃO DE CORS
// ===============================================================

const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importar as rotas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares Essenciais ---

// ATUALIZAÇÃO: Configuração de CORS mais explícita
// Isto diz ao nosso backend para aceitar pedidos explicitamente do nosso frontend
// que roda em http://localhost:3000
const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));


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
