const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.handleMercadoPagoWebhook = async (req, res) => {
    const { type, data } = req.body;

    if (type === 'payment') {
        try {
            const paymentInfo = await new Payment(client).get({ id: data.id });
            const orderId = paymentInfo.external_reference;

            if (paymentInfo.status === 'approved') {
                console.log(`Pagamento aprovado para o pedido: ${orderId}`);

                await pool.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', data.id, orderId]);

                const orderItems = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
                const { rows: [order] } = await pool.query('SELECT condo_id FROM orders WHERE id = $1', [orderId]);
                
                for (const item of orderItems.rows) {
                    await pool.query(
                        'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3',
                        [item.quantity, item.product_id, order.condo_id]
                    );
                }

                const token = crypto.randomBytes(16).toString('hex');
                const expires_at = new Date(Date.now() + 5 * 60 * 1000);
                await pool.query(
                    'INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)',
                    [token, orderId, expires_at]
                );
                console.log(`Token de desbloqueio gerado para o pedido ${orderId}: ${token}`);
            }
        } catch (error) {
            console.error('Erro no webhook do Mercado Pago:', error);
        }
    }

    res.sendStatus(200);
};