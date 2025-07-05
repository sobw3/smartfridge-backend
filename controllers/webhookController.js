const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.handleMercadoPagoWebhook = async (req, res) => {
    console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
    console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

    const { type, data } = req.body;

    if (type === 'payment') {
        console.log(`Notificação de pagamento recebida para o ID: ${data.id}`);
        try {
            console.log('A buscar detalhes do pagamento no Mercado Pago...');
            const paymentInfo = await new Payment(client).get({ id: data.id });
            const orderId = paymentInfo.external_reference;

            console.log(`Status do pagamento: ${paymentInfo.status}. ID do pedido interno: ${orderId}`);

            if (paymentInfo.status === 'approved') {
                console.log(`PAGAMENTO APROVADO para o pedido: ${orderId}. A atualizar a base de dados...`);

                await pool.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', data.id, orderId]);
                console.log(`Status do pedido ${orderId} atualizado para 'paid'.`);

                const orderItemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
                const { rows: [order] } = await pool.query('SELECT condo_id FROM orders WHERE id = $1', [orderId]);
                
                console.log(`Encontrados ${orderItemsResult.rows.length} itens para o pedido. A atualizar o inventário...`);
                for (const item of orderItemsResult.rows) {
                    await pool.query(
                        'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3',
                        [item.quantity, item.product_id, order.condo_id]
                    );
                    console.log(`Inventário do produto ${item.product_id} atualizado.`);
                }

                const token = crypto.randomBytes(16).toString('hex');
                const expires_at = new Date(Date.now() + 5 * 60 * 1000);
                await pool.query(
                    'INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)',
                    [token, orderId, expires_at]
                );
                console.log(`Token de desbloqueio gerado para o pedido ${orderId}.`);
            } else {
                console.log(`Status do pagamento não é 'approved' (${paymentInfo.status}). Nenhuma ação tomada.`);
            }
        } catch (error) {
            console.error('ERRO NO PROCESSAMENTO DO WEBHOOK:', error);
        }
    } else {
        console.log(`Tipo de evento recebido não é 'payment': ${type}. Ignorando.`);
    }

    res.sendStatus(200); // Responde 200 OK para o Mercado Pago em todos os casos.
};
