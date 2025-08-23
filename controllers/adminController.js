// sobw3/backendsmart/backendsmart-a691fbac7367ed29d2e67cae6bd0bd5ddac8ecef/adminController.js

const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// --- LOGIN ADMIN ---
exports.loginAdmin = async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
        const payload = { id: 'admin', username: username, isAdmin: true };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login de admin bem-sucedido!', token });
    } else {
        res.status(401).json({ message: 'Credenciais de admin inválidas' });
    }
};

// --- GESTÃO DE CONDOMÍNIOS ---
// (As funções de condomínio permanecem as mesmas)
exports.createCondominium = async (req, res) => {
    const { name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, monthly_fixed_cost, fridge_id } = req.body;
    try {
        const newCondo = await pool.query(
            "INSERT INTO condominiums (name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, monthly_fixed_cost, fridge_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
            [name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, monthly_fixed_cost, fridge_id]
        );
        res.status(201).json(newCondo.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getCondominiums = async (req, res) => {
    try {
        // ALTERAÇÃO: Adicionado 'fridge_id' para garantir que é sempre enviado para o admin
        const allCondos = await pool.query("SELECT * FROM condominiums ORDER BY name ASC");
        res.status(200).json(allCondos.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// ALTERADO: Adicionado 'fridge_id'
exports.updateCondominium = async (req, res) => {
    const { id } = req.params;
    const { name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, monthly_fixed_cost, fridge_id } = req.body;
    try {
        const updatedCondo = await pool.query(
            "UPDATE condominiums SET name = $1, address = $2, syndic_name = $3, syndic_contact = $4, syndic_profit_percentage = $5, initial_investment = $6, monthly_fixed_cost = $7, fridge_id = $8 WHERE id = $9 RETURNING *",
            [name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, monthly_fixed_cost, fridge_id, id]
        );
        res.status(200).json(updatedCondo.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteCondominium = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM condominiums WHERE id = $1", [id]);
        res.status(200).json({ message: 'Condomínio apagado com sucesso.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// --- GESTÃO DE PRODUTOS ---
// (As funções de produtos permanecem as mesmas)
exports.createProduct = async (req, res) => {
    // ALTERAÇÃO: Removido 'promotional_price' do corpo, pois será calculado
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level, promotion_start_date, promotion_end_date } = req.body;
    try {
        // LÓGICA DE CÁLCULO AUTOMÁTICO
        let calculatedPromoPrice = null;
        if (purchase_price && promotion_start_date && promotion_end_date) {
            calculatedPromoPrice = parseFloat(purchase_price) * 1.30;
        }

        const newProduct = await pool.query(
            `INSERT INTO products (name, description, image_url, purchase_price, sale_price, critical_stock_level, promotional_price, promotion_start_date, promotion_end_date) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [name, description, image_url, purchase_price, sale_price, critical_stock_level, calculatedPromoPrice, promotion_start_date || null, promotion_end_date || null]
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (error) {
        console.error("Erro ao criar produto:", error);
        res.status(500).json({ message: error.message });
    }
};


exports.getProducts = async (req, res) => {
    try {
        const allProducts = await pool.query("SELECT * FROM products ORDER BY name ASC");
        res.status(200).json(allProducts.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

// FUNÇÃO UPDATE ATUALIZADA
exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    // ALTERAÇÃO: Removido 'promotional_price' do corpo
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level, promotion_start_date, promotion_end_date } = req.body;
    try {
        // LÓGICA DE CÁLCULO AUTOMÁTICO
        let calculatedPromoPrice = null;
        if (purchase_price && promotion_start_date && promotion_end_date) {
            calculatedPromoPrice = parseFloat(purchase_price) * 1.30;
        }

        const updatedProduct = await pool.query(
            `UPDATE products SET 
                name = $1, description = $2, image_url = $3, purchase_price = $4, sale_price = $5, 
                critical_stock_level = $6, promotional_price = $7, promotion_start_date = $8, promotion_end_date = $9
             WHERE id = $10 RETURNING *`,
            [name, description, image_url, purchase_price, sale_price, critical_stock_level, calculatedPromoPrice, promotion_start_date || null, promotion_end_date || null, id]
        );
        res.status(200).json(updatedProduct.rows[0]);
    } catch (error) {
        console.error(`Erro ao atualizar produto ${id}:`, error);
        res.status(500).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM products WHERE id = $1", [id]);
        res.status(200).json({ message: 'Produto apagado com sucesso.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};


// --- GESTÃO DE ESTOQUE ---
// (As funções de estoque permanecem as mesmas)
exports.getInventoryByCondo = async (req, res) => {
    const { condoId } = req.query;
    try {
        const query = `
            SELECT p.*, COALESCE(i.quantity, 0) as quantity
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id AND i.condo_id = $1
            ORDER BY p.name;
        `;
        const inventory = await pool.query(query, [condoId]);
        res.status(200).json(inventory.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
};
exports.updateInventory = async (req, res) => {
    const { condo_id, product_id, quantity } = req.body;
    try {
        const upsertQuery = `
            INSERT INTO inventory (condo_id, product_id, quantity)
            VALUES ($1, $2, $3)
            ON CONFLICT (condo_id, product_id)
            DO UPDATE SET quantity = EXCLUDED.quantity;
        `;
        await pool.query(upsertQuery, [condo_id, product_id, quantity]);
        res.status(200).json({ message: 'Inventário atualizado com sucesso.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};
exports.getCriticalStock = async (req, res) => {
    try {
        const query = `
            SELECT p.name as product_name, i.quantity, c.name as condo_name, p.critical_stock_level
            FROM inventory i
            JOIN products p ON i.product_id = p.id
            JOIN condominiums c ON i.condo_id = c.id
            WHERE i.quantity <= p.critical_stock_level
            ORDER BY c.name, p.name;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar estoque crítico:", error);
        res.status(500).json({ message: 'Erro ao buscar estoque crítico.' });
    }
};

// --- RELATÓRIOS ---
// (As funções de relatórios permanecem as mesmas)
exports.getProfitReport = async (req, res) => {
    try {
        const query = `
            SELECT
                c.id, c.name, c.initial_investment, c.syndic_profit_percentage, c.monthly_fixed_cost,
                COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0) AS gross_revenue,
                COALESCE(SUM(p.purchase_price * oi.quantity), 0) AS cost_of_goods_sold,
                COALESCE(SUM((oi.price_at_purchase - p.purchase_price) * oi.quantity), 0) AS net_revenue,
                COALESCE(SUM(((oi.price_at_purchase - p.purchase_price) * oi.quantity) * (c.syndic_profit_percentage / 100.0)), 0) AS syndic_commission
            FROM condominiums c
            LEFT JOIN orders o ON c.id = o.condo_id AND o.status = 'paid'
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            GROUP BY c.id
            ORDER BY c.name;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao gerar relatório de lucros:", error);
        res.status(500).json({ message: error.message });
    }
};
exports.getSalesSummaryAndLog = async (req, res) => {
    const { condoId, startDate, endDate, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }

    try {
        let dateFilter = "";
        const queryParams = [condoId];
        let paramCounter = 1;

        if (startDate && endDate) {
            paramCounter++;
            dateFilter = `AND created_at BETWEEN $${paramCounter}`;
            queryParams.push(startDate);
            paramCounter++;
            dateFilter += ` AND $${paramCounter}`;
            queryParams.push(endDate);
        }

        const logQuery = `
            SELECT * FROM (
                -- Vendas de produtos
                SELECT 
                    o.id, 
                    o.total_amount AS amount, 
                    'Venda' AS type,
                    o.payment_method,
                    o.created_at, 
                    u.name AS user_name, 
                    u.cpf AS user_cpf
                FROM orders o
                JOIN users u ON o.user_id = u.id
                WHERE o.condo_id = $1 AND o.status = 'paid'

                UNION ALL

                -- Depósitos na carteira
                SELECT 
                    wt.id, 
                    wt.amount, 
                    'Depósito' AS type,
                    wt.payment_gateway_id AS payment_method, -- Simplificado
                    wt.created_at, 
                    u.name AS user_name, 
                    u.cpf AS user_cpf
                FROM wallet_transactions wt
                JOIN users u ON wt.user_id = u.id
                WHERE u.condo_id = $1 AND wt.type = 'deposit'
            ) AS entries
            WHERE 1=1 ${dateFilter.replace('created_at', 'entries.created_at')}
            ORDER BY created_at DESC
            LIMIT $${paramCounter + 1} OFFSET $${paramCounter + 2};
        `;
        
        const logQueryParams = [...queryParams, limit, offset];
        const logResult = await pool.query(logQuery, logQueryParams);

        const totalCountQuery = `
            SELECT COUNT(*)::int FROM (
                SELECT created_at FROM orders o WHERE o.condo_id = $1 AND o.status = 'paid'
                UNION ALL
                SELECT wt.created_at FROM wallet_transactions wt JOIN users u ON wt.user_id = u.id WHERE u.condo_id = $1 AND wt.type = 'deposit'
            ) AS entries
            WHERE 1=1 ${dateFilter.replace('created_at', 'entries.created_at')};
        `;
        const totalCountResult = await pool.query(totalCountQuery, queryParams);

        res.status(200).json({
            log: logResult.rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: totalCountResult.rows[0].count
            }
        });
    } catch (error) {
        console.error("Erro ao buscar dados de vendas e entradas:", error);
        res.status(500).json({ message: 'Erro ao buscar dados de vendas e entradas.' });
    }
};

// --- GESTÃO DE UTILIZADORES ---
exports.getUsersByCondo = async (req, res) => {
    try {
        const query = `
            SELECT c.id, c.name, COUNT(u.id) as user_count 
            FROM condominiums c 
            LEFT JOIN users u ON c.id = u.condo_id 
            GROUP BY c.id 
            ORDER BY c.name;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Erro ao buscar contagem de utilizadores:", error);
        res.status(500).json({ message: 'Erro ao buscar contagem de utilizadores.' });
    }
};

// ALTERADO: Adicionado `is_active`
exports.getUsersByCondoPaginated = async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { condoId } = req.query;
    
    const offset = (page - 1) * limit;

    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }

    try {
        const usersQuery = "SELECT id, name, cpf, email, apartment, wallet_balance, phone_number, credit_limit, credit_used, credit_due_day, is_active FROM users WHERE condo_id = $1 ORDER BY name ASC LIMIT $2 OFFSET $3";
        const usersResult = await pool.query(usersQuery, [condoId, limit, offset]);

        const totalQuery = "SELECT COUNT(*)::int FROM users WHERE condo_id = $1";
        const totalResult = await pool.query(totalQuery, [condoId]);

        res.status(200).json({
            users: usersResult.rows,
            pagination: {
                page: page,
                limit: limit,
                total: totalResult.rows[0].count,
                totalPages: Math.ceil(totalResult.rows[0].count / limit) 
            }
        });
    } catch (error) {
        console.error("Erro ao buscar utilizadores:", error);
        res.status(500).json({ message: 'Erro ao buscar utilizadores.' });
    }
};

// ALTERADO: Adicionado `credit_limit` e `credit_due_day`
exports.updateUserByAdmin = async (req, res) => {
    const { id } = req.params;
    const { name, email, apartment, newPassword, credit_limit, credit_due_day } = req.body;
    
    try {
        let query = 'UPDATE users SET name = $1, email = $2, apartment = $3, credit_limit = $4, credit_due_day = $5';
        const params = [name, email, apartment, credit_limit, credit_due_day || null];

        let paramIndex = 6;
        if (newPassword && newPassword.length >= 6) {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(newPassword, salt);
            query += `, password_hash = $${paramIndex++}`;
            params.push(password_hash);
        }
        
        query += ` WHERE id = $${paramIndex++} RETURNING *`;
        params.push(id);

        const { rows } = await pool.query(query, params);
        res.status(200).json({ message: 'Utilizador atualizado com sucesso.', user: rows[0] });
    } catch (error) {
        console.error("Erro ao atualizar utilizador:", error);
        res.status(500).json({ message: 'Erro ao atualizar utilizador.' });
    }
};

exports.addWalletBalanceByAdmin = async (req, res) => {
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ message: 'Valor inválido.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [amount, id]);
        
        await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES ($1, 'deposit', $2, $3)`,
            [id, amount, `Crédito administrativo: ${reason || 'Adicionado pelo administrador'}`]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Saldo adicionado com sucesso.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro ao adicionar saldo:", error);
        res.status(500).json({ message: 'Erro ao adicionar saldo.' });
    } finally {
        client.release();
    }
};

// NOVO: Função para bloquear/desbloquear usuário
exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    try {
        const userResult = await pool.query('SELECT is_active FROM users WHERE id = $1', [id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const newStatus = !userResult.rows[0].is_active;
        await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [newStatus, id]);
        res.status(200).json({ message: `Usuário ${newStatus ? 'desbloqueado' : 'bloqueado'} com sucesso.` });
    } catch (error) {
        console.error("Erro ao alterar status do usuário:", error);
        res.status(500).json({ message: 'Erro ao alterar status do usuário.' });
    }
};