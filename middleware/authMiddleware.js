const jwt = require('jsonwebtoken');
const pool = require('../db');

// Middleware para proteger rotas de utilizadores normais
exports.protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const userResult = await pool.query('SELECT id, name, email, condo_id FROM users WHERE id = $1', [decoded.user.id]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'Utilizador não encontrado' });
            }
            req.user = userResult.rows[0];
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Não autorizado, token inválido' });
        }
    } else {
        return res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};

// Middleware para proteger rotas de administradores (COM LOGS DE DEPURAÇÃO)
exports.protectAdmin = (req, res, next) => {
    console.log('--- PROTECT ADMIN MIDDLEWARE INICIADO ---');
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        console.log('Authorization header encontrado.');
        try {
            token = req.headers.authorization.split(' ')[1];
            console.log('Token extraído:', token);

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decodificado com sucesso:', decoded);

            if (decoded && decoded.isAdmin) {
                console.log('SUCESSO: Token é de um administrador. Acesso permitido.');
                req.admin = decoded;
                next();
            } else {
                console.log('FALHA: Token válido, mas não é de um administrador.');
                return res.status(403).json({ message: 'Acesso negado. Rota apenas para administradores.' });
            }
        } catch (error) {
            console.error('ERRO: Falha na verificação do token:', error.message);
            return res.status(401).json({ message: 'Não autorizado, token de admin inválido' });
        }
    } else {
        console.log('FALHA: Nenhum header de autorização ou "Bearer" token encontrado.');
        return res.status(401).json({ message: 'Não autorizado, sem token de admin' });
    }
};
