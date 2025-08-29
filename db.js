
// ARQUIVO: db.js (VERSÃO FINAL HÍBRIDA - LOCAL E PRODUÇÃO)

// ARQUIVO: db.js (VERSÃO FINAL E CORRIGIDA PARA PRODUÇÃO)


const { Pool } = require('pg');
require('dotenv').config();


let config;

// Verifica se a DATABASE_URL está disponível (para ambientes de produção como o Render)
if (process.env.DATABASE_URL) {
    console.log('A conectar à base de dados de produção...');
    config = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Exigido pelo Render
        }
    };
} else {
    // Caso contrário, usa a configuração para a base de dados local
    console.log('A conectar à base de dados local...');
    config = {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_DATABASE,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    };
}

const pool = new Pool(config);

// Testa a conexão ao iniciar
pool.connect()
    .then(() => console.log('Conexão com a base de dados estabelecida com sucesso.'))
    .catch(err => console.error('ERRO AO CONECTAR À BASE DE DADOS:', err));

// Objeto de configuração base que usa a connection string.
// Isto é o que o Render fornece.
const config = {
    connectionString: process.env.DATABASE_URL,
};

// Adiciona a configuração de SSL APENAS quando o código está a rodar em produção.
// O Render define a variável de ambiente NODE_ENV='production' automaticamente.
if (process.env.NODE_ENV === 'production') {
    config.ssl = {
        rejectUnauthorized: false
    };
}

// Cria a pool de conexões com a configuração correta.
const pool = new Pool(config);

// Testa a conexão ao iniciar para dar feedback claro nos logs.
pool.connect()
    .then(() => {
        console.log('Conexão com a base de dados estabelecida com sucesso.');
    })
    .catch(err => {
        console.error('ERRO AO CONECTAR À BASE DE DADOS:', err);
    });


module.exports = pool;
