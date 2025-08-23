// controllers/fridgeController.js
const pool = require('../db');

// --- ATUALIZADO: Recebe 'fridgeId' para validação ---
exports.checkUnlock = async (req, res) => {
    const { unlockToken, fridgeId } = req.body; // <-- fridgeId adicionado

    if (!unlockToken || !fridgeId) {
        return res.status(400).json({ message: 'Token de desbloqueio e ID da geladeira são obrigatórios.' });
    }

    try {
        // --- ATUALIZADO: A query agora verifica o token E o ID da geladeira ---
        const tokenResult = await pool.query(
            'SELECT order_id FROM unlock_tokens WHERE token = $1 AND fridge_id = $2 AND is_used = false AND expires_at > NOW()',
            [unlockToken, fridgeId]
        );

        if (tokenResult.rows.length === 0) {
            console.log(`TENTATIVA DE DESBLOQUEIO FALHOU: Token ${unlockToken} inválido/expirado para a geladeira ${fridgeId}.`);
            return res.status(404).json({ unlock: false, message: 'Token inválido, expirado ou para outra geladeira.' });
        }

        const { order_id } = tokenResult.rows[0];

        // Marca o token como usado para que não possa ser reutilizado
        await pool.query('UPDATE unlock_tokens SET is_used = true WHERE token = $1', [unlockToken]);

        console.log(`DESBLOQUEIO AUTORIZADO: Token ${unlockToken} validado para a geladeira ${fridgeId}. Pedido associado: ${order_id}.`);
        
        // Responde ao Raspberry Pi que ele pode abrir a porta e envia o ID do pedido
        res.status(200).json({ 
            unlock: true, 
            message: 'Desbloqueio autorizado.',
            orderId: order_id // Envia o orderId para o Pi confirmar a abertura
        });

    } catch (error) {
        console.error('Erro ao verificar token de desbloqueio:', error);
        res.status(500).json({ unlock: false, message: 'Erro interno do servidor.' });
    }
};

// Função antiga, pode ser removida pois a lógica foi incorporada em `checkUnlock`
exports.unlockFridge = async (req, res) => {
    res.status(410).json({ message: "Esta rota foi descontinuada e sua lógica integrada em /check-unlock." });
};
