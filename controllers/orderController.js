const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.createPixOrder = async (req, res) => {
    const { items, user } = req.body;
    if (!items || items.length === 0 || !user || !user.cpf) {
        return res.status(400).json({ message: 'Dados do pedido ou do utilizador (incluindo CPF) são inválidos.' });
    }
    try {
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        
        const newOrder = await pool.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user.id, user.condoId, totalAmount, 'pending', 'pix']
        );
        const orderId = newOrder.rows[0].id;

        for (const item of items) {
            await pool.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity, item.sale_price]
            );
        }

        const paymentData = {
            body: {
                transaction_amount: totalAmount,
                description: `Pedido #${orderId} - SmartFridge Brasil`,
                payment_method_id: 'pix',
                payer: {
                    email: user.email,
                    first_name: user.name.split(' ')[0],
                    last_name: user.name.split(' ').slice(1).join(' ') || user.name.split(' ')[0],
                    identification: {
                        type: 'CPF',
                        number: user.cpf.replace(/\D/g, '')
                    },
                    address: {
                        zip_code: '01234-567',
                        street_name: 'Av. Exemplo',
                        street_number: '987',
                        neighborhood: 'Centro',
                        city: 'São Paulo',
                        federal_unit: 'SP'
                    }
                },
                external_reference: orderId.toString(),
            }
        };

        // --- LINHA DE DEPURAÇÃO ADICIONADA ---
        console.log("A ENVIAR PARA O MERCADO PAGO:", JSON.stringify(paymentData, null, 2));

        const result = await payment.create(paymentData);
        res.status(201).json({
            orderId: orderId,
            pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64,
            pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('ERRO DETALHADO AO CRIAR PEDIDO PIX:', error);
        const errorMessage = error.cause?.message || error.message || 'Falha ao criar pedido PIX.';
        res.status(500).json({ message: errorMessage });
    }
};

exports.createCardOrder = async (req, res) => {
    const { items, user, token, issuer_id, payment_method_id, installments } = req.body;
    if (!items || !token || !payment_method_id || !user || !user.cpf) {
        return res.status(400).json({ message: 'Dados de pagamento ou do utilizador (incluindo CPF) são incompletos.' });
    }
    const clientDB = await pool.connect();
    try {
        await clientDB.query('BEGIN');
        let totalAmount = items.reduce((sum, item) => sum + parseFloat(item.sale_price) * item.quantity, 0);
        const newOrder = await clientDB.query(
            'INSERT INTO orders (user_id, condo_id, total_amount, status, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [user.id, user.condoId, totalAmount, 'pending', 'card']
        );
        const orderId = newOrder.rows[0].id;
        for (const item of items) {
            await clientDB.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES ($1, $2, $3, $4)',
                [orderId, item.id, item.quantity, item.sale_price]
            );
        }
        const paymentData = {
            body: {
                transaction_amount: totalAmount,
                description: `Pedido #${orderId} - SmartFridge Brasil`,
                token: token,
                installments: installments,
                payment_method_id: payment_method_id,
                issuer_id: issuer_id,
                payer: {
                    email: user.email,
                    identification: {
                        type: 'CPF',
                        number: user.cpf.replace(/\D/g, '')
                    }
                },
                external_reference: orderId.toString(),
            }
        };
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
};

exports.simulatePaymentApproval = async (req, res) => {
    const { orderId } = req.params;
    try {
        const updatedOrder = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            ['paid', orderId]
        );
        if (updatedOrder.rows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado para simulação.' });
        }
        const orderItems = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
        const condoId = updatedOrder.rows[0].condo_id;
        for (const item of orderItems.rows) {
            await pool.query(
                'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3',
                [item.quantity, item.product_id, condoId]
            );
        }
        const token = crypto.randomBytes(16).toString('hex');
        const expires_at = new Date(Date.now() + 5 * 60 * 1000);
        await pool.query(
            'INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)',
            [token, orderId, expires_at]
        );
        res.status(200).json({
            message: 'Pagamento simulado e token gerado com sucesso.',
            unlockToken: token
        });
    } catch (error) {
        res.status(500).json({ message: 'Erro interno ao simular pagamento.' });
    }
};

exports.getOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    try {
        const orderResult = await pool.query('SELECT status FROM orders WHERE id = $1 AND user_id = $2', [orderId, req.user.id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ message: 'Pedido não encontrado.' });
        }
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
};
