// ARQUIVO: controllers/webhookController.js (VERSÃO CORRIGIDA E FINAL)

const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');
const { createSystemTicket } = require('./ticketController');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.handleMercadoPagoWebhook = async (req, res) => {
    console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
    console.log('Query:', req.query);
    console.log('Body:', JSON.stringify(req.body, null, 2));

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

                // --- INÍCIO DA CORREÇÃO ---
                } else if (externalRef.startsWith('wallet_deposit_')) {
                    console.log(`Pagamento identificado como DEPÓSITO DE CARTEIRA para a referência: ${externalRef}`);
                    // Extrai o ID do utilizador e o valor da transação
                    const userId = externalRef.split('_')[2]; 
                    const amount = paymentInfo.transaction_amount; 

                    // CHAMA A FUNÇÃO PARA PROCESSAR O DEPÓSITO (esta linha estava em falta)
                    await processWalletDeposit({ userId, amount, paymentId });
                // --- FIM DA CORREÇÃO ---

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
    } else {
        console.log(`Tipo de evento recebido não é 'payment' ou ID do pagamento não encontrado.`);
    }

    res.sendStatus(200);
};

// Função para processar um DEPÓSITO na carteira
async function processWalletDeposit(depositInfo) {
    const { userId, amount, paymentId } = depositInfo;
    if (!userId || !amount || amount <= 0) {
        console.error(`Tentativa de depósito inválida. UserID: ${userId}, Amount: ${amount}`);
        return;
    }
    
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const updatedUser = await dbClient.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance',
            [amount, userId]
        );
        console.log(`Saldo do usuário ${userId} atualizado para ${updatedUser.rows[0].wallet_balance}`);
        
        await dbClient.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, description, payment_gateway_id) VALUES ($1, 'deposit', $2, $3, $4)`,
            [userId, amount, 'Depósito via PIX', paymentId]
        );
        console.log(`Transação de depósito de ${amount} registrada para o usuário ${userId}`);
        
        await dbClient.query('COMMIT');
        
        const depositMessage = `Confirmamos o seu depósito de R$ ${parseFloat(amount).toFixed(2)}. O valor já está disponível na sua carteira.`;
        await createSystemTicket(userId, depositMessage);

        console.log(`Transação de depósito para o usuário ${userId} completada com sucesso.`);
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`ERRO ao processar depósito para o usuário ${userId}:`, error);
        throw error;
    } finally {
        dbClient.release();
    }
}

// Função para processar uma COMPRA de produto
async function processProductPurchase(orderId, paymentGatewayId) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        
        await dbClient.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', paymentGatewayId, orderId]);
        console.log(`Status do pedido ${orderId} atualizado para 'paid'.`);

        const { rows: orderItems } = await dbClient.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
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

// Função para processar o PAGAMENTO DE UMA FATURA
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
