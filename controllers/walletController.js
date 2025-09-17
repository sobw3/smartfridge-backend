const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

exports.getWalletBalance = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        res.status(200).json({ balance: result.rows[0].wallet_balance });
    } catch (error) {
        console.error('Erro ao buscar saldo da carteira:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.createDepositOrder = async (req, res) => {
    const userId = req.user.id;
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);
    const MIN_DEPOSIT = 1.00; 

    if (!depositAmount || depositAmount < MIN_DEPOSIT) {
        return res.status(400).json({ message: `O valor mínimo para depósito é de R$ ${MIN_DEPOSIT.toFixed(2)}.` });
    }

    try {
        const userResult = await pool.query('SELECT email, name, cpf FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        const user = userResult.rows[0];

        const externalReference = `wallet_deposit_${userId}_${Date.now()}`;

        const paymentData = {
            body: {
                transaction_amount: depositAmount,
                description: `Depósito na carteira SmartFridge - R$ ${depositAmount.toFixed(2)}`,
                payment_method_id: 'pix',
                payer: {
                    email: user.email,
                    first_name: user.name.split(' ')[0],
                    identification: { type: 'CPF', number: user.cpf.replace(/\D/g, '') }
                },
                external_reference: externalReference,
            }
        };

        const result = await payment.create(paymentData);
        
        res.status(201).json({
            orderId: result.id, // O ID do pagamento do Mercado Pago
            pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64,
            pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('Erro ao criar depósito PIX no Mercado Pago:', error);
        res.status(500).json({ message: 'Falha ao criar depósito PIX.' });
    }
};

// controllers/walletController.js

exports.depositWithCard = async (req, res) => {
    const userId = req.user.id;
    const { token, amount, cardholderName, cardholderCpf } = req.body;
    const depositAmount = parseFloat(amount);

    if (!token || !depositAmount || depositAmount <= 0) {
        return res.status(400).json({ message: 'Dados de pagamento incompletos ou valor inválido.' });
    }

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const userResult = await dbClient.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) throw new Error('Utilizador não encontrado.');
        const user = userResult.rows[0];

        const paymentData = {
            body: {
                transaction_amount: depositAmount,
                description: `Depósito na carteira SmartFridge`,
                token: token,
                installments: 1,
                payment_method_id: 'master', // O MP infere a bandeira a partir do token
                payer: {
                    email: user.email,
                    first_name: cardholderName.split(' ')[0],
                    last_name: cardholderName.split(' ').slice(1).join(' ') || cardholderName.split(' ')[0],
                    identification: { type: 'CPF', number: cardholderCpf.replace(/\D/g, '') }
                }
            }
        };
        
        const paymentResult = await payment.create(paymentData);
        
        if (paymentResult.status === 'approved') {
            await dbClient.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [depositAmount, userId]);
            await dbClient.query(
                `INSERT INTO wallet_transactions (user_id, type, amount, description, payment_gateway_id) VALUES ($1, 'deposit', $2, $3, $4)`,
                [userId, depositAmount, 'Depósito via Cartão de Crédito', paymentResult.id.toString()]
            );
            await dbClient.query('COMMIT');
            res.status(200).json({ message: 'Depósito aprovado e saldo adicionado com sucesso!' });
        } else {
            await dbClient.query('ROLLBACK');
            res.status(400).json({ message: `Pagamento recusado: ${paymentResult.status_detail}` });
        }
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Erro ao processar depósito com cartão:', error);
        res.status(500).json({ message: 'Falha ao processar depósito com cartão.' });
    } finally {
        dbClient.release();
    }
};

exports.getDepositStatus = async (req, res) => {
    const { paymentId } = req.params;
    try {
        const paymentInfo = await payment.get({ id: paymentId });
        res.status(200).json({ status: paymentInfo.status === 'approved' ? 'paid' : 'pending' });
    } catch (error) {
        console.error(`Erro ao verificar status do depósito ${paymentId}:`, error);
        res.status(500).json({ message: 'Erro ao verificar status do depósito.' });
    }
};

exports.getWalletTransactions = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
 const query = `
            SELECT 
                wt.id, 
                wt.type, 
                wt.amount, 
                wt.created_at, 
                wt.description,
                -- Subquery para somar a quantidade de itens de um pedido
                (CASE 
                    WHEN wt.type = 'purchase' THEN (
                        SELECT SUM(oi.quantity) 
                        FROM order_items oi 
                        WHERE oi.order_id = wt.related_order_id
                    )
                    ELSE NULL 
                END)::integer AS items_quantity
            FROM wallet_transactions wt
            WHERE wt.user_id = $1
            ORDER BY wt.created_at DESC
            LIMIT $2 OFFSET $3;
        `;
        const { rows } = await pool.query(query, [userId, limit, offset]);

        const totalQuery = "SELECT COUNT(*)::int FROM wallet_transactions WHERE user_id = $1";
        const totalResult = await pool.query(totalQuery, [userId]);

        res.status(200).json({
            transactions: rows,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
                total: totalResult.rows[0].count
            }
        });
    } catch (error) {
        console.error('Erro ao buscar histórico da carteira:', error);
        res.status(500).json({ message: 'Erro interno ao buscar histórico da carteira.' });
    }
};


