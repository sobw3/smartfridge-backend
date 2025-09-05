const pool = require('../db');

exports.pollForUnlock = async (req, res) => {
    const { fridgeId } = req.params;
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const result = await dbClient.query(
            "SELECT id FROM unlock_commands WHERE fridge_id = $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE",
            [fridgeId]
        );

        if (result.rows.length > 0) {
            await dbClient.query("DELETE FROM unlock_commands WHERE id = $1", [result.rows[0].id]);
            await dbClient.query('COMMIT');
            console.log(`COMANDO DE DESBLOQUEIO ENVIADO PARA A GELADEIRA: ${fridgeId}`);
            return res.status(200).json({ unlock: true });
        } else {
            await dbClient.query('COMMIT');
            return res.status(404).json({ unlock: false, message: 'Nenhum comando pendente.' });
        }
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error(`Erro no polling da geladeira ${fridgeId}:`, error);
        res.status(500).json({ unlock: false, message: 'Erro interno.' });
    } finally {
        dbClient.release();
    }
};
