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
    // Work still in progress. It belongs in the Current Portfolio, which is
    // explicitly "implementing or have implemented", but not in the experience
    // tables — those report skill-test and employment outcomes that a training
    // still running has not produced yet.
    `ALTER TABLE assignments ADD COLUMN IF NOT EXISTS is_ongoing BOOLEAN DEFAULT FALSE`,
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

    // ─── Human resource pool ─────────────────────────────────────────────────
    // Trainers and support staff the organisation can propose against a tender.
    // One pool for the whole system rather than one roster per institute: the
    // same trainer is put forward by whichever firm is bidding, and duplicating
    // the person per firm would mean their certificates diverge.
    //
    // Personal data — citizenship numbers, CVs, addresses — so access is a
    // permission granted per user rather than a role tier.
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_hr BOOLEAN DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS hr_people (
      id                 SERIAL PRIMARY KEY,
      person_type        TEXT NOT NULL DEFAULT 'Trainer',
      full_name          TEXT NOT NULL,
      full_name_np       TEXT,
      father_name        TEXT,
      grandfather_name   TEXT,
      citizenship_no     TEXT,
      citizenship_district TEXT,
      date_of_birth      TEXT,
      gender             TEXT,
      phone              TEXT,
      email              TEXT,
      permanent_address  TEXT,
      temporary_address  TEXT,
      designation        TEXT,
      photo              TEXT,
      remarks            TEXT,
      is_active          BOOLEAN DEFAULT TRUE,
      created_by         UUID,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )`,
    /*
     * What a named qualification qualifies someone to train.
     *
     * Two shapes, because the two examples behave differently. An academic
     * qualification is broad — a Diploma in Civil Engineering covers plumber,
     * mason, shuttering carpenter and building painter alike — so it grants a
     * sector, or a curated list where a sector is too wide. A trade certificate
     * is narrow and names its own occupation: a Building Electrician Level 2
     * certificate qualifies for Building Electrician and nothing else, so the
     * rule grants "whatever occupation is on the certificate" rather than a
     * fixed list, and one rule covers every trade.
     */
    `CREATE TABLE IF NOT EXISTS hr_qualification_rules (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      kind         TEXT NOT NULL DEFAULT 'Academic',
      grant_scope  TEXT NOT NULL DEFAULT 'occupations',
      sector       TEXT,
      max_level    TEXT,
      notes        TEXT,
      is_active    BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS hr_rule_occupations (
      rule_id       INTEGER REFERENCES hr_qualification_rules(id) ON DELETE CASCADE,
      occupation_id INTEGER REFERENCES occupations(id) ON DELETE CASCADE,
      PRIMARY KEY (rule_id, occupation_id)
    )`,
    // Academic degrees, trainings, TOT and skill-test certificates all live
    // here — they differ by `kind` and by which columns they fill, not in shape.
    `CREATE TABLE IF NOT EXISTS hr_qualifications (
      id             SERIAL PRIMARY KEY,
      person_id      INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      kind           TEXT NOT NULL DEFAULT 'Academic',
      rule_id        INTEGER REFERENCES hr_qualification_rules(id) ON DELETE SET NULL,
      title          TEXT,
      institution    TEXT,
      board          TEXT,
      occupation_id  INTEGER REFERENCES occupations(id) ON DELETE SET NULL,
      level          TEXT,
      passed_year    TEXT,
      duration_hours INTEGER,
      division       TEXT,
      certificate_no TEXT,
      remarks        TEXT,
      sort_order     INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS hr_experience (
      id            SERIAL PRIMARY KEY,
      person_id     INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      organisation  TEXT,
      position      TEXT,
      occupation_id INTEGER REFERENCES occupations(id) ON DELETE SET NULL,
      from_date     TEXT,
      to_date       TEXT,
      is_current    BOOLEAN DEFAULT FALSE,
      description   TEXT,
      sort_order    INTEGER DEFAULT 0
    )`,
    /*
     * Only the decisions someone made by hand.
     *
     * Eligibility is derived from the qualifications every time it is read, so
     * correcting a rule corrects everyone who holds that qualification. Storing
     * the derived list instead would freeze it at the moment it was computed.
     * What cannot be re-derived is a human judgement — a trainer whose field
     * experience earns them a trade the rules do not grant, or one who must not
     * be put forward for a trade the rules do — so only those are recorded.
     */
    `CREATE TABLE IF NOT EXISTS hr_person_occupations (
      person_id     INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      occupation_id INTEGER NOT NULL REFERENCES occupations(id) ON DELETE CASCADE,
      mode          TEXT NOT NULL DEFAULT 'add',
      note          TEXT,
      PRIMARY KEY (person_id, occupation_id)
    )`,
    `CREATE TABLE IF NOT EXISTS hr_documents (
      id             SERIAL PRIMARY KEY,
      person_id      INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      qualification_id INTEGER REFERENCES hr_qualifications(id) ON DELETE SET NULL,
      experience_id  INTEGER REFERENCES hr_experience(id) ON DELETE SET NULL,
      doc_type       TEXT NOT NULL DEFAULT 'Other',
      file_name      TEXT NOT NULL,
      file_key       TEXT NOT NULL,
      file_size      INTEGER,
      content_type   TEXT,
      file_data      TEXT,
      uploaded_by    UUID,
      uploaded_at    TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hr_qual_person ON hr_qualifications(person_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hr_exp_person ON hr_experience(person_id)`,
    `CREATE INDEX IF NOT EXISTS idx_hr_docs_person ON hr_documents(person_id)`,

    // Fields the Standard EOI "Form 5 — Curriculum Vitae" asks for that a
    // person's basic record does not already hold. Kept on the person because
    // they describe the individual; anything the *bid* decides — proposed
    // position, the tasks they are being put forward for — lives on the tender.
    `ALTER TABLE hr_people ADD COLUMN IF NOT EXISTS profession TEXT`,
    `ALTER TABLE hr_people ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Nepali'`,
    `ALTER TABLE hr_people ADD COLUMN IF NOT EXISTS years_with_entity TEXT`,
    `ALTER TABLE hr_people ADD COLUMN IF NOT EXISTS professional_memberships TEXT`,
    `ALTER TABLE hr_people ADD COLUMN IF NOT EXISTS key_qualifications TEXT`,
    `ALTER TABLE hr_qualifications ADD COLUMN IF NOT EXISTS specialisation TEXT`,
    // The form prints durations as people write them — "10 Days, 2015",
    // "2-13 June 2014" — which an hours column cannot hold.
    `ALTER TABLE hr_qualifications ADD COLUMN IF NOT EXISTS duration_text TEXT`,
    `ALTER TABLE hr_experience ADD COLUMN IF NOT EXISTS country TEXT`,
    `ALTER TABLE hr_experience ADD COLUMN IF NOT EXISTS project_name TEXT`,
    `ALTER TABLE hr_experience ADD COLUMN IF NOT EXISTS reference_text TEXT`,
    `CREATE TABLE IF NOT EXISTS hr_languages (
      id         SERIAL PRIMARY KEY,
      person_id  INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      language   TEXT NOT NULL,
      speaking   TEXT,
      reading    TEXT,
      writing    TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_hr_lang_person ON hr_languages(person_id)`,

    // ─── Tenders ─────────────────────────────────────────────────────────────
    // A bid the organisation is putting together: which firm is bidding, what
    // the notice asks for, and who is being proposed. The EOI and RFP documents
    // are still produced by the existing report families — a tender carries the
    // choices that drive them rather than generating a second copy of each.
    `CREATE TABLE IF NOT EXISTS tenders (
      id                 SERIAL PRIMARY KEY,
      title              TEXT NOT NULL,
      reference_no       TEXT,
      client_id          INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      client_name_manual TEXT,
      institute_id       INTEGER REFERENCES institutes(id) ON DELETE SET NULL,
      fy                 TEXT,
      stage              TEXT DEFAULT 'EOI',
      status             TEXT DEFAULT 'Preparing',
      published_date     TEXT,
      submission_date    TEXT,
      authorized_rep     TEXT,
      notes              TEXT,
      created_by         UUID,
      created_at         TIMESTAMPTZ DEFAULT NOW(),
      updated_at         TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS tender_occupations (
      tender_id     INTEGER REFERENCES tenders(id) ON DELETE CASCADE,
      occupation_id INTEGER REFERENCES occupations(id) ON DELETE CASCADE,
      PRIMARY KEY (tender_id, occupation_id)
    )`,
    /*
     * Someone proposed on a bid, and what they are proposed *as*.
     *
     * Proposed position, the tasks assigned and the key-qualifications write-up
     * are per tender, not per person: the same trainer put forward on two bids
     * is a Main Trainer on one and a Training Coordinator on the other, with a
     * different task list each time. Leaving them blank falls back to what the
     * person's own record says, so a straightforward bid needs no retyping.
     */
    `CREATE TABLE IF NOT EXISTS tender_people (
      id                 SERIAL PRIMARY KEY,
      tender_id          INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      person_id          INTEGER NOT NULL REFERENCES hr_people(id) ON DELETE CASCADE,
      occupation_id      INTEGER REFERENCES occupations(id) ON DELETE SET NULL,
      proposed_position  TEXT,
      detailed_tasks     TEXT,
      key_qualifications TEXT,
      sort_order         INTEGER DEFAULT 0,
      UNIQUE (tender_id, person_id, occupation_id)
    )`,
    /*
     * House wording for the CV's two prose sections, kept per firm.
     *
     * The pool is organisation-wide, so one trainer is put forward by more than
     * one firm — and each firm words "Detailed Tasks Assigned" and "Key
     * Qualifications" its own way. Same idea as the 3(B) narrative variations an
     * institute already picks from, and the same reason: the text is the firm's
     * voice, not a fact about the person.
     *
     * Varies by proposed position as well as by firm, because a Main Trainer's
     * task list and a Store Keeper's have nothing in common. institute_id NULL
     * is a shared variant every firm can draw on.
     */
    `CREATE TABLE IF NOT EXISTS cv_text_variants (
      id           SERIAL PRIMARY KEY,
      institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE,
      field        TEXT NOT NULL DEFAULT 'detailed_tasks',
      label        TEXT NOT NULL,
      person_type  TEXT,
      position     TEXT,
      body         TEXT NOT NULL DEFAULT '',
      is_active    BOOLEAN DEFAULT TRUE,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_cv_variants_inst ON cv_text_variants(institute_id, field)`,
    // Which variant a proposed person is using, when they are not using bespoke
    // text typed for this bid alone.
    `ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS tasks_variant_id INTEGER REFERENCES cv_text_variants(id) ON DELETE SET NULL`,
    `ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS quals_variant_id INTEGER REFERENCES cv_text_variants(id) ON DELETE SET NULL`,
    /*
     * One CV per person per role on a bid.
     *
     * The table's own UNIQUE (tender_id, person_id, occupation_id) does not
     * cover it: Postgres treats NULLs as distinct, so proposing the same person
     * twice without naming an occupation slipped through and printed their CV
     * twice in the pack. COALESCE gives the absent occupation a value to
     * collide on.
     */
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_people_unique
       ON tender_people (tender_id, person_id, COALESCE(occupation_id, 0))`,
    // Firms bid several times in a year, so the list is read one firm and one
    // fiscal year at a time.
    /*
     * A bid moves through stages: EOI 1, if shortlisted, becomes RFP 1.
     *
     * Each stage is its own row rather than a `stage` column flipped in place,
     * because they are separate submissions — their own reference number, their
     * own deadline, their own status, and usually their own proposed team. One
     * row per bid would mean the EOI's dates were overwritten the day it
     * progressed, and the pack actually submitted could no longer be rebuilt.
     *
     * The link is what makes it one bid rather than two: EOI 1 → RFP 1 sits in
     * the same chain, while EOI 2 → RFP 2 is a different one for the same firm
     * and client.
     */
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS parent_tender_id INTEGER REFERENCES tenders(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_parent ON tenders(parent_tender_id)`,

    /*
     * Which of our firms are bidding this notice.
     *
     * A tender is published before anyone decides who answers it, and more than
     * one firm in the group may — separately, or together as a joint venture,
     * which this notice type explicitly allows. A single institute_id column on
     * the tender forced that decision at the moment of creation and could only
     * ever hold one answer.
     */
    `CREATE TABLE IF NOT EXISTS tender_firms (
      tender_id    INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
      role         TEXT DEFAULT 'Lead',
      sort_order   INTEGER DEFAULT 0,
      PRIMARY KEY (tender_id, institute_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tender_firms_inst ON tender_firms(institute_id)`,

    // Proposed staff belong to a firm's submission, not to the notice: two
    // firms bidding the same tender each put forward their own people.
    `ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS institute_id INTEGER REFERENCES institutes(id) ON DELETE CASCADE`,
    /*
     * Move anything recorded under the old single-firm shape across, then take
     * the column away so there is only one answer to "who is bidding".
     *
     * Wrapped in DO blocks because a plain guard cannot work here: Postgres
     * parses the whole statement before any WHERE is evaluated, so an
     * information_schema check still fails with "column does not exist" once
     * the column is gone. EXECUTE defers parsing until the branch is taken, so
     * these go quiet after the one boot that needs them instead of warning on
     * every start forever.
     */
    `DO $do$ BEGIN
       IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='tenders' AND column_name='institute_id') THEN
         EXECUTE 'INSERT INTO tender_firms (tender_id, institute_id, role)
                    SELECT id, institute_id, ''Lead'' FROM tenders
                     WHERE institute_id IS NOT NULL ON CONFLICT DO NOTHING';
         EXECUTE 'UPDATE tender_people tp SET institute_id = t.institute_id
                    FROM tenders t WHERE t.id = tp.tender_id AND tp.institute_id IS NULL';
       END IF;
     END $do$;`,
    `ALTER TABLE tenders DROP COLUMN IF EXISTS institute_id`,
    `DROP INDEX IF EXISTS idx_tender_people_unique`,
    // One CV per person per role per firm.
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_people_unique
       ON tender_people (tender_id, COALESCE(institute_id, 0), person_id, COALESCE(occupation_id, 0))`,
    /*
     * The separate entities competing for one notice.
     *
     * A tender is answered by bidders, and a bidder is not the same thing as a
     * firm: WLTTI may bid alone, UTTE may bid alone, and CHRA and IC may bid
     * together as a joint venture — three bidders, four firms, one notice. A
     * flat list of firms on the tender could not say which of them were bidding
     * together, so a JV was indistinguishable from two rivals.
     *
     * Each bidder carries its own outcome, because they are judged separately:
     * one can be shortlisted while the others are not, and only a shortlisted
     * bidder goes on to submit a proposal.
     */
    `CREATE TABLE IF NOT EXISTS tender_bidders (
      id         SERIAL PRIMARY KEY,
      tender_id  INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      label      TEXT,
      status     TEXT DEFAULT 'Preparing',
      remarks    TEXT,
      sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS tender_bidder_firms (
      bidder_id    INTEGER NOT NULL REFERENCES tender_bidders(id) ON DELETE CASCADE,
      institute_id INTEGER NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
      role         TEXT DEFAULT 'Lead',
      sort_order   INTEGER DEFAULT 0,
      PRIMARY KEY (bidder_id, institute_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tender_bidders_tender ON tender_bidders(tender_id)`,
    `ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS bidder_id INTEGER REFERENCES tender_bidders(id) ON DELETE CASCADE`,
    // Anything recorded under the flat firm list becomes a solo bidder, so
    // nothing entered before this is lost.
    `INSERT INTO tender_bidders (tender_id, sort_order)
       SELECT tender_id, sort_order FROM tender_firms
        WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='tender_firms')
          AND NOT EXISTS (SELECT 1 FROM tender_bidders b WHERE b.tender_id = tender_firms.tender_id)`,
    `INSERT INTO tender_bidder_firms (bidder_id, institute_id, role)
       SELECT b.id, tf.institute_id, tf.role
         FROM tender_firms tf
         JOIN tender_bidders b ON b.tender_id = tf.tender_id
        WHERE NOT EXISTS (SELECT 1 FROM tender_bidder_firms x WHERE x.bidder_id = b.id)
       ON CONFLICT DO NOTHING`,
    `UPDATE tender_people tp SET bidder_id = b.id
       FROM tender_bidders b
       JOIN tender_bidder_firms bf ON bf.bidder_id = b.id
      WHERE b.tender_id = tp.tender_id AND bf.institute_id = tp.institute_id
        AND tp.bidder_id IS NULL`,
    `DROP TABLE IF EXISTS tender_firms`,
    `DROP INDEX IF EXISTS idx_tender_people_unique`,
    // One CV per person per role per bidder.
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tender_people_unique
       ON tender_people (tender_id, COALESCE(bidder_id, 0), person_id, COALESCE(occupation_id, 0))`,

    /*
     * The staff a notice demands, and what it demands of them.
     *
     * A Request for EOI does not ask for "some trainers" — it names posts and
     * sets a bar for each: Team Leader, one, Master's degree, ten years; two
     * Database Officers with +2, computer training and three years. Recording
     * them as rows rather than prose is what lets the pool be checked against
     * them and the slots filled from it.
     *
     * `count` carries the trainer numbers too. A row reading "Main Trainer, 4"
     * is the same kind of statement as "Team Leader, 1", so it is the same
     * shape; `category` only decides which list it is shown under.
     */
    `CREATE TABLE IF NOT EXISTS tender_positions (
      id                   SERIAL PRIMARY KEY,
      tender_id            INTEGER NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
      title                TEXT NOT NULL,
      category             TEXT NOT NULL DEFAULT 'Key expert',
      count                INTEGER NOT NULL DEFAULT 1,
      min_education        TEXT,
      min_experience_years INTEGER,
      required_training    TEXT,
      occupation_id        INTEGER REFERENCES occupations(id) ON DELETE SET NULL,
      notes                TEXT,
      sort_order           INTEGER DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tender_positions_tender ON tender_positions(tender_id)`,
    /*
     * What a post accepts, as alternatives.
     *
     * "Diploma or PCL in related subject or NSTB Level-3, OR Pre-Diploma or
     * NSTB Level-2" is two alternatives of two options each. A single minimum
     * degree cannot say it, and the vocational half cannot be said at all.
     */
    `ALTER TABLE tender_positions ADD COLUMN IF NOT EXISTS education_options JSONB DEFAULT '[]'`,
    // Which post a proposed person is being put forward against. Nullable: a
    // bid may propose someone the notice never named a post for.
    `ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS position_id INTEGER
       REFERENCES tender_positions(id) ON DELETE SET NULL`,
    /*
     * Academic standing, which `level` cannot carry.
     *
     * That column already means the NSTB trade level of a skill certificate.
     * Ranking a Master's against a Building Electrician Level 2 in one column
     * would be comparing two unrelated ladders.
     */
    `ALTER TABLE hr_qualifications ADD COLUMN IF NOT EXISTS education_level TEXT`,
    /*
     * General or vocational — which ladder an academic qualification is on.
     *
     * An NSTB certificate is academic in the sense that matters (it goes under
     * Education on the Form 5 CV, not Training) but it is not on the degree
     * ladder a tender's minimum is stated against. So both are kind 'Academic'
     * and this says which ladder. The old 'Skill Test' kind was the vocational
     * stream under another name, and folds into it.
     */
    `ALTER TABLE hr_qualifications ADD COLUMN IF NOT EXISTS stream TEXT`,
    `UPDATE hr_qualifications SET kind = 'Academic', stream = 'Vocational' WHERE kind = 'Skill Test'`,
    // Rows entered before the toggle: an NSTB level and no degree level was a
    // vocational certificate; anything else academic was general education.
    `UPDATE hr_qualifications
        SET stream = CASE WHEN coalesce(level, '') <> '' AND coalesce(education_level, '') = ''
                          THEN 'Vocational' ELSE 'General' END
      WHERE kind = 'Academic' AND stream IS NULL`,


    /*
     * What the notice itself states, taken from a real Request for EOI.
     *
     * Kept as fields rather than buried in the notes because they are the
     * things a bid is judged and timed by — the weights say where the effort
     * belongs, the pass mark says whether it is worth entering, and the
     * deadline is the one date that cannot be got wrong.
     *
     * Dates are free text and stored as the notice prints them. e-GP notices
     * are in AD while the firm's own fiscal year is BS, and converting between
     * them on the way in would mean guessing which calendar a typed date meant.
     */
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS project_name TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'National'`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS office_address TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS funding_agency TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS submission_time TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS document_deadline TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS submission_portal TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS client_website TEXT`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS association_allowed BOOLEAN DEFAULT TRUE`,
    // "EOI will be assessed based on Qualification 40%, Experience 50% and
    // Capacity 10%", with a minimum score to pass.
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS weight_qualification NUMERIC`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS weight_experience NUMERIC`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS weight_capacity NUMERIC`,
    `ALTER TABLE tenders ADD COLUMN IF NOT EXISTS minimum_score NUMERIC`,
    `DROP INDEX IF EXISTS idx_tenders_firm_fy`,
    `CREATE INDEX IF NOT EXISTS idx_tenders_fy ON tenders(fy)`,
    `CREATE INDEX IF NOT EXISTS idx_tender_people_tender ON tender_people(tender_id)`,
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
fastify.register(require('./routes/hr'),              { prefix: '/api/hr' });
fastify.register(require('./routes/tenders'),         { prefix: '/api/tenders' });
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
