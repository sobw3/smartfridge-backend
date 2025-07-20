const pool = require('../db');
const jwt = require('jsonwebtoken');

exports.loginAdmin = async (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASSWORD) {
        const payload = { username: username, isAdmin: true };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: 'Login de admin bem-sucedido!', token });
    } else {
        res.status(401).json({ message: 'Credenciais de admin inválidas' });
    }
};

exports.createCondominium = async (req, res) => {
    const { name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment } = req.body;
    try {
        const newCondo = await pool.query(
            "INSERT INTO condominiums (name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment]
        );
        res.status(201).json(newCondo.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getCondominiums = async (req, res) => {
    try {
        const allCondos = await pool.query("SELECT * FROM condominiums ORDER BY name ASC");
        res.status(200).json(allCondos.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateCondominium = async (req, res) => {
    const { id } = req.params;
    const { name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment } = req.body;
    try {
        const updatedCondo = await pool.query(
            "UPDATE condominiums SET name = $1, address = $2, syndic_name = $3, syndic_contact = $4, syndic_profit_percentage = $5, initial_investment = $6 WHERE id = $7 RETURNING *",
            [name, address, syndic_name, syndic_contact, syndic_profit_percentage, initial_investment, id]
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

exports.createProduct = async (req, res) => {
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level } = req.body;
    try {
        const newProduct = await pool.query(
            "INSERT INTO products (name, description, image_url, purchase_price, sale_price, critical_stock_level) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
            [name, description, image_url, purchase_price, sale_price, critical_stock_level]
        );
        res.status(201).json(newProduct.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.getProducts = async (req, res) => {
    try {
        const allProducts = await pool.query("SELECT * FROM products ORDER BY name ASC");
        res.status(200).json(allProducts.rows);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.updateProduct = async (req, res) => {
    const { id } = req.params;
    const { name, description, image_url, purchase_price, sale_price, critical_stock_level } = req.body;
    try {
        const updatedProduct = await pool.query(
            "UPDATE products SET name = $1, description = $2, image_url = $3, purchase_price = $4, sale_price = $5, critical_stock_level = $6 WHERE id = $7 RETURNING *",
            [name, description, image_url, purchase_price, sale_price, critical_stock_level, id]
        );
        res.status(200).json(updatedProduct.rows[0]);
    } catch (error) { res.status(500).json({ message: error.message }); }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("DELETE FROM products WHERE id = $1", [id]);
        res.status(200).json({ message: 'Produto apagado com sucesso.' });
    } catch (error) { res.status(500).json({ message: error.message }); }
};

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

exports.getProfitReport = async (req, res) => {
    try {
        const query = `
            SELECT
                c.id,
                c.name,
                c.initial_investment,
                c.syndic_profit_percentage,
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

exports.getSalesSummary = async (req, res) => {
    const { condoId } = req.query;
    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }
    try {
        const query = `
            SELECT
                COUNT(*) AS sales_count,
                SUM(total_amount) AS total_revenue
            FROM orders
            WHERE
                condo_id = $1 AND
                status = 'paid' AND
                created_at >= CURRENT_DATE AND
                created_at < CURRENT_DATE + INTERVAL '1 day';
        `;
        const { rows } = await pool.query(query, [condoId]);
        res.status(200).json(rows[0] || { sales_count: '0', total_revenue: '0' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSalesLog = async (req, res) => {
    const { condoId } = req.query;
    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }
    try {
        const query = `
            SELECT
                o.id,
                o.total_amount,
                o.status,
                o.payment_method,
                o.created_at,
                u.name AS user_name,
                u.cpf AS user_cpf,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'product_name', p.name,
                            'quantity', oi.quantity,
                            'price', oi.price_at_purchase
                        )
                    ) FILTER (WHERE oi.id IS NOT NULL), '[]'::json
                ) AS items
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE o.condo_id = $1 AND o.status = 'paid'
            GROUP BY o.id, u.name, u.cpf
            ORDER BY o.created_at DESC;
        `;
        const { rows } = await pool.query(query, [condoId]);
        res.status(200).json(rows);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
