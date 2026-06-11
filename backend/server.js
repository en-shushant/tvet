// TVETtrack Backend — server.js
// Node.js + Express + PostgreSQL
// Start: node server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { pool } = require('./db/pool');

const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' })); // large limit for base64 file uploads

// ─── STATIC FRONTEND ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── STARTUP MIGRATIONS ───────────────────────────────────────────────────────
async function runMigrations() {
  // Run full schema first (idempotent — uses IF NOT EXISTS / IF EXISTS)
  const fs = require('fs');
  const schemaPath = require('path').join(__dirname, 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('Schema OK');
    } catch(e) { console.warn('Schema warning:', e.message); }
  }
  const migrations = [
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS client_name_manual TEXT`,
    `ALTER TABLE assignment_occupations ADD COLUMN IF NOT EXISTS locations JSONB DEFAULT '[]'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS start_fy TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS end_fy TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS contract_value NUMERIC`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS logo TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS website TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS google_map_link TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS latitude NUMERIC`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS longitude NUMERIC`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT`,
    `CREATE TABLE IF NOT EXISTS user_institutes (
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, institute_id)
    )`,
    `ALTER TABLE assignment_occupations DROP CONSTRAINT IF EXISTS assignment_occupations_ctevt_occupation_id_fkey`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_gesi BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_residential BOOLEAN DEFAULT FALSE`,
    // Migration: relax users.role CHECK to allow 'editor' (Stage D)
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user','editor'))`,
    `ALTER TABLE occupations ADD COLUMN IF NOT EXISTS level TEXT`,
    `DELETE FROM occupations WHERE is_custom = FALSE`,
    `ALTER TABLE assignment_occupations ADD COLUMN IF NOT EXISTS level TEXT`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch(e) { console.warn('Migration skipped:', e.message); }
  }
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/institutes',   require('./routes/institutes'));
app.use('/api/assignments',  require('./routes/assignments'));
app.use('/api/nstb',         require('./routes/nstb'));
app.use('/api/tax',          require('./routes/tax'));
app.use('/api/affiliations', require('./routes/affiliations'));
app.use('/api/clients',      require('./routes/clients'));
app.use('/api/occupations',  require('./routes/occupations'));
app.use('/api/templates',    require('./routes/templates'));
app.use('/api/summary',      require('./routes/summary'));
app.use('/api/documents',    require('./routes/documents'));

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, async () => {
  console.log(`TVETtrack API running on port ${PORT}`);
  try { await runMigrations(); console.log('Migrations OK'); }
  catch(e) { console.error('Migration error:', e.message); }
});
server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;
module.exports = app;
