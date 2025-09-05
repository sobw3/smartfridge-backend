const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const { createSystemTicket } = require('./ticketController');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.handleMercadoPagoWebhook = async (req, res) => {
    console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
    const paymentType = req.body.type || req.query.type;
    const paymentId = req.body.data?.id || req.query['data.id'];

    if (paymentType === 'payment' && paymentId) {
        console.log(`Notificação de pagamento recebida para o ID: ${paymentId}`);
        try {
            const paymentInfo = await new Payment(client).get({ id: paymentId });
            console.log(`Status do pagamento no MP: ${paymentInfo.status}. Referência externa: ${paymentInfo.external_reference}`);

            if (paymentInfo.status === 'approved') {
                const externalRef = paymentInfo.external_reference;

                if (externalRef.startsWith('credit_invoice_')) {
                    console.log(`Pagamento identificado como PAGAMENTO DE FATURA para a referência: ${externalRef}`);
                    await processInvoicePayment(externalRef, paymentId);
                } else if (externalRef.startsWith('wallet_deposit_')) {
                    console.log(`Pagamento identificado como DEPÓSITO DE CARTEIRA para a referência: ${externalRef}`);
                    const userId = externalRef.split('_')[2]; 
                    const amount = paymentInfo.transaction_amount; 
                    await processWalletDeposit({ userId, amount, paymentId });
                } else {
                    console.log(`Pagamento identificado como COMPRA DE PRODUTO para o pedido ${externalRef}`);
                    await processProductPurchase(externalRef, paymentId);
                }
            } else {
                console.log(`Status do pagamento não é 'approved' (${paymentInfo.status}).`);
            }
        } catch (error) {
            console.error('ERRO NO PROCESSAMENTO DO WEBHOOK:', error);
        }
    }
    res.sendStatus(200);
};

async function processWalletDeposit(depositInfo) {
    // ... (esta função permanece a mesma)
}

async function processProductPurchase(orderId, paymentGatewayId) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        
        await dbClient.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', paymentGatewayId, orderId]);
        console.log(`Status do pedido ${orderId} atualizado para 'paid'.`);

        const { rows: orderItems } = await dbClient.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
        // CORREÇÃO: Busca o condo_id e o fridge_id diretamente do pedido, que já foi gravado corretamente.
        const { rows: [order] } = await dbClient.query('SELECT condo_id, fridge_id FROM orders WHERE id = $1', [orderId]);
        
        if (!order || !order.fridge_id) {
            throw new Error(`Pedido ${orderId} não encontrado ou não possui um ID de geladeira.`);
        }
        
        for (const item of orderItems) {
            await dbClient.query(
                'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3',
                [item.quantity, item.product_id, order.condo_id]
            );
        }
        console.log(`Inventário para o pedido ${orderId} atualizado.`);
        
        // Gera o comando de desbloqueio para a geladeira correta
        await dbClient.query(
            'INSERT INTO unlock_commands (fridge_id) VALUES ($1)',
            [order.fridge_id]
        );
        console.log(`Comando de desbloqueio gerado para a geladeira ${order.fridge_id}.`);

        await dbClient.query('COMMIT');
        console.log(`Transação de compra para o pedido ${orderId} completada com sucesso.`);
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`ERRO ao processar compra para o pedido ${orderId}:`, error);
        throw error;
    } finally {
        dbClient.release();
    }
}

async function processInvoicePayment(externalReference, paymentId) {
    const userId = externalReference.split('_')[2]; 

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query('UPDATE users SET credit_used = 0 WHERE id = $1', [userId]);

        await dbClient.query(
            `UPDATE credit_invoices 
             SET status = 'paid', paid_at = NOW(), related_payment_ref = $1
             WHERE user_id = $2 AND status IN ('open', 'late')`,
            [paymentId, userId]
        );
        console.log(`Fatura(s) e saldo devedor pagos para o utilizador ${userId}.`);
        
        await dbClient.query('COMMIT');

        const invoiceMessage = `Obrigado! Confirmamos o pagamento da sua fatura SmartFridge.`;
        await createSystemTicket(userId, invoiceMessage);
        
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`ERRO ao processar pagamento de fatura para o utilizador ${userId}:`, error);
        throw error;
    } finally {
        dbClient.release();
    }

}