exports.verifyRecipient = async (req, res) => {
    const { recipientEmail } = req.body;
    if (!recipientEmail) {
        return res.status(400).json({ message: 'O e-mail do destinatário é obrigatório.' });
    }
    try {
        const recipientResult = await pool.query('SELECT name, email FROM users WHERE email = $1', [recipientEmail]);
        if (recipientResult.rows.length === 0) {
            return res.status(404).json({ message: 'Nenhum usuário encontrado com este e-mail.' });
        }
        res.status(200).json(recipientResult.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao verificar destinatário.' });
    }
};

exports.transferBalance = async (req, res) => {
    const senderId = req.user.id;
    const { recipientEmail, amount } = req.body;
    const transferAmount = parseFloat(amount);

    if (!recipientEmail || !transferAmount || transferAmount <= 0) {
        return res.status(400).json({ message: 'E-mail do destinatário e um valor positivo são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const senderResult = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [senderId]);
        const sender = senderResult.rows[0];

        const recipientResult = await client.query('SELECT * FROM users WHERE email = $1 FOR UPDATE', [recipientEmail]);
        if (recipientResult.rows.length === 0) throw new Error('Destinatário não encontrado.');
        
        const recipient = recipientResult.rows[0];

        if (sender.id === recipient.id) throw new Error('Você não pode transferir para si mesmo.');
        if (sender.wallet_balance < transferAmount) throw new Error('Saldo insuficiente.');

        await client.query('UPDATE users SET wallet_balance = wallet_balance - $1 WHERE id = $2', [transferAmount, sender.id]);
        await client.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE id = $2', [transferAmount, recipient.id]);

        const senderTransaction = await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES ($1, 'transfer_out', $2, $3) RETURNING id`,
            [sender.id, transferAmount, `Transferência enviada para ${recipient.name}`]
        );
        await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES ($1, 'transfer_in', $2, $3)`,
            [recipient.id, transferAmount, `Transferência recebida de ${sender.name}`]
        );
        
        const transactionId = senderTransaction.rows[0].id;

        await client.query('COMMIT');
        
        res.status(200).json({ message: 'Transferência realizada com sucesso!', transactionId });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro na transferência de saldo:", error);
        res.status(400).json({ message: error.message || 'Não foi possível completar a transferência.' });
    } finally {
        client.release();
    }
};

// PONTO 5: Função de detalhes da transação atualizada
exports.getTransactionDetails = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id; 

    try {
        const query = `
            SELECT id, type, amount, created_at, description, related_order_id
            FROM wallet_transactions
            WHERE id = $1 AND user_id = $2
        `;
        const { rows } = await pool.query(query, [id, userId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Comprovante não encontrado ou pertence a outro usuário." });
        }
        
        let transactionDetails = rows[0];

        // Se for uma compra, busca os itens do pedido
        if ((transactionDetails.type === 'purchase' || transactionDetails.type === 'credit_purchase') && transactionDetails.related_order_id) {
            const itemsQuery = `
                SELECT oi.quantity, oi.price_at_purchase, p.name as product_name, p.id as product_id
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = $1;
            `;
            const { rows: items } = await pool.query(itemsQuery, [transactionDetails.related_order_id]);
            transactionDetails.items = items;
        }

        // Se for uma transferência de saída, busca os dados do destinatário
        if (transactionDetails.type === 'transfer_out' && transactionDetails.description) {
            const recipientName = transactionDetails.description.replace('Transferência enviada para ', '');
            const recipientQuery = `
                SELECT u.name, u.email, c.name as condominium_name 
                FROM users u
                LEFT JOIN condominiums c ON u.condo_id = c.id
                WHERE u.name = $1
            `;
            const recipientResult = await pool.query(recipientQuery, [recipientName]);
            if (recipientResult.rows.length > 0) {
                transactionDetails.recipient = recipientResult.rows[0];
            }
        }

        res.status(200).json(transactionDetails);
    } catch (error) {
        console.error("Erro ao buscar detalhes do comprovante:", error);
        res.status(500).json({ message: "Erro ao buscar detalhes do comprovante." });
    }
};

