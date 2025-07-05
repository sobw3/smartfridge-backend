const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Importa os ficheiros de rotas
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORREÇÃO DEFINITIVA DO CORS ---
// Esta configuração permite que o seu site no Render (quando a variável de ambiente estiver definida)
// OU o seu ambiente local (http://localhost:3000) façam pedidos.
const corsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

// Middleware para interpretar o corpo das requisições como JSON
app.use(express.json());

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

// Rota de teste para verificar se o servidor está no ar
app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
