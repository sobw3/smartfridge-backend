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

exports.pollForUnlock = async (req, res) => {
    const { fridgeId } = req.params;
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        // Procura por um comando de desbloqueio para esta geladeira
        const result = await dbClient.query(
            "SELECT id FROM unlock_commands WHERE fridge_id = $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
            [fridgeId]
        );

        if (result.rows.length > 0) {
            // Se encontrar um comando, apaga-o para não ser usado novamente
            await dbClient.query("DELETE FROM unlock_commands WHERE id = $1", [result.rows[0].id]);
            await dbClient.query('COMMIT');
            console.log(`COMANDO DE DESBLOQUEIO ENVIADO PARA A GELADEIRA: ${fridgeId}`);
            // E responde ao Pi para abrir a porta
            return res.status(200).json({ unlock: true });
        } else {
            await dbClient.query('COMMIT');
            // Se não encontrar, responde que não há nada a fazer
            return res.status(404).json({ unlock: false, message: 'Nenhum comando de desbloqueio pendente.' });
        }
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`Erro no polling da geladeira ${fridgeId}:`, error);
        res.status(500).json({ unlock: false, message: 'Erro interno do servidor.' });
    } finally {
        dbClient.release();
    }
};