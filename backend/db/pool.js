// db/pool.js — PostgreSQL connection pool
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL || '';
const sslDisabled = dbUrl.includes('sslmode=disable') || dbUrl.includes('sslmode=no-verify');
const pool = new Pool({
  connectionString: dbUrl,
  ssl: sslDisabled ? false : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

module.exports = { pool };
