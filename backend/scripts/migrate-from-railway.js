// One-time migration: Railway → Coolify PostgreSQL
// Run: node scripts/migrate-from-railway.js
require('dotenv').config();
const { Pool } = require('pg');

const src = new Pool({
  connectionString: 'postgresql://postgres:KMNvvsXXLxDDtbJUPpWvFSdkamlXPDUa@tramway.proxy.rlwy.net:51260/railway',
  ssl: { rejectUnauthorized: false },
});

const dst = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const TABLES = [
  'users',
  'institutes',
  'clients',
  'occupations',
  'assignments',
  'assignment_occupations',
  'assignment_locations',
  'assignment_templates',
  'affiliations',
  'affiliation_programs',
  'nstb_records',
  'tax_clearances',
  'institute_documents',
  'user_institutes',
];

async function migrate() {
  console.log('Starting migration from Railway → Coolify...\n');

  for (const table of TABLES) {
    try {
      const { rows } = await src.query(`SELECT * FROM ${table}`);
      if (rows.length === 0) { console.log(`  ${table}: 0 rows (skipped)`); continue; }

      const cols = Object.keys(rows[0]);
      const colList = cols.map(c => `"${c}"`).join(', ');

      // Disable triggers, truncate, re-enable
      await dst.query(`ALTER TABLE "${table}" DISABLE TRIGGER ALL`);
      await dst.query(`TRUNCATE TABLE "${table}" CASCADE`);

      let inserted = 0;
      for (const row of rows) {
        const vals = cols.map((_, i) => `$${i + 1}`).join(', ');
        const values = cols.map(c => row[c]);
        await dst.query(
          `INSERT INTO "${table}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING`,
          values
        );
        inserted++;
      }

      await dst.query(`ALTER TABLE "${table}" ENABLE TRIGGER ALL`);
      console.log(`  ✓ ${table}: ${inserted} rows`);
    } catch (e) {
      console.warn(`  ✗ ${table}: ${e.message}`);
    }
  }

  // Reset sequences
  console.log('\nResetting sequences...');
  const seqs = await dst.query(`
    SELECT sequence_name FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  `);
  for (const { sequence_name } of seqs.rows) {
    const table = sequence_name.replace(/_id_seq$/, '').replace(/_seq$/, '');
    try {
      await dst.query(`SELECT setval('${sequence_name}', COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
    } catch (_) {}
  }

  console.log('\nMigration complete.');
  await src.end();
  await dst.end();
}

migrate().catch(e => { console.error(e); process.exit(1); });
