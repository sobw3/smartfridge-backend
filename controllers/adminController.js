
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
    // Adicionada 'category'
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level, promotion_start_date, promotion_end_date, category } = req.body;
    try {
        let calculatedPromoPrice = null;
<<<<<<< HEAD
        const cost = parseFloat(purchase_price);
        if (!isNaN(cost) && cost > 0 && promotion_start_date && promotion_end_date) {
            calculatedPromoPrice = cost * 1.10;
=======
        if (purchase_price && promotion_start_date && promotion_end_date) {
            calculatedPromoPrice = parseFloat(purchase_price) * 1.10;
>>>>>>> a219e2637ef6f83ea23004e4dcb2becbd565265b
        }

        const newProduct = await pool.query(
            `INSERT INTO products (name, description, image_url, purchase_price, sale_price, critical_stock_level, promotional_price, promotion_start_date, promotion_end_date, category) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [name, description, image_url, purchase_price, sale_price, critical_stock_level, calculatedPromoPrice, promotion_start_date || null, promotion_end_date || null, category]
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
    // Adicionada 'category'
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level, promotion_start_date, promotion_end_date, category } = req.body;
    try {
        let calculatedPromoPrice = null;
        const cost = parseFloat(purchase_price);
        if (!isNaN(cost) && cost > 0 && promotion_start_date && promotion_end_date) {
            calculatedPromoPrice = cost * 1.10;
        }

        const updatedProduct = await pool.query(
            `UPDATE products SET 
                name = $1, description = $2, image_url = $3, purchase_price = $4, sale_price = $5, 
                critical_stock_level = $6, promotional_price = $7, promotion_start_date = $8, promotion_end_date = $9, category = $10
             WHERE id = $11 RETURNING *`,
            [name, description, image_url, purchase_price, sale_price, critical_stock_level, calculatedPromoPrice, promotion_start_date || null, promotion_end_date || null, category, id]
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
            dateFilter = `AND o.created_at BETWEEN $${paramCounter} AND $${paramCounter + 1}`;
            queryParams.push(startDate, endDate);
        }

        // --- INÍCIO DA NOVA LÓGICA ---
        // Consulta para o log de transações, agora com detalhes dos itens e lucro
        const logQuery = `
            SELECT 
                o.id, 
                o.total_amount AS amount, 
                o.payment_method,
                o.created_at, 
                u.name AS user_name, 
                u.cpf AS user_cpf,
                -- Calcula o lucro líquido total para esta venda específica
                SUM(oi.quantity * (oi.price_at_purchase - p.purchase_price)) AS net_profit,
                -- Agrega todos os itens da venda num único campo JSON
                json_agg(
                    json_build_object(
                        'product_name', p.name,
                        'quantity', oi.quantity,
                        'price', oi.price_at_purchase
                    )
                ) AS items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.condo_id = $1 AND o.status = 'paid' ${dateFilter}
            GROUP BY o.id, u.id
            ORDER BY o.created_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
        `;
        const logResult = await pool.query(logQuery, [...queryParams, limit, offset]);

        // Consulta para as métricas de resumo no topo da página
        const summaryQuery = `
            SELECT
                COALESCE(SUM(o.total_amount), 0)::float AS total_revenue,
                COUNT(o.id) AS total_orders,
                COALESCE(SUM(sub.profit), 0)::float AS total_net_profit
            FROM orders o
            LEFT JOIN (
                SELECT 
                    oi.order_id, 
                    SUM(oi.quantity * (oi.price_at_purchase - p.purchase_price)) as profit 
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                GROUP BY oi.order_id
            ) as sub ON o.id = sub.order_id
            WHERE o.condo_id = $1 AND o.status = 'paid' ${dateFilter};
        `;
        const summaryResult = await pool.query(summaryQuery, queryParams);

        // Consulta para a contagem total para a paginação
        const totalCountQuery = `SELECT COUNT(id) FROM orders o WHERE o.condo_id = $1 AND o.status = 'paid' ${dateFilter};`;
        const totalCountResult = await pool.query(totalCountQuery, queryParams);
        // --- FIM DA NOVA LÓGICA ---

        res.status(200).json({
            log: logResult.rows,
            summary: summaryResult.rows[0],
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: parseInt(totalCountResult.rows[0].count, 10)
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

exports.getInventoryAnalysis = async (req, res) => {
    const { condoId } = req.query;
    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }

    try {
        const query = `
            SELECT
                p.id, p.name, p.image_url, p.purchase_price, p.sale_price, p.critical_stock_level,
                i.quantity AS current_stock,
                (i.quantity * p.purchase_price) AS total_cost_in_stock,
                (i.quantity * (p.sale_price - p.purchase_price)) AS potential_net_profit,
                (
                    SELECT COALESCE(SUM(oi.quantity), 0)::int
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.product_id = p.id AND o.condo_id = $1 AND o.status = 'paid' AND o.created_at >= NOW() - INTERVAL '30 days'
                ) AS units_sold_last_30_days,
                (
                    SELECT COALESCE(SUM(oi.quantity * (oi.price_at_purchase - p.purchase_price)), 0)
                    FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE oi.product_id = p.id AND o.condo_id = $1 AND o.status = 'paid' AND o.created_at >= NOW() - INTERVAL '30 days'
                ) AS net_profit_last_30_days
            FROM products p
            JOIN inventory i ON p.id = i.product_id
            WHERE i.condo_id = $1
            ORDER BY p.name;
        `;
        
        const { rows: analysisData } = await pool.query(query, [condoId]);

        // --- LÓGICA DA "IA": Processamento dos dados para gerar insights ---
        
        // Clona e ordena os produtos por mais vendidos
        const sortedBySales = [...analysisData].sort((a, b) => b.units_sold_last_30_days - a.units_sold_last_30_days);
        
        // Pega os 3 mais vendidos
        const topSellers = sortedBySales.slice(0, 3);
        
        // Pega os 3 menos vendidos (que ainda venderam pelo menos 1 unidade)
        const lowSellers = sortedBySales.filter(p => p.units_sold_last_30_days > 0).slice(-3);

        // Sugestões de promoção são os produtos com as menores vendas (incluindo zero vendas)
        const promotionSuggestions = [...analysisData]
            .sort((a, b) => a.units_sold_last_30_days - b.units_sold_last_30_days)
            .slice(0, 3);
            
        // Monta o objeto de resposta final
        const responsePayload = {
            analysis: analysisData,
            insights: {
                topSellers,
                lowSellers,
                promotionSuggestions
            }
        };

        res.status(200).json(responsePayload);

    } catch (error) {
        console.error("Erro ao gerar análise de inventário:", error);
        res.status(500).json({ message: 'Erro ao gerar análise de inventário.' });
    }
};

exports.getDashboardStats = async (req, res) => {
    try {
        // Métrica 1: Faturamento e Pedidos de Hoje (também corrigida para usar o fuso horário)
        const todayStatsQuery = `
            SELECT
                COALESCE(SUM(total_amount), 0)::float AS revenue_today,
                COUNT(id) AS orders_today
            FROM orders
            WHERE status = 'paid' AND created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
        `;
        const todayStatsResult = await pool.query(todayStatsQuery);

        // Métrica 2: Novos Utilizadores Hoje e Total (também corrigida para usar o fuso horário)
        const userStatsQuery = `
            SELECT
                COUNT(id) AS total_users,
                SUM(CASE WHEN created_at >= (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN 1 ELSE 0 END)::int AS new_users_today
            FROM users;
        `;
        const userStatsResult = await pool.query(userStatsQuery);

        // --- INÍCIO DA CORREÇÃO PRINCIPAL ---
        // Métrica 3: Vendas dos Últimos 7 Dias (consulta robusta com fuso horário)
        const salesLast7DaysQuery = `
            SELECT 
                TO_CHAR(day_series.day, 'DD/MM') AS date,
                COALESCE(SUM(o.total_amount), 0)::float AS total
            FROM 
                GENERATE_SERIES(
                    (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 6,
                    (NOW() AT TIME ZONE 'America/Sao_Paulo')::date,
                    '1 day'
                ) AS day_series(day)
            LEFT JOIN 
                orders o ON (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date = day_series.day AND o.status = 'paid'
            GROUP BY 
                day_series.day
            ORDER BY 
                day_series.day ASC;
        `;
        // --- FIM DA CORREÇÃO PRINCIPAL ---
        const salesLast7DaysResult = await pool.query(salesLast7DaysQuery);

        const stats = {
            ...todayStatsResult.rows[0],
            ...userStatsResult.rows[0],
            sales_last_7_days: salesLast7DaysResult.rows
        };

        res.status(200).json(stats);

    } catch (error) {
        console.error("Erro ao buscar estatísticas do dashboard:", error);
        res.status(500).json({ message: 'Erro ao buscar estatísticas do dashboard.' });
    }
};
