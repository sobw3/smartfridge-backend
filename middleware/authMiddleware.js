const jwt = require('jsonwebtoken');
const pool = require('../db');

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
            res.status(401).json({ message: 'Não autorizado, token inválido' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};

exports.protectAdmin = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (decoded.isAdmin) {
                req.admin = decoded;
                next();
            } else {
                res.status(403).json({ message: 'Acesso negado. Rota apenas para administradores.' });
            }
        } catch (error) {
            res.status(401).json({ message: 'Não autorizado, token de admin inválido' });
        }
    }
    if (!token) {
        res.status(401).json({ message: 'Não autorizado, sem token de admin' });
    }
};