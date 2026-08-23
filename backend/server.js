require('dotenv').config();
const fastify = require('fastify')({
  bodyLimit: 20 * 1024 * 1024, // 20 MB — needed for base64 letterhead/stamp/sign images
  logger: {
    level: 'warn',
    serializers: {
      req(req) {
        const out = { method: req.method, url: req.url };
        // Never log auth request bodies (contain passwords)
        if (!req.url?.includes('/auth/')) out.body = req.body;
        return out;
      },
    },
  },
});
const path = require('path');
const { pool } = require('./db/pool');

// ─── PLUGINS ─────────────────────────────────────────────────────────────────
fastify.register(require('@fastify/compress'));
fastify.register(require('@fastify/helmet'), { contentSecurityPolicy: false });
fastify.register(require('@fastify/cors'), { origin: '*' });
fastify.register(require('@fastify/rate-limit'), {
  global: false,
});

// Static frontend (must be registered before routes so SPA fallback works)
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  immutable: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
  wildcard: false,
});

/**
 * index.html must never be cached immutably.
 *
 * It is the file that names the hashed bundles, so a cached copy pins a browser
 * to whichever deploy it first saw — new code ships and nobody sees it. The
 * static plugin's setHeaders only fires for paths it resolves itself, so a
 * request for "/" or any SPA route served through the not-found handler was
 * still going out with the plugin-level `immutable, max-age=7 days`.
 *
 * Hashed assets keep the long cache; only the HTML is forced to revalidate.
 */
fastify.addHook('onSend', async (request, reply, payload) => {
  const type = String(reply.getHeader('content-type') || '');
  if (type.includes('text/html')) {
    reply.header('Cache-Control', 'no-cache, must-revalidate');
  }
  return payload;
});

