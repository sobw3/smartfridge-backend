// ===============================================================
// ARQUIVO: middleware/authMiddleware.js (VERSÃO CORRIGIDA E COMPLETA)
// ===============================================================
const jwt = require('jsonwebtoken');

// Middleware para proteger rotas de clientes
exports.protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Pega o token do header (Ex: "Bearer eyJhbGci...")
            token = req.headers.authorization.split(' ')[1];

            // Verifica o token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Adiciona os dados do utilizador (payload do token) à requisição
            // Não precisamos de buscar na base de dados por agora, o ID é suficiente
            req.user = decoded.user;
            next(); // Continua para a próxima função (o controller)

        } catch (error) {
            res.status(401).json({ message: 'Não autorizado, token inválido' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};

// Middleware para proteger rotas de administrador
exports.protectAdmin = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // VERIFICA SE O TOKEN PERTENCE A UM ADMIN
            if (decoded.isAdmin) {
                req.admin = decoded; // Adiciona os dados do admin à requisição
                next(); // Continua para a próxima função (o controller)
            } else {
                res.status(401).json({ message: 'Não autorizado, token não é de administrador' });
            }
        } catch (error) {
            res.status(401).json({ message: 'Não autorizado, token inválido' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Não autorizado, sem token' });
    }
};
