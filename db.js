const { Pool } = require('pg');
const { parse } = require('pg-connection-string'); // Importa o novo pacote
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

// "Desmonta" a connection string para obter as partes individuais
const config = parse(connectionString);

const pool = new Pool({
  user: config.user,
  password: config.password,
  host: config.host, // Força o uso do host específico (geralmente resolve para IPv4)
  port: config.port,
  database: config.database,
  ssl: {
    rejectUnauthorized: false
  }
});

// Testa a conexão ao iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('ERRO AO CONECTAR AO POOL DA BASE DE DADOS:', err);
  } else {
    console.log('Conexão com a base de dados estabelecida com sucesso em:', res.rows[0].now);
  }
});

module.exports = pool;