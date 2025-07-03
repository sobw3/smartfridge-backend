[⚠️ Suspicious Content] const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');
require('dotenv').config();

// --- 1. CONFIGURAÇÃO DA APLICAÇÃO ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- 2. CONFIGURAÇÃO DA BASE DE DADOS ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// --- 3. MIDDLEWARES ---
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

// --- 4. ROTAS E LÓGICA ---

// Rota de Teste
app.get('/', (req, res) => {
    res.send('API da SmartFridge Brasil está funcionando!');
});

// --- ROTAS PÚBLICAS ---
app.get('/api/public/condominiums', async (req, res) => {
    try {
        const allCondos = await pool.query("SELECT id, name FROM condominiums ORDER BY name ASC");
        res.status(200).json(allCondos.rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- ROTAS DE AUTENTICAÇÃO DE UTILIZADOR ---
app.post('/api/auth/register', async (req, res) => {
    const { name, cpf, email, password, birth_date, condo_id } = req.body;
    if (!name || !cpf || !email || !password || !birth_date || !condo_id) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const userExists = await pool.query("SELECT * FROM users WHERE cpf = $1 OR email = $2", [cpf, email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ message: 'CPF ou e-mail já cadastrado.' });
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            "INSERT INTO users (name, cpf, email, password_hash, birth_date, condo_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email",
            [name, cpf, email, password_hash, birth_date, condo_id]
        );
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser.rows[0] });
    } catch (error) {
        console.error('Erro no registro:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { cpf, password } = req.body;
    if (!cpf || !password) {
        return res.status(400).json({ message: 'CPF e senha são obrigatórios.' });
    }
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE cpf = $1", [cpf]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'CPF ou senha inválidos.' });
        }
        const payload = { user: { id: user.id, name: user.name, condoId: user.condo_id, email: user.email } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ message: 'Login bem-sucedido!', token, user: payload.user });
        });
    } catch (error) {
        console.error('Erro no login:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/auth/me', protect, async (req, res) => res.status(200).json(req.user));

app.put('/api/auth/update-condo', protect, async (req, res) => {
    const userId = req.user.id;
    const { condoId } = req.body;
    if (!condoId) return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    try {
        const updatedUser = await pool.query('UPDATE users SET condo_id = $1 WHERE id = $2 RETURNING id, name, email, condo_id', [condoId, userId]);
        if (updatedUser.rows.length === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
        const userPayload = { id: updatedUser.rows[0].id, name: updatedUser.rows[0].name, email: updatedUser.rows[0].email, condoId: updatedUser.rows[0].condo_id };
        res.status(200).json({ message: 'Condomínio atualizado com sucesso!', user: userPayload });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao atualizar condomínio.' });
    }
});

app.put('/api/auth/me', protect, async (req, res) => {
    const userId = req.user.id;
    const { name, email, password, newPassword } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    try {
        const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
        if (emailExists.rows.length > 0) return res.status(409).json({ message: 'Este e-mail já está em uso por outra conta.' });
        let passwordHash = null;
        if (newPassword) {
            if (!password) return res.status(400).json({ message: 'A senha atual é necessária para definir uma nova.' });
            const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            const user = userResult.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) return res.status(401).json({ message: 'A senha atual está incorreta.' });
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(newPassword, salt);
        }
        let query;
        let queryParams;
        if (passwordHash) {
            query = 'UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, name, email, condo_id';
            queryParams = [name, email, passwordHash, userId];
        } else {
            query = 'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, condo_id';
            queryParams = [name, email, userId];
        }
        const { rows } = await pool.query(query, queryParams);
        if (rows.length === 0) return res.status(404).json({ message: 'Utilizador não encontrado.' });
        res.status(200).json({ message: 'Dados atualizados com sucesso!', user: rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao atualizar os dados.' });
    }
});

// --- ROTAS DE PRODUTOS ---
app.get('/api/products', async (req, res) => {
    const { condoId } = req.query;
    if (!condoId) return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    try {
        const query = `SELECT p.id, p.name, p.description, p.image_url, p.sale_price, i.quantity AS stock FROM products AS p JOIN inventory AS i ON p.id = i.product_id WHERE i.condo_id = $1 AND i.quantity > 0`;
        const productsResult = await pool.query(query, [condoId]);
        res.status(200).json(productsResult.rows);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.get('/api/products/search', async (req, res) => {
    const { q, condoId } = req.query;
    if (!q || !condoId) return res.status(400).json({ message: 'Termo de pesquisa e ID do condomínio são obrigatórios.' });
    try {
        const searchTerm = `%${q}%`;
        const query = `SELECT p.id, p.name, p.image_url, p.sale_price FROM products AS p JOIN inventory AS i ON p.id = i.product_id WHERE i.condo_id = $1 AND i.quantity > 0 AND p.name ILIKE $2 LIMIT 5;`;
        const { rows } = await pool.query(query, [condoId, searchTerm]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao pesquisar produtos.' });
    }
});

// --- ROTAS DE PEDIDOS ---
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

app.post('/api/orders/create-pix', protect, async (req, res) => {
    const { items, user } = req.body;
    if (!items || items.length === 0 || !user) return res.status(400).json({ message: 'Dados do pedido inválidos.' });
    try {
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        const newOrder = await pool.query('INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING *', [user.id, user.condoId, totalAmount, 'pending', 'pix']);
        const orderId = newOrder.rows[0].id;
        for (const item of items) {
            await pool.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
        }
        const paymentData = { body: { transaction_amount: totalAmount, description: `Pedido #${orderId}`, payment_method_id: 'pix', payer: { email: user.email, first_name: user.name }, external_reference: orderId.toString() } };
        const result = await payment.create(paymentData);
        res.status(201).json({ orderId: orderId, pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64, pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code });
    } catch (error) {
        const errorMessage = error.cause?.message || error.message || 'Falha ao criar pedido PIX.';
        res.status(500).json({ message: errorMessage });
    }
});

app.post('/api/orders/create-card', protect, async (req, res) => {
    const { items, user, token, issuer_id, payment_method_id, installments } = req.body;
    if (!items || !token || !payment_method_id || !user) return res.status(400).json({ message: 'Dados de pagamento incompletos.' });
    const clientDB = await pool.connect();
    try {
        await clientDB.query('BEGIN');
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        const newOrder = await clientDB.query('INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING *', [user.id, user.condoId, totalAmount, 'pending', 'card']);
        const orderId = newOrder.rows[0].id;
        for (const item of items) {
            await clientDB.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
        }
        const paymentData = { body: { transaction_amount: totalAmount, description: `Pedido #${orderId}`, token, installments, payment_method_id, issuer_id, payer: { email: user.email, first_name: user.name }, external_reference: orderId.toString() } };
        const paymentResult = await payment.create(paymentData);
        if (paymentResult.status === 'approved') {
            await clientDB.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', paymentResult.id, orderId]);
            for (const item of items) {
                await clientDB.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3', [item.quantity, item.id, user.condoId]);
            }
            const unlockToken = crypto.randomBytes(16).toString('hex');
            const expires_at = new Date(Date.now() + 5 * 60 * 1000);
            await clientDB.query('INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)', [unlockToken, orderId, expires_at]);
            await clientDB.query('COMMIT');
            res.status(201).json({ status: 'approved', unlockToken: unlockToken });
        } else {
            await clientDB.query('ROLLBACK');
            res.status(400).json({ status: paymentResult.status, message: paymentResult.status_detail });
        }
    } catch (error) {
        await clientDB.query('ROLLBACK');
        const errorMessage = error.cause?.message || error.message || 'Falha ao processar pagamento com cartão.';
        res.status(500).json({ message: errorMessage });
    } finally {
        clientDB.release();
    }
});

app.get('/api/orders/:orderId/status', protect, async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderResult = await pool.query('SELECT status FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Pedido não encontrado.' });
        const { status } = orderResult.rows[0];
        let unlockToken = null;
        if (status === 'paid') {
            const tokenResult = await pool.query('SELECT token FROM unlock_tokens WHERE order_id = $1 AND is_used = false', [orderId]);
            if (tokenResult.rows.length > 0) unlockToken = tokenResult.rows[0].token;
        }
        res.status(200).json({ status, unlockToken });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

// --- ROTAS DE ADMINISTRADOR ---
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
        const payload = { username: username, isAdmin: true };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login de admin bem-sucedido!', token });
    } else {
        res.status(401).json({ message: 'Credenciais de admin inválidas' });
    }
});

app.get('/api/admin/condominiums', protectAdmin, async (req, res) => {
    try {
        const allCondos = await pool.query("SELECT * FROM condominiums ORDER BY name ASC");
        res.status(200).json(allCondos.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/admin/products', protectAdmin, async (req, res) => {
    try {
        const allProducts = await pool.query("SELECT * FROM products ORDER BY name ASC");
        res.status(200).json(allProducts.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/admin/profits', protectAdmin, async (req, res) => {
    try {
        const query = `SELECT c.id, c.name, c.initial_investment, c.syndic_profit_percentage, COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS gross_revenue, COALESCE(SUM(p.purchase_price * oi.quantity), 0) AS cost_of_goods_sold, COALESCE(SUM((oi.price_at_purchase - p.purchase_price) * oi.quantity), 0) AS net_revenue, COALESCE(SUM(((oi.price_at_purchase - p.purchase_price) * oi.quantity) * (c.syndic_profit_percentage / 100.0)), 0) AS syndic_commission FROM condominiums c LEFT JOIN orders o ON c.id = o.condo_id AND o.status = 'paid' LEFT JOIN order_items oi ON o.id = oi.order_id LEFT JOIN products p ON oi.product_id = p.id GROUP BY c.id ORDER BY c.name;`;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ... (e todas as outras rotas de admin: POST, PUT, DELETE)

// --- WEBHOOKS ---
app.post('/api/webhooks/mercadopago', async (req, res) => {
    const { type, data } = req.body;
    if (type === 'payment') {
        try {
            const paymentInfo = await new Payment(client).get({ id: data.id });
            const orderId = paymentInfo.external_reference;
            if (paymentInfo.status === 'approved') {
                await pool.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', data.id, orderId]);
                const orderItemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
                const { rows: [order] } = await pool.query('SELECT condo_id FROM orders WHERE id = $1', [orderId]);
                for (const item of orderItemsResult.rows) {
                    await pool.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3', [item.quantity, item.product_id, order.condo_id]);
                }
                const token = crypto.randomBytes(16).toString('hex');
                const expires_at = new Date(Date.now() + 5 * 60 * 1000);
                await pool.query('INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)', [token, orderId, expires_at]);
            }
        } catch (error) {
            console.error('ERRO NO PROCESSAMENTO DO WEBHOOK:', error);
        }
    }
    res.sendStatus(200);
});


// --- INICIA O SERVIDOR ---
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
