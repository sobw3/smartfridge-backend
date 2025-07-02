const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');
require('dotenv').config();

// --- CONFIGURAÇÃO DA APLICAÇÃO ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- CONFIGURAÇÃO DA BASE DE DADOS ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- MIDDLEWARES ---
const corsOptions = {
    origin: process.env.CORS_ORIGIN,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 
app.use(express.json());

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userResult = await pool.query('SELECT id, name, email, condo_id FROM users WHERE id = $1', [decoded.user.id]);
            if (userResult.rows.length === 0) return res.status(401).json({ message: 'Utilizador não encontrado' });
            req.user = userResult.rows[0];
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Não autorizado, token inválido' });
        }
    } else {
        return res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};

const protectAdmin = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.isAdmin) {
                req.admin = decoded;
                next();
            } else {
                return res.status(403).json({ message: 'Acesso negado. Rota apenas para administradores.' });
            }
        } catch (error) {
            return res.status(401).json({ message: 'Não autorizado, token de admin inválido' });
        }
    } else {
        return res.status(401).json({ message: 'Não autorizado, sem token de admin' });
    }
};

// --- CONTROLLERS (LÓGICA DAS ROTAS) ---

// Auth Controller
const authController = {
    register: async (req, res) => {
        const { name, cpf, email, password, birth_date, condo_id } = req.body;
        if (!name || !cpf || !email || !password || !birth_date || !condo_id) return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
        try {
            const userExists = await pool.query("SELECT * FROM users WHERE cpf = $1 OR email = $2", [cpf, email]);
            if (userExists.rows.length > 0) return res.status(409).json({ message: 'CPF ou e-mail já cadastrado.' });
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);
            const newUser = await pool.query("INSERT INTO users (name, cpf, email, password_hash, birth_date, condo_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email", [name, cpf, email, password_hash, birth_date, condo_id]);
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser.rows[0] });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor.' });
        }
    },
    login: async (req, res) => {
        const { cpf, password } = req.body;
        if (!cpf || !password) return res.status(400).json({ message: 'CPF e senha são obrigatórios.' });
        try {
            const userResult = await pool.query("SELECT * FROM users WHERE cpf = $1", [cpf]);
            if (userResult.rows.length === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
            const user = userResult.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) return res.status(401).json({ message: 'CPF ou senha inválidos.' });
            const payload = { user: { id: user.id, name: user.name, condoId: user.condo_id, email: user.email } };
            jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
                if (err) throw err;
                res.json({ message: 'Login bem-sucedido!', token, user: payload.user });
            });
        } catch (error) {
            res.status(500).json({ message: 'Erro interno do servidor.' });
        }
    },
    getMe: async (req, res) => {
        try {
            res.status(200).json(req.user);
        } catch (error) {
            res.status(500).json({ message: 'Erro ao buscar dados do utilizador.' });
        }
    },
    updateUserCondo: async (req, res) => { /* ...código sem alterações... */ },
    updateMe: async (req, res) => { /* ...código sem alterações... */ }
};

// Admin Controller
const adminController = {
    loginAdmin: async (req, res) => {
        const { username, password } = req.body;
        if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
            const payload = { username: username, isAdmin: true };
            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
            res.json({ message: 'Login de admin bem-sucedido!', token });
        } else {
            res.status(401).json({ message: 'Credenciais de admin inválidas' });
        }
    },
    getCondominiums: async (req, res) => {
        try {
            const allCondos = await pool.query("SELECT * FROM condominiums ORDER BY name ASC");
            res.status(200).json(allCondos.rows);
        } catch (error) { res.status(500).json({ message: error.message }); }
    },
    // ... (todas as outras funções de admin que já tínhamos)
};

// Order Controller
const orderController = {
    createPixOrder: async (req, res) => { /* ...código sem alterações... */ },
    createCardOrder: async (req, res) => { /* ...código sem alterações... */ },
    simulatePaymentApproval: async (req, res) => { /* ...código sem alterações... */ },
    getOrderStatus: async (req, res) => { /* ...código sem alterações... */ }
};

// --- ROTAS DA API ---
app.use('/api/auth', (() => {
    const router = express.Router();
    router.post('/register', authController.register);
    router.post('/login', authController.login);
    router.get('/me', protect, authController.getMe);
    router.put('/update-condo', protect, authController.updateUserCondo);
    router.put('/me', protect, authController.updateMe);
    return router;
})());

app.use('/api/admin', (() => {
    const router = express.Router();
    router.post('/login', adminController.loginAdmin);
    router.get('/condominiums', protectAdmin, adminController.getCondominiums);
    // ... (todas as outras rotas de admin)
    return router;
})());

app.use('/api/orders', (() => {
    const router = express.Router();
    router.post('/create-pix', orderController.createPixOrder);
    router.post('/create-card', protect, orderController.createCardOrder);
    router.post('/:orderId/simulate-payment', orderController.simulatePaymentApproval);
    router.get('/:orderId/status', protect, orderController.getOrderStatus);
    return router;
})());

// ... (Restante das rotas: public, products, webhooks)

app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
