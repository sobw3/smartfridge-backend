// controllers/orderController.js

const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

// --- FUNÇÃO AUXILIAR CORRIGIDA ---
// Esta função agora busca o fridge_id com base no ID do condomínio da COMPRA, e não do usuário.
const getFridgeIdByCondo = async (dbClient, condoId) => {
    if (!condoId) throw new Error('O ID do Condomínio é necessário para encontrar a geladeira.');
    
    const condoResult = await dbClient.query('SELECT fridge_id FROM condominiums WHERE id = $1', [condoId]);
    if (condoResult.rows.length === 0 || !condoResult.rows[0].fridge_id) {
        throw new Error(`Condomínio ${condoId} não encontrado ou nenhuma geladeira associada a ele.`);
    }
    return condoResult.rows[0].fridge_id;
};

const createPaymentDescription = async (items, user, condoId) => {
    const condoResult = await pool.query('SELECT name FROM condominiums WHERE id = $1', [condoId]);
    const condoName = condoResult.rows[0]?.name || 'Condomínio';
    const itemsSummary = items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    
    const fullDescription = `[${condoName}] ${itemsSummary}`;
    return fullDescription.substring(0, 255); 
};


// --- FUNÇÕES DE PAGAMENTO ---

exports.createWalletPaymentOrder = async (req, res) => {
    const userId = req.user.id;
    const { items, condoId } = req.body;

    if (!items || items.length === 0 || !condoId) {
        return res.status(400).json({ message: 'O carrinho ou o ID do condomínio está vazio.' });
    }

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        // CORREÇÃO: Usa a nova função auxiliar com o condoId da compra
        const fridgeId = await getFridgeIdByCondo(dbClient, condoId);
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        const userResult = await dbClient.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const currentUser = userResult.rows[0];
        
        if (parseFloat(currentUser.wallet_balance) < totalAmount) {
            throw new Error('Saldo insuficiente para completar a compra.');
        }

        await dbClient.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [totalAmount, userId]);

        const newOrder = await dbClient.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method, fridge_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, condoId, totalAmount, 'paid', 'wallet', fridgeId]
        );
        const orderId = newOrder.rows[0].id;

        let productNames = items.map(item => item.name).join(', ');
        if (productNames.length > 255) productNames = productNames.substring(0, 252) + '...';
        const description = `Compra ${productNames}`;

        for (const item of items) {
            await dbClient.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
            await dbClient.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3', [item.quantity, item.id, condoId]);
        }

        await dbClient.query(`INSERT INTO wallet_transactions (user_id, type, amount, related_order_id, description) VALUES ($1, 'purchase', $2, $3, $4)`, [userId, totalAmount, orderId, description]);

        await dbClient.query('INSERT INTO unlock_commands (fridge_id) VALUES ($1)', [fridgeId]);
        
        await dbClient.query('COMMIT');
        res.status(201).json({ message: 'Compra com saldo realizada com sucesso!', orderId: orderId });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('ERRO AO PAGAR COM CARTEIRA:', error);
        res.status(500).json({ message: error.message || 'Erro interno ao processar pagamento com saldo.' });
    } finally {
        dbClient.release();
    }
};

exports.createPixOrder = async (req, res) => {
    const { items, user, condoId } = req.body;
    if (!items || items.length === 0 || !user || !user.cpf || !condoId) {
        return res.status(400).json({ message: 'Dados do pedido, do utilizador (incluindo CPF) ou do condomínio são inválidos.' });
    }
    
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        
        const fridgeId = await getFridgeIdByCondo(dbClient, condoId);
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        
        const newOrder = await dbClient.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method, fridge_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user.id, condoId, totalAmount, 'pending', 'pix', fridgeId]
        );
        const orderId = newOrder.rows[0].id;

        for (const item of items) {
            await dbClient.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
        }

        await dbClient.query('COMMIT');

        const description = await createPaymentDescription(items, user, condoId);

        const paymentData = {
            body: {
                transaction_amount: totalAmount,
                description: description,
                payment_method_id: 'pix',
                payer: {
                    email: user.email,
                    first_name: user.name.split(' ')[0],
                    last_name: user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0],
                    identification: { type: 'CPF', number: user.cpf.replace(/\D/g, '') }
                },
                external_reference: orderId.toString(),
            }
        };
        const result = await payment.create(paymentData);
        res.status(201).json({
            orderId: orderId,
            pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64,
            pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('ERRO DETALHADO AO CRIAR PEDIDO PIX:', error);
        res.status(500).json({ message: error.message || 'Falha ao criar pedido PIX.' });
    } finally {
        dbClient.release();
    }
};

