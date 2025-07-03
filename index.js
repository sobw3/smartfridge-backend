[Suspicious Content] const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const adminRoutes = require('./routes/adminRoutes');
const publicRoutes = require('./routes/publicRoutes');
const orderRoutes = require('./routes/orderRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
    origin: process.env.CORS_ORIGIN,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
