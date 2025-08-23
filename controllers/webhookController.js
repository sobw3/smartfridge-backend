// ARQUIVO: controllers/webhookController.js (CORRIGIDO)

const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

exports.handleMercadoPagoWebhook = async (req, res) => {
    console.log('--- WEBHOOK DO MERCADO PAGO RECEBIDO ---');
    console.log('Query:', req.query);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // --- CORREÇÃO AQUI ---
    // Procura o tipo e o ID tanto no corpo (body) quanto na URL (query)
    const paymentType = req.body.type || req.query.type;
    const paymentId = req.body.data?.id || req.query['data.id'];

    if (paymentType === 'payment' && paymentId) {
        console.log(`Notificação de pagamento recebida para o ID: ${paymentId}`);
        try {
            const paymentInfo = await new Payment(client).get({ id: paymentId });
            console.log(`Status do pagamento no MP: ${paymentInfo.status}. Referência externa: ${paymentInfo.external_reference}`);

            if (paymentInfo.status === 'approved') {
                const externalRef = paymentInfo.external_reference;

                // CORREÇÃO APLICADA AQUI
                // O bloco 'try' foi movido para fora e um 'catch' foi adicionado.
                if (externalRef.startsWith('credit_invoice_')) {
                    console.log(`Pagamento identificado como PAGAMENTO DE FATURA para a referência: ${externalRef}`);
                    await processInvoicePayment(externalRef);
                } else if (externalRef.startsWith('wallet_deposit_')) {
                    console.log(`Pagamento identificado como DEPÓSITO DE CARTEIRA para a referência: ${externalRef}`);
                    // A lógica de depósito permanece a mesma
                } else {
                    console.log(`Pagamento identificado como COMPRA DE PRODUTO para o pedido ${externalRef}`);
                    await processProductPurchase(externalRef, paymentId);
                }
            } else {
                console.log(`Status do pagamento não é 'approved' (${paymentInfo.status}). Nenhuma ação no banco de dados.`);
            }
        } catch (error) {
            console.error('ERRO NO PROCESSAMENTO DO WEBHOOK:', error);
        }
    } else {
        console.log(`Tipo de evento recebido não é 'payment' ou ID do pagamento não encontrado. Ignorando.`);
    }

    res.sendStatus(200);
};

// Função para processar um DEPÓSITO na carteira
async function processWalletDeposit(depositInfo) {
    const { userId, amount } = depositInfo;
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN'); // Inicia a transação

        // 1. Adiciona o saldo na conta do usuário
        const updatedUser = await dbClient.query(
            'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2 RETURNING wallet_balance',
            [amount, userId]
        );
        console.log(`Saldo do usuário ${userId} atualizado para ${updatedUser.rows[0].wallet_balance}`);
        
        // 2. Registra a transação no histórico da carteira
        await dbClient.query(
            `INSERT INTO wallet_transactions (user_id, type, amount) VALUES ($1, 'deposit', $2)`,
            [userId, amount]
        );
        console.log(`Transação de depósito de ${amount} registrada para o usuário ${userId}`);
        
        await dbClient.query('COMMIT'); // Confirma a transação
        console.log(`Transação de depósito para o usuário ${userId} completada com sucesso.`);
    } catch (error) {
        await dbClient.query('ROLLBACK'); // Desfaz tudo em caso de erro
        console.error(`ERRO ao processar depósito para o usuário ${userId}:`, error);
        throw error; // Propaga o erro para o log principal
    } finally {
        dbClient.release(); // Libera a conexão com o banco
    }
}

// Função para processar uma COMPRA de produto
async function processProductPurchase(orderId, paymentGatewayId) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN'); // Inicia a transação
        
        // 1. Atualiza o status do pedido para 'pago'
        await dbClient.query('UPDATE orders SET status = $1, payment_gateway_id = $2 WHERE id = $3', ['paid', paymentGatewayId, orderId]);
        console.log(`Status do pedido ${orderId} atualizado para 'paid'.`);

        // 2. Busca os itens do pedido para abater do estoque
        const { rows: orderItems } = await dbClient.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
        const { rows: [order] } = await dbClient.query('SELECT condo_id FROM orders WHERE id = $1', [orderId]);
        
        // 3. Atualiza o inventário
        console.log(`Encontrados ${orderItems.length} itens para o pedido ${orderId}. Atualizando o inventário...`);
        for (const item of orderItems) {
            await dbClient.query(
                'UPDATE inventory SET quantity = quantity - $1 WHERE product_id = $2 AND condo_id = $3',
                [item.quantity, item.product_id, order.condo_id]
            );
        }
        console.log(`Inventário para o pedido ${orderId} atualizado.`);

        // 4. Gera o token de desbloqueio
        const unlockToken = crypto.randomBytes(16).toString('hex');
        const expires_at = new Date(Date.now() + 5 * 60 * 1000); // Expira em 5 minutos
        await dbClient.query(
            'INSERT INTO unlock_tokens (token, order_id, expires_at) VALUES ($1, $2, $3)',
            [unlockToken, orderId, expires_at]
        );
        console.log(`Token de desbloqueio gerado para o pedido ${orderId}.`);

        await dbClient.query('COMMIT'); // Confirma a transação
        console.log(`Transação de compra para o pedido ${orderId} completada com sucesso.`);
    } catch (error) {
        await dbClient.query('ROLLBACK'); // Desfaz tudo em caso de erro
        console.error(`ERRO ao processar compra para o pedido ${orderId}:`, error);
        throw error; // Propaga o erro
    } finally {
        dbClient.release(); // Libera a conexão
    }
}

async function processInvoicePayment(externalReference) {
    // Extrai o ID do usuário da referência. Ex: "credit_invoice_123_1660601400000"
    const userId = externalReference.split('_')[2]; 

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        // Zera o crédito utilizado pelo usuário
        const updateResult = await dbClient.query(
            'UPDATE users SET credit_used = 0 WHERE id = $1 RETURNING credit_used',
            [userId]
        );

        console.log(`Fatura paga para o usuário ${userId}. Crédito utilizado zerado.`);
        
        // Opcional: Registrar o pagamento em uma tabela de "invoice_payments"
        // await dbClient.query('INSERT INTO invoice_payments (...) VALUES (...)');

        await dbClient.query('COMMIT');
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`ERRO ao processar pagamento de fatura para o usuário ${userId}:`, error);
        throw error;
    } finally {
        dbClient.release();
    }
}