// ─── STARTUP MIGRATIONS ───────────────────────────────────────────────────────
async function runMigrations() {
  const fs = require('fs');
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
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
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nepal'`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS description_of_work TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS total_person_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS own_service_value NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_partner_names TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jv_partner_person_months NUMERIC`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS narrative_description TEXT`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS actual_services_description TEXT`,
    `ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`,
    `ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','user','editor','viewer','superadmin','shortlist'))`,
    `ALTER TABLE occupations ADD COLUMN IF NOT EXISTS level TEXT`,
    `DELETE FROM occupations WHERE is_custom = FALSE AND NOT EXISTS (SELECT 1 FROM assignment_occupations ao WHERE ao.ctevt_occupation_id = occupations.id)`,
    `ALTER TABLE assignment_occupations ADD COLUMN IF NOT EXISTS level TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS desc_template_id TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS narrative_template_id TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS services_template_id TEXT`,
    // Restricted assignments: only a superadmin may create, see or report on
    // these. Defaults FALSE so every existing row stays visible to everyone.
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_superadmin_only BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS num_groups INTEGER`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_days INTEGER`,
    // Bolpatra / Standard EOI — Section 2 (Applicant's Information Form) firm profile
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS constitution_type TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS fax TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS contact_designation TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS local_agent TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS org_profile TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS total_staff INTEGER`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS professional_staff INTEGER`,
    // Bolpatra 3(B) — "No. of Staff" per assignment, and the firm's key-staff
    // roster (name + position) that "Name of Senior Staff ... Involved and
    // Functions Performed" is auto-written from, the same way the three
    // narrative fields are written from their assigned templates.
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS staff_count INTEGER`,
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS senior_staff_description TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS key_staff JSONB DEFAULT '[]'`,
    // Projects whose assignments include on-the-job training (EVENT, RERP/SAMRIDDHI,
    // ENSSURE). Drives the OJT step in the 3(B) services templates.
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS includes_ojt BOOLEAN DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS occupation_tools (
      id SERIAL PRIMARY KEY,
      occupation_id INTEGER NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
      level TEXT NOT NULL,
      name TEXT,
      description TEXT NOT NULL,
      unit TEXT,
      quantity NUMERIC,
      ownership TEXT DEFAULT 'Own',
      type TEXT DEFAULT 'Tool',
      remarks TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE occupation_tools ADD COLUMN IF NOT EXISTS name TEXT`,
    `ALTER TABLE occupation_tools ALTER COLUMN description DROP NOT NULL`,
    `CREATE TABLE IF NOT EXISTS institute_infrastructure (
      id SERIAL PRIMARY KEY,
      institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
      particular TEXT NOT NULL,
      description TEXT,
      unit TEXT,
      size TEXT,
      ownership TEXT DEFAULT 'Own',
      remark TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `ALTER TABLE institute_infrastructure ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'Own'`,
    `CREATE TABLE IF NOT EXISTS shortlists (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
      standing_list_name TEXT,
      shortlist_date DATE NOT NULL,
      valid_until DATE,
      status TEXT DEFAULT 'Active',
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS fy TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS is_shortlisting_only BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS client_name_manual TEXT`,
    `ALTER TABLE institutes ALTER COLUMN reg_no DROP NOT NULL`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS website TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS signatory_name TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS signatory_position TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS letterhead TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS name_np TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_np TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS letterhead TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS sign TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS stamp TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS ocr_registration TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS ocr_renewal TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS vat_registration TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS vat_extension TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS ctevt_affiliation TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS ctevt_renewal TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS name_np TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS address_np TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS contact_person_np TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS tax_clearance_doc TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS letter_top_margin NUMERIC`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS letter_lr_padding NUMERIC`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS letter_bottom_padding NUMERIC`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS mobile TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS service_type TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS local_level_registration TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS local_level_renewal TEXT`,
    `ALTER TABLE institutes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS contract_amount BIGINT`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS shortlist_doc TEXT`,
    // A standing list is created first, then firms are assigned to it. Existing
    // shortlist rows predate this and keep standing_list_id NULL — they stay
    // valid and are shown as ungrouped legacy entries.
    `CREATE TABLE IF NOT EXISTS standing_lists (
      id                 SERIAL PRIMARY KEY,
      client_id          INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name_manual TEXT,
      name               TEXT,
      fy                 TEXT,
      list_date          DATE,
      valid_until        DATE,
      status             TEXT DEFAULT 'Active',
      remarks            TEXT,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE standing_lists ADD COLUMN IF NOT EXISTS client_address_manual TEXT`,
    `ALTER TABLE standing_lists ADD COLUMN IF NOT EXISTS addressee TEXT`,
    `ALTER TABLE standing_lists ADD COLUMN IF NOT EXISTS client_name2_manual TEXT`,
    `ALTER TABLE standing_lists ADD COLUMN IF NOT EXISTS letter_type TEXT DEFAULT 'basic'`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS standing_list_id INTEGER REFERENCES standing_lists(id) ON DELETE CASCADE`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS client_address_manual TEXT`,
    `ALTER TABLE shortlists ADD COLUMN IF NOT EXISTS letter_type TEXT DEFAULT 'basic'`,
    `CREATE INDEX IF NOT EXISTS idx_shortlists_standing_list ON shortlists(standing_list_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignments_institute ON assignments(institute_id)`,
    `CREATE INDEX IF NOT EXISTS idx_assignment_occ_assignment ON assignment_occupations(assignment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tax_clearances_institute ON tax_clearances(institute_id)`,
    `CREATE INDEX IF NOT EXISTS idx_nstb_records_institute ON nstb_records(institute_id)`,
    `CREATE INDEX IF NOT EXISTS idx_affiliations_institute ON affiliations(institute_id)`,
    `CREATE INDEX IF NOT EXISTS idx_affiliation_programs_affiliation ON affiliation_programs(affiliation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_shortlists_institute ON shortlists(institute_id)`,
    `CREATE INDEX IF NOT EXISTS idx_shortlists_client ON shortlists(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_user_institutes_user ON user_institutes(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_institutes_status ON institutes(status)`,
    `CREATE INDEX IF NOT EXISTS idx_institutes_name ON institutes(name)`,
    `CREATE TABLE IF NOT EXISTS contracts (
      id                SERIAL PRIMARY KEY,
      client_id         INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name_manual TEXT,
      fy                TEXT NOT NULL,
      title             TEXT NOT NULL,
      description       TEXT,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS quotations (
      id               SERIAL PRIMARY KEY,
      contract_id      INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      shortlist_id     INTEGER NOT NULL REFERENCES shortlists(id) ON DELETE CASCADE,
      quotation_date   DATE,
      quoted_amount    BIGINT,
      status           TEXT NOT NULL DEFAULT 'Quoted',
      contract_amount  BIGINT,
      agreement_doc    TEXT,
      remarks          TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )`,
    // These three Civil/Construction trades had their tools lists entered under
    // level 'N/A' instead of 'Level 1', so the tools never appeared under any
    // level the EOI/report pickers actually offer (Level 1/2/3, Professional) —
    // the master-data screen showed a Total count but every level column read
    // "—". Idempotent: after the first run no rows match and this is a no-op.
    `UPDATE occupation_tools SET level = 'Level 1'
     WHERE level = 'N/A' AND occupation_id IN (
       SELECT id FROM occupations WHERE name IN (
         'Project Planning and Road Asset Management Training',
         'Road Asset Management and Maintenance training',
         'Road Construction and Supervision Training'
       )
     )`,
    // The exact-match version above still left two of the three trades on
    // "N/A" — their stored level text apparently isn't the literal string
    // 'N/A' (stray whitespace/casing, e.g. 'n/a' or ' N/A '). Match anything
    // that reads as "not applicable" once trimmed and case-folded, still
    // scoped to just these occupations and matched the same tolerant way.
    `UPDATE occupation_tools SET level = 'Level 1'
     WHERE TRIM(LOWER(level)) IN ('n/a', 'na') AND occupation_id IN (
       SELECT id FROM occupations WHERE TRIM(LOWER(name)) IN (
         'project planning and road asset management training',
         'road asset management and maintenance training'
       )
     )`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); }
    catch(e) { console.warn('Migration skipped:', e.message); }
  }
  try {
    const bcrypt = require('bcrypt');
    const existing = await pool.query(`SELECT id FROM users WHERE email='admin@tvettrack.local'`);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash('Admin@2024!', 10);
      await pool.query(
        `INSERT INTO users (name, email, password, role, is_active) VALUES ($1,$2,$3,'superadmin',TRUE)`,
        ['Super Admin', 'admin@tvettrack.local', hash]
      );
      console.log('Superadmin user created');
    } else {
      await pool.query(`UPDATE users SET role='superadmin' WHERE email='admin@tvettrack.local' AND role != 'superadmin'`);
    }
  } catch(e) { console.warn('Superadmin seed:', e.message); }
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
fastify.get('/health', async (request, reply) => {
  try {
    await pool.query('SELECT 1');
    return { status: 'ok', db: 'connected', time: new Date().toISOString() };
  } catch (e) {
    return reply.code(500).send({ status: 'error', message: e.message });
  }
});

// ─── CAP CAPTCHA PROXY ────────────────────────────────────────────────────────
const CAP_UPSTREAM = process.env.CAP_SERVER_URL || 'http://185.199.53.214:32769';
fastify.all('/cap-api/*', async (request, reply) => {
  const upstreamPath = request.url.replace('/cap-api', '');
  const upstreamUrl = `${CAP_UPSTREAM}${upstreamPath}`;
  try {
    const headers = { 'Content-Type': request.headers['content-type'] || 'application/json' };
    const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : JSON.stringify(request.body);
    const upstream = await fetch(upstreamUrl, { method: request.method, headers, body, signal: AbortSignal.timeout(10000) });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    reply.code(upstream.status).header('content-type', contentType);
    if (contentType.includes('json')) {
      return reply.send(await upstream.json());
    } else {
      return reply.send(Buffer.from(await upstream.arrayBuffer()));
    }
  } catch (e) {
    return reply.code(502).send({ error: 'Cap server unreachable' });
  }
});

// ─── ROUTES ──────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

fastify.register(require('./routes/auth'),            { prefix: '/api/auth' });
fastify.register(require('./routes/users'),           { prefix: '/api/users' });
fastify.register(require('./routes/institutes'),      { prefix: '/api/institutes' });
fastify.register(require('./routes/assignments'),     { prefix: '/api/assignments' });
fastify.register(require('./routes/nstb'),            { prefix: '/api/nstb' });
fastify.register(require('./routes/tax'),             { prefix: '/api/tax' });
fastify.register(require('./routes/affiliations'),    { prefix: '/api/affiliations' });
fastify.register(require('./routes/clients'),         { prefix: '/api/clients' });
fastify.register(require('./routes/occupations'),     { prefix: '/api/occupations' });
fastify.register(require('./routes/templates'),       { prefix: '/api/templates' });
fastify.register(require('./routes/summary'),         { prefix: '/api/summary' });
fastify.register(require('./routes/documents'),       { prefix: '/api/documents' });
fastify.register(require('./routes/locations'),       { prefix: '/api/locations' });
fastify.register(require('./routes/occupation-tools'), { prefix: '/api/occupation-tools' });
fastify.register(require('./routes/infrastructure'),   { prefix: '/api/infrastructure' });
fastify.register(require('./routes/dashboard'),        { prefix: '/api/dashboard' });
fastify.register(require('./routes/shortlists'),       { prefix: '/api/shortlists' });
fastify.register(require('./routes/standingLists'),   { prefix: '/api/standing-lists' });
fastify.register(require('./routes/contracts'),        { prefix: '/api/contracts' });
fastify.register(require('./routes/quotations'),       { prefix: '/api/quotations' });
fastify.register(require('./routes/upload'),           { prefix: '/api/upload' });

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
/**
 * A request for a hashed chunk that a redeploy has just deleted must 404, not
 * fall through to index.html.
 *
 * The app is code-split (Vite lazily imports each route, e.g.
 * ReportsView-<hash>.js), so a browser tab that has been open across a deploy —
 * or one that loaded index.html in the instant before the new build replaced
 * the old files underneath it — asks for a chunk that no longer exists. Before
 * this guard, that request fell into the catch-all below and got back
 * index.html's markup with a 200. The browser then tried to run that HTML as
 * the JS module it asked for, which is a SyntaxError, not a 404 — so it never
 * surfaced as a clean, catchable load failure, just a blank page until a
 * manual reload picked up the new index.html.
 */
const ASSET_PATH = /\.[a-zA-Z0-9]+$/;
fastify.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith('/api/')) {
    return reply.code(404).send({ error: 'Not found' });
  }
  if (ASSET_PATH.test(request.url.split('?')[0])) {
    return reply.code(404).send('Not found');
  }
  return reply.sendFile('index.html');
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
fastify.setErrorHandler((err, request, reply) => {
  console.error(err);
  reply.code(err.statusCode || 500).send({ error: err.message || 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
runMigrations()
  .then(() => console.log('Migrations OK'))
  .catch(e => console.error('Migration error:', e.message))
  .finally(() => {
    fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
      if (err) { console.error(err); process.exit(1); }
      console.log(`TVETtrack API running on port ${PORT}`);
    });
  });

module.exports = fastify;
