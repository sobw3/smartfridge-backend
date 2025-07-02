// ===============================================================
// ARQUIVO: controllers/walletController.js
// ===============================================================
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

    if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'O valor do depósito deve ser positivo.' });
    }

    try {
        const userResult = await pool.query('SELECT email, name FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        const user = userResult.rows[0];

        const externalReference = JSON.stringify({
            type: 'wallet_deposit',
            userId: userId,
            amount: amount
        });

        const paymentData = {
            body: {
                transaction_amount: parseFloat(amount),
                description: `Depósito na carteira SmartFridge - R$ ${amount}`,
                payment_method_id: 'pix',
                payer: {
                    email: user.email || `user-${userId}@smartfridge.com`,
                    first_name: user.name,
                },
                external_reference: externalReference,
            }
        };

        const result = await payment.create(paymentData);

        res.status(201).json({
            orderId: result.id,
            pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64,
            pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('Erro ao criar depósito no Mercado Pago:', error);
        res.status(500).json({ message: 'Falha ao criar depósito.' });
    }
};
