const pool = require('../db');

// --- Pega o resumo geral do caixa (lucro e custo de todos os condomínios) ---
exports.getCashierSummary = async (req, res) => {
    try {
        const query = `
            SELECT
                COALESCE(SUM((oi.price_at_purchase - p.purchase_price) * oi.quantity), 0) AS total_net_profit,
                COALESCE(SUM(p.purchase_price * oi.quantity), 0) AS total_cost_of_goods_sold
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.status = 'paid';
        `;
        const summaryResult = await pool.query(query);
        const withdrawalsQuery = `
            SELECT type, COALESCE(SUM(amount), 0) as total_withdrawn
            FROM central_cashier_withdrawals
            GROUP BY type;
        `;
        const withdrawalsResult = await pool.query(withdrawalsQuery);

        let netProfit = parseFloat(summaryResult.rows[0].total_net_profit);
        let costOfGoods = parseFloat(summaryResult.rows[0].total_cost_of_goods_sold);

        withdrawalsResult.rows.forEach(w => {
            if (w.type === 'net_profit') {
                netProfit -= parseFloat(w.total_withdrawn);
            } else if (w.type === 'cost_of_goods') {
                costOfGoods -= parseFloat(w.total_withdrawn);
            }
        });

        res.status(200).json({
            net_profit: netProfit,
            cost_of_goods: costOfGoods
        });

    } catch (error) {
        console.error("Erro ao buscar resumo do caixa central:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// --- Registra uma nova retirada ---
exports.createWithdrawal = async (req, res) => {
    const { amount, type, reason } = req.body;

    if (!amount || !type || !['net_profit', 'cost_of_goods'].includes(type)) {
        return res.status(400).json({ message: 'Dados de retirada inválidos.' });
    }

    try {
        const newWithdrawal = await pool.query(
            "INSERT INTO central_cashier_withdrawals (amount, type, reason) VALUES ($1, $2, $3) RETURNING *",
            [amount, type, reason]
        );
        res.status(201).json(newWithdrawal.rows[0]);
    } catch (error) {
        console.error("Erro ao criar retirada:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// --- Pega o histórico de retiradas ---
exports.getWithdrawalHistory = async (req, res) => {
    try {
        const history = await pool.query("SELECT * FROM central_cashier_withdrawals ORDER BY created_at DESC");
        res.status(200).json(history.rows);
    } catch (error) {
        console.error("Erro ao buscar histórico de retiradas:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};
