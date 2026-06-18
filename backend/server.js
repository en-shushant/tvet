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
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, institute_id)
    )`,
    `ALTER TABLE assignment_occupations DROP CONSTRAINT IF EXISTS assignment_occupations_ctevt_occupation_id_fkey`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_gesi BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_residential BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_jv BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_role TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_partners INTEGER`,
    // EOI report fields (3A General / 3B Specific / 3C Geographic experience)
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nepal'`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS description_of_work TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS total_person_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS own_service_value NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_partner_names TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_partner_person_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS narrative_description TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS actual_services_description TEXT`,
    // Migration: relax users.role CHECK to allow 'editor' and 'superadmin'
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user','editor','viewer','superadmin'))`,
    `ALTER TABLE occupations ADD COLUMN IF NOT EXISTS level TEXT`,
    `DELETE FROM occupations WHERE is_custom = FALSE`,
    `ALTER TABLE assignment_occupations ADD COLUMN IF NOT EXISTS level TEXT`,
    // Description template + generation helper fields
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS desc_template_id TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS narrative_template_id TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS services_template_id TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS num_groups INTEGER`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_days INTEGER`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch(e) { console.warn('Migration skipped:', e.message); }
  }

  // Seed superadmin user if not exists
  try {
    const bcrypt = require('bcrypt');
    const existing = await pool.query(`SELECT id FROM users WHERE email='admin@tvettrack.local'`);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin@2024!', 10);
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active) VALUES ($1,$2,$3,'superadmin',TRUE)`,
        ['Super Admin', 'admin@tvettrack.local', hash]
      );
      console.log('Superadmin user created: admin@tvettrack.local');
    } else {
      // Ensure role is superadmin in case it was created with wrong role
      await pool.query(`UPDATE users SET role='superadmin' WHERE email='admin@tvettrack.local' AND role != 'superadmin'`);
    }
  } catch(e) { console.warn('Superadmin seed:', e.message); }
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

// ─── CAP CAPTCHA PROXY ───────────────────────────────────────────────────────
// Proxies /cap-api/* to the Cap server so the browser never makes HTTP requests
// from an HTTPS page (mixed content would be blocked).
const CAP_UPSTREAM = process.env.CAP_SERVER_URL || 'http://185.199.53.214:32769';
app.all('/cap-api/*', async (req, res) => {
  const upstreamPath = req.url.replace('/cap-api', '');
  const upstreamUrl  = `${CAP_UPSTREAM}${upstreamPath}`;
  try {
    const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
    const body    = req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body);
    const upstream = await fetch(upstreamUrl, { method: req.method, headers, body, signal: AbortSignal.timeout(10000) });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.status(upstream.status).set('Content-Type', contentType);
    if (contentType.includes('json')) {
      res.json(await upstream.json());
    } else {
      res.send(Buffer.from(await upstream.arrayBuffer()));
    }
  } catch (e) {
    res.status(502).json({ error: 'Cap server unreachable' });
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
app.use('/api/locations',    require('./routes/locations'));

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Run migrations before accepting connections
runMigrations()
  .then(() => console.log('Migrations OK'))
  .catch(e => console.error('Migration error:', e.message))
  .finally(() => {
    const server = app.listen(PORT, () => {
      console.log(`TVETtrack API running on port ${PORT}`);
    });
    server.keepAliveTimeout = 120000;
    server.headersTimeout = 125000;
  });
module.exports = app;
