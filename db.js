const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Testa a conexão ao iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('ERRO AO CONECTAR À BASE DE DADOS LOCAL:', err);
  } else {
    console.log('Conexão com a base de dados local estabelecida com sucesso.');
  }
});

module.exports = pool;
