const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  // A configuração SSL é necessária para conexões com o Supabase no Render
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;