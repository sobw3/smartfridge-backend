const pool = require('../db');

exports.checkUnlock = async (req, res) => {
    const { unlockToken } = req.body;

    if (!unlockToken) {
        return res.status(400).json({ message: 'Token de desbloqueio em falta.' });
    }

    try {
        const tokenResult = await pool.query(
            'SELECT * FROM unlock_tokens WHERE token = $1 AND is_used = false AND expires_at > NOW()',
            [unlockToken]
        );

        if (tokenResult.rows.length === 0) {
            return res.status(404).json({ unlock: false, message: 'Token inválido ou expirado.' });
        }

        // Marca o token como usado para que não possa ser reutilizado
        await pool.query('UPDATE unlock_tokens SET is_used = true WHERE token = $1', [unlockToken]);

        console.log(`DESBLOQUEIO AUTORIZADO: Token ${unlockToken} validado e utilizado.`);
        
        // Responde ao Raspberry Pi que ele pode abrir a porta
        res.status(200).json({ unlock: true, message: 'Desbloqueio autorizado.' });

    } catch (error) {
        console.error('Erro ao verificar token de desbloqueio:', error);
        res.status(500).json({ unlock: false, message: 'Erro interno do servidor.' });
    }
};
