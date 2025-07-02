const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('ERRO CRÍTICO: Variável de ambiente DATABASE_URL não está definida!');
    throw new Error("A variável de ambiente DATABASE_URL não está definida.");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