exports.createCardOrder = async (req, res) => {
    const { items, user, token, issuer_id, payment_method_id, installments, condoId } = req.body;
    if (!items || !token || !payment_method_id || !user || !user.cpf || !condoId) {
        return res.status(400).json({ message: 'Dados de pagamento, do utilizador ou da sessão de compra estão incompletos.' });
    }
    
    const clientDB = await pool.connect();
    try {
        await clientDB.query('BEGIN');
        
        const fridgeId = await getFridgeIdByCondo(clientDB, condoId);
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        
        const newOrder = await clientDB.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method, fridge_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [user.id, condoId, totalAmount, 'pending', 'card', fridgeId]
        );
        const orderId = newOrder.rows[0].id;
        for (const item of items) {
            await clientDB.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
        }

        const description = await createPaymentDescription(items, user, condoId);

        const paymentData = {
            body: {
                transaction_amount: totalAmount,
                description: description,
                token: token,
                installments: installments,
                payment_method_id: payment_method_id,
                issuer_id: issuer_id,
                payer: {
                    email: user.email,
                    identification: { type: 'CPF', number: user.cpf.replace(/\D/g, '') }
                },
                external_reference: orderId.toString(),
            }
        };
        const paymentResult = await payment.create(paymentData);

        if (paymentResult.status === 'approved') {
            await clientDB.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', paymentResult.id.toString(), orderId]);
            for (const item of items) {
                await clientDB.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3', [item.quantity, item.id, condoId]);
            }
            
            await clientDB.query('INSERT INTO unlock_commands (fridge_id) VALUES ($1)', [fridgeId]);

            await clientDB.query('COMMIT');
            res.status(201).json({ status: 'approved', orderId: orderId });
        } else {
            await clientDB.query('ROLLBACK');
            res.status(400).json({ status: paymentResult.status, message: paymentResult.status_detail });
        }
    } catch (error) {
        await clientDB.query('ROLLBACK');
        console.error('Erro ao criar pedido com cartão:', error);
        res.status(500).json({ message: 'Falha ao processar pagamento com cartão.' });
    } finally {
        clientDB.release();
    }
};

exports.createCreditPaymentOrder = async (req, res) => {
    const userId = req.user.id;
    const { items, condoId } = req.body;

    if (!items || items.length === 0 || !condoId) {
        return res.status(400).json({ message: 'O carrinho ou o ID do condomínio está vazio.' });
    }

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const fridgeId = await getFridgeIdByCondo(dbClient, condoId);
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);

        const userResult = await dbClient.query('SELECT credit_limit, credit_used FROM users WHERE id = $1 FOR UPDATE', [userId]);
        const currentUser = userResult.rows[0];

        const invoicesResult = await dbClient.query(
            "SELECT COALESCE(SUM(amount), 0)::float AS total FROM credit_invoices WHERE user_id = $1 AND status IN ('open', 'late')",
            [userId]
        );
        const pendingInvoicesAmount = invoicesResult.rows[0].total;
        const totalDebt = parseFloat(currentUser.credit_used) + pendingInvoicesAmount;
        const availableCredit = parseFloat(currentUser.credit_limit) - totalDebt;

        if (availableCredit < totalAmount) {
            throw new Error('Limite de crédito insuficiente. Pague suas faturas pendentes para liberar mais limite.');
        }

        await dbClient.query('UPDATE users SET credit_used = credit_used + $1 WHERE id = $2', [totalAmount, userId]);

        const newOrder = await dbClient.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method, fridge_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [userId, condoId, totalAmount, 'paid', 'credit', fridgeId]
        );
        const orderId = newOrder.rows[0].id;
        
        let productNames = items.map(item => item.name).join(', ');
        if (productNames.length > 255) productNames = productNames.substring(0, 252) + '...';
        const description = `Compra ${productNames}`;
        
        for (const item of items) {
            await dbClient.query('INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)', [orderId, item.id, item.quantity, item.sale_price]);
            await dbClient.query('UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3', [item.quantity, item.id, condoId]);
        }

        await dbClient.query(`INSERT INTO wallet_transactions (user_id, type, amount, related_order_id, description) VALUES ($1, 'credit_purchase', $2, $3, $4)`, [userId, totalAmount, orderId, description]);
        
        await dbClient.query('INSERT INTO unlock_commands (fridge_id) VALUES ($1)', [fridgeId]);
        
        await dbClient.query('COMMIT');
        res.status(201).json({ message: 'Compra com crédito realizada com sucesso!', orderId: orderId });

    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('ERRO AO PAGAR COM CRÉDITO:', error);
        res.status(500).json({ message: error.message || 'Erro interno ao processar pagamento com crédito.' });
    } finally {
        dbClient.release();
    }
};

exports.getOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;
    try {
        const orderResult = await pool.query('SELECT status FROM orders WHERE id = $1 AND user_id = $2', [parseInt(orderId, 10), userId]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        res.status(200).json({ status: orderResult.rows[0].status });
    } catch (error) {
        console.error(`[getOrderStatus] ERRO ao buscar pedido ${orderId}:`, error);
        return res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getUnlockStatus = async (req, res) => {
    const { orderId } = req.params;
    const userId = req.user.id;
    try {
        const result = await pool.query(
            'SELECT door_opened_at FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, userId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
        res.status(200).json({ doorOpened: !!result.rows[0].door_opened_at });
    } catch (error) {
        console.error(`Erro ao verificar status de abertura do pedido ${orderId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.confirmDoorOpened = async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) {
        return res.status(400).json({ message: 'ID do pedido é obrigatório.' });
    }
    try {
        const result = await pool.query(
            "UPDATE orders SET door_opened_at = NOW() WHERE id = $1 AND door_opened_at IS NULL RETURNING id",
            [orderId]
        );
        if (result.rowCount > 0) {
            console.log(`CONFIRMAÇÃO DE ABERTURA: Porta para o pedido ${orderId} foi aberta.`);
            res.status(200).json({ message: 'Confirmação de porta aberta recebida.' });
        } else {
            console.log(`AVISO: Recebida confirmação de abertura para o pedido ${orderId}, mas ele não foi encontrado ou já estava confirmado.`);
            res.status(404).json({ message: 'Pedido não encontrado ou já confirmado.' });
        }
    } catch (error) {
        console.error(`Erro ao confirmar abertura da porta para o pedido ${orderId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getActiveQRCodes = async (req, res) => {
    res.status(410).json({ message: "Esta funcionalidade foi descontinuada." });
};
