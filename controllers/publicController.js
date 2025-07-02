// ===============================================================
// ARQUIVO: controllers/publicController.js
// Lógica para rotas públicas, como listar condomínios para cadastro.
// ===============================================================
const pool = require('../db');

// --- Função para Listar Condomínios Disponíveis ---
exports.getAvailableCondominiums = async (req, res) => {
    try {
        const allCondos = await pool.query("SELECT id, name FROM condominiums ORDER BY name ASC");
        res.status(200).json(allCondos.rows);
    } catch (error) {
        console.error("Erro ao buscar condomínios públicos:", error.message);
        res.status(500).json({ message: error.message });
    }
};
