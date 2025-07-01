// ===============================================================
// ARQUIVO: controllers/productController.js (VERSÃO COM DEPURAÇÃO)
// ===============================================================
const pool = require('../db');

// --- Função para buscar produtos por condomínio (sem alterações) ---
exports.getProductsByCondo = async (req, res) => {
    const { condoId } = req.query;

    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }

    try {
        const query = `
            SELECT
                p.id,
                p.name,
                p.description,
                p.image_url,
                p.sale_price,
                i.quantity AS stock
            FROM products AS p
            JOIN inventory AS i ON p.id = i.product_id
            WHERE i.condo_id = $1 AND i.quantity > 0
        `;

        const productsResult = await pool.query(query, [condoId]);

        res.status(200).json(productsResult.rows);

    } catch (error) {
        console.error('Erro ao buscar produtos:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

// --- FUNÇÃO DE PESQUISA ATUALIZADA COM LOGS ---
exports.searchProductsByName = async (req, res) => {
    const { q, condoId } = req.query;

    // Log para ver o que o backend está a receber do frontend
    console.log(`--- Nova Pesquisa Recebida ---`);
    console.log(`Termo de pesquisa (q): ${q}`);
    console.log(`ID do Condomínio (condoId): ${condoId}`);
    
    if (!q || !condoId) {
        return res.status(400).json({ message: 'Termo de pesquisa e ID do condomínio são obrigatórios.' });
    }

    try {
        const searchTerm = `%${q}%`;
        const query = `
            SELECT
                p.id,
                p.name,
                p.image_url,
                p.sale_price
            FROM products AS p
            JOIN inventory AS i ON p.id = i.product_id
            WHERE 
                i.condo_id = $1 AND 
                i.quantity > 0 AND
                p.name ILIKE $2
            LIMIT 5; 
        `;

        const { rows } = await pool.query(query, [condoId, searchTerm]);
        
        // Log para ver o resultado da consulta
        console.log(`Query executada com sucesso. Encontrados ${rows.length} resultados.`);
        console.log(`---------------------------------`);

        res.status(200).json(rows);

    } catch (error) {
        console.error('!!!!!!!! ERRO NA PESQUISA DE PRODUTOS !!!!!!!!');
        console.error(error);
        console.error('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
        res.status(500).json({ message: 'Erro interno ao pesquisar produtos.' });
    }
};
