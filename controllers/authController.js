// ===============================================================
// ARQUIVO: controllers/authController.js (VERSÃO ATUALIZADA)
// ===============================================================
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// --- Funções existentes (register, login, getMe, updateUserCondo) ---
exports.register = async (req, res) => {
    const { name, cpf, email, password, birth_date, condo_id } = req.body;
    if (!name || !cpf || !email || !password || !birth_date || !condo_id) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios.' });
    }
    try {
        const userExists = await pool.query("SELECT * FROM users WHERE cpf = $1 OR email = $2", [cpf, email]);
        if (userExists.rows.length > 0) {
            return res.status(409).json({ message: 'CPF ou e-mail já cadastrado.' });
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const newUser = await pool.query(
            "INSERT INTO users (name, cpf, email, password_hash, birth_date, condo_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email",
            [name, cpf, email, password_hash, birth_date, condo_id]
        );
        res.status(201).json({ message: 'Usuário cadastrado com sucesso!', user: newUser.rows[0] });
    } catch (error) {
        console.error('Erro no registro:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.login = async (req, res) => {
    const { cpf, password } = req.body;
    if (!cpf || !password) {
        return res.status(400).json({ message: 'CPF e senha são obrigatórios.' });
    }
    try {
        const userResult = await pool.query("SELECT * FROM users WHERE cpf = $1", [cpf]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = userResult.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'CPF ou senha inválidos.' });
        }
        const payload = { user: { id: user.id, name: user.name, condoId: user.condo_id, email: user.email } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({ message: 'Login bem-sucedido!', token, user: payload.user });
        });
    } catch (error) {
        console.error('Erro no login:', error.message);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const userResult = await pool.query('SELECT id, name, email, condo_id FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador do token não encontrado.' });
        }
        res.status(200).json(userResult.rows[0]);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar dados do utilizador.' });
    }
};

exports.updateUserCondo = async (req, res) => {
    const userId = req.user.id;
    const { condoId } = req.body;

    if (!condoId) {
        return res.status(400).json({ message: 'O ID do condomínio é obrigatório.' });
    }

    try {
        const updatedUser = await pool.query(
            'UPDATE users SET condo_id = $1 WHERE id = $2 RETURNING id, name, email, condo_id',
            [condoId, userId]
        );

        if (updatedUser.rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }
        
        const userPayload = {
            id: updatedUser.rows[0].id,
            name: updatedUser.rows[0].name,
            email: updatedUser.rows[0].email,
            condoId: updatedUser.rows[0].condo_id
        };

        res.status(200).json({ message: 'Condomínio atualizado com sucesso!', user: userPayload });

    } catch (error) {
        console.error('Erro ao atualizar condomínio do utilizador:', error);
        res.status(500).json({ message: 'Erro interno ao atualizar condomínio.' });
    }
};

// --- NOVA FUNÇÃO PARA ATUALIZAR OS DADOS DO UTILIZADOR ---
exports.updateMe = async (req, res) => {
    const userId = req.user.id;
    const { name, email, password, newPassword } = req.body;

    if (!name || !email) {
        return res.status(400).json({ message: 'Nome e e-mail são obrigatórios.' });
    }

    try {
        // Verifica se o novo e-mail já está em uso por outro utilizador
        const emailExists = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, userId]);
        if (emailExists.rows.length > 0) {
            return res.status(409).json({ message: 'Este e-mail já está em uso por outra conta.' });
        }

        let passwordHash = null;
        // Se o utilizador forneceu uma nova senha, temos de verificar a antiga
        if (newPassword) {
            if (!password) {
                return res.status(400).json({ message: 'A senha atual é necessária para definir uma nova.' });
            }
            const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            const user = userResult.rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);

            if (!isMatch) {
                return res.status(401).json({ message: 'A senha atual está incorreta.' });
            }
            // Gera o hash da nova senha
            const salt = await bcrypt.genSalt(10);
            passwordHash = await bcrypt.hash(newPassword, salt);
        }

        // Constrói a query de atualização dinamicamente
        let query;
        let queryParams;
        if (passwordHash) {
            query = 'UPDATE users SET name = $1, email = $2, password_hash = $3 WHERE id = $4 RETURNING id, name, email, condo_id';
            queryParams = [name, email, passwordHash, userId];
        } else {
            query = 'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, condo_id';
            queryParams = [name, email, userId];
        }

        const { rows } = await pool.query(query, queryParams);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Utilizador não encontrado.' });
        }

        res.status(200).json({ message: 'Dados atualizados com sucesso!', user: rows[0] });

    } catch (error) {
        console.error('Erro ao atualizar dados do utilizador:', error);
        res.status(500).json({ message: 'Erro interno ao atualizar os dados.' });
    }
};
