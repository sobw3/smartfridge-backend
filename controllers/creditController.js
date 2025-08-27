// CRIE ESTE NOVO ARQUIVO: controllers/creditController.js

const pool = require('../db');
const { MercadoPagoConfig, Payment } = require('mercadopago');

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

// Função para calcular o total da fatura (com taxas e juros)
const calculateInvoiceTotal = (user) => {
    const creditUsed = parseFloat(user.credit_used || 0);
    if (creditUsed <= 0) {
        return { total: 0, dueDate: null };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera a hora para comparações de dia inteiro

    // Cria a data de vencimento para o mês ATUAL
    let dueDate = new Date(today.getFullYear(), today.getMonth(), user.credit_due_day);

    // SE a data de hoje JÁ PASSOU da data de vencimento deste mês,
    // a fatura vencerá apenas no PRÓXIMO mês.
    if (today > dueDate) {
        dueDate.setMonth(dueDate.getMonth() + 1);
    }

    let total = creditUsed;
    const serviceFee = total * 0.10; // Taxa de serviço de 10%
    let interest = 0; // Juros por atraso

    // Apenas calcula juros se a data de hoje for DEPOIS da data de vencimento CORRETA
    if (today > dueDate) {
        const diffTime = Math.abs(today - dueDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        interest = total * 0.025 * diffDays; // Juros de 2.5% ao dia
    }

    return {
        base: creditUsed,
        serviceFee,
        interest,
        total: total + serviceFee + interest,
        dueDate: dueDate // Retorna a data de vencimento correta
    };
};


exports.createInvoicePixPayment = async (req, res) => {
    console.log('-> DENTRO DO creditController.createInvoicePixPayment');

    const userId = req.user.id;

    try {
        const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = userResult.rows[0];

        const invoice = calculateInvoiceTotal(user);

        if (invoice.total <= 0) {
            return res.status(400).json({ message: 'Não há fatura para pagar.' });
        }
        
        // A external_reference agora identifica que é um pagamento de fatura
        const externalReference = `credit_invoice_${userId}_${Date.now()}`;

        const paymentData = {
            body: {
                transaction_amount: parseFloat(invoice.total.toFixed(2)),
                description: `Pagamento da fatura SmartFridge (Valor: R$${invoice.base.toFixed(2)})`,
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
        
        // Enviamos os dados do PIX para o frontend
        res.status(201).json({
            paymentId: result.id,
            pix_qr_code: result.point_of_interaction.transaction_data.qr_code_base64,
            pix_qr_code_text: result.point_of_interaction.transaction_data.qr_code
        });

    } catch (error) {
        console.error('Erro ao gerar PIX para fatura:', error);
        res.status(500).json({ message: 'Falha ao gerar PIX para pagamento da fatura.' });
    }
};

exports.getInvoicesForUser = async (req, res) => {
    const { userId } = req.params;
    try {
        const { rows } = await pool.query(
            "SELECT id, amount, due_date, status, paid_at FROM credit_invoices WHERE user_id = $1 ORDER BY due_date DESC",
            [userId]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Erro ao buscar faturas para o usuário ${userId}:`, error);
        res.status(500).json({ message: 'Erro ao buscar histórico de faturas.' });
    }
};
