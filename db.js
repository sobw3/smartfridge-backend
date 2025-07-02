const { Pool } = require('pg');
const { parse } = require('pg-connection-string');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERRO CRÍTICO: Variável de ambiente DATABASE_URL não está definida!');
    throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

// "Desmonta" a connection string para obter as partes individuais
const config = parse(connectionString);

console.log('--- INICIANDO CONEXÃO COM O BANCO DE DADOS (FORÇANDO IPV4) ---');

const pool = new Pool({
  user: config.user,
  password: config.password,
  host: config.host,
  port: config.port,
  database: config.database,
  ssl: {
    rejectUnauthorized: false
  },
  family: 4, // <-- A CORREÇÃO DEFINITIVA: Força o uso de IPv4
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