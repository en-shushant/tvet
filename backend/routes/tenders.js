// routes/tenders.js — bids, the people proposed on them, and the CV pack
const { pool } = require('../db/pool');
const { authenticate, requireTenderAccess, requireWriter, requireSuperAdmin } = require('../middleware/auth');

/**
 * A tender is a bid being put together: which firm is bidding, what the notice
 * asks for, and who is being proposed for it.
 *
 * It does not generate the EOI or the RFP. Those documents are already produced
 * by the report families, from the firm's own experience — a tender carries the
 * choices that drive them (the firm, the fiscal year, the occupations asked
 * for) so the report builder opens on the right answer instead of being set up
 * again by hand. The CV pack is the one document a tender produces itself,
 * because it is the only one written about people rather than about the firm.
 *
 * Behind the same grant as the pool: a tender names the people being proposed,
 * and reaches their citizenship numbers and CVs through them.
 */

const CV_FORMATS = ['ppmo_eoi', 'ppmo_rfp', 'helvetas', 'eoi_form5'];
/** The default when a stage has none chosen: the PPMO form for that stage. */
const defaultCvFormat = (stage) => (stage === 'RFP' ? 'ppmo_rfp' : 'ppmo_eoi');

const TENDER_FIELDS = [
  // No firm here on purpose: a notice exists before anyone decides who answers
  // it, and more than one of our firms may. See tender_firms.
  'title', 'reference_no', 'client_id', 'client_name_manual', 'fy',
  'stage', 'status', 'published_date', 'submission_date', 'authorized_rep', 'notes',
  'parent_tender_id',
  // Straight off the notice.
  'project_name', 'method', 'office_address', 'funding_agency', 'submission_time',
  'document_deadline', 'submission_portal', 'client_website', 'association_allowed',
  'weight_qualification', 'weight_experience', 'weight_capacity', 'minimum_score',
  // The CV format this stage of the notice asks for.
  'cv_format',
];
/** Blank means "the notice does not say", which is not the same as zero. */
const numOrNull = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);

const tenderValues = (b) => TENDER_FIELDS.map(f =>
  f === 'client_id' || f === 'parent_tender_id' ? (b[f] || null)
    : f === 'stage' ? (b.stage || 'EOI')
    : f === 'status' ? (b.status || 'Preparing')
    : f === 'association_allowed' ? (b.association_allowed !== false)
    : ['weight_qualification', 'weight_experience', 'weight_capacity', 'minimum_score'].includes(f)
      ? numOrNull(b[f])
    : f === 'cv_format' ? (CV_FORMATS.includes(b.cv_format) ? b.cv_format : null)
    : (b[f] ?? null));

/**
 * Fill {placeholders} in a CV text variant.
 *
 * Deliberately forgiving: an unknown placeholder is left as written rather than
 * blanked, so a typo shows up in the draft as `{postion}` instead of silently
 * swallowing the sentence around it.
 */
const { eventsLine, eventsFor, monthIndex } = require('../lib/cvWording');
/**
 * Time with another firm, as typed on the Team step: a firm in our list
 * (institute_id), or a company typed by hand (org_name, with the address and
 * signatory its letter needs). Kept only if it names one or the other.
 */
const cleanFirmExperience = (rows) => (Array.isArray(rows) ? rows : [])
  .filter(r => r && (parseInt(r.institute_id, 10) || String(r.org_name || '').trim()))
  .map(r => ({
    institute_id: parseInt(r.institute_id, 10) || null,
    ...(parseInt(r.institute_id, 10) ? {} : {
      org_name: String(r.org_name || '').trim(), org_address: String(r.org_address || '').trim(),
      org_signatory: String(r.org_signatory || '').trim(), org_designation: String(r.org_designation || '').trim(),
    }),
    position: String(r.position || '').trim(),
    from_date: String(r.from_date || '').trim(), to_date: String(r.to_date || '').trim(),
    clients: String(r.clients || '').trim(),
    events_count: eventsFor({ ...r, is_current: !String(r.to_date || '').trim() }),
  }));

/**
 * When an assignment ran, in BS months: its contract dates where entered, else
 * its fiscal years (Shrawan of the first to Asar of the last); an ongoing one
 * runs to now.
 */
function assignmentSpan(a, nowMonth) {
  const fyStart = (fy) => { const y = parseInt(String(fy || ''), 10); return y ? y * 12 + 3 : null; };
  const fyEnd = (fy) => { const y = parseInt(String(fy || ''), 10); return y ? (y + 1) * 12 + 2 : null; };
  const from = monthIndex(a.start_date) ?? fyStart(a.start_fy || a.fiscal_year);
  const to = a.is_ongoing ? nowMonth : (monthIndex(a.end_date) ?? fyEnd(a.end_fy || a.fiscal_year));
  return [from, to ?? from];
}
const overlaps = ([a1, a2], [b1, b2]) => a1 != null && a1 <= b2 && (a2 ?? a1) >= b1;


/**
 * The wording for a CV section when none was picked by hand: the firm's own
 * entry for this exact post, else for this kind of person, else its general
 * one. A firm with none of its own gets one of the shared variations, chosen
 * by its id (and `turn`, e.g. which job) so firms and jobs read differently.
 */
function pickFirmVariant(variants, field, instituteId, position, personType, turn = 0, activitySet = '') {
  if (!instituteId) return null;
  const norm = (x) => String(x || '').trim().toLowerCase();
  const tiers = (list) => [
    // A post goes by several names in notices: "Monitoring Officer | M&E Officer".
    list.filter(v => v.position && String(v.position).split('|').some(n => norm(n) === norm(position))),
    list.filter(v => !v.position && v.person_type && v.person_type === personType),
    list.filter(v => !v.position && !v.person_type),
  ];
  const mine = tiers(variants.filter(v => v.field === field && v.institute_id === instituteId)).find(t => t.length);
  if (mine) return mine[0];
  const shared = tiers(variants.filter(v => v.field === field && !v.institute_id)).find(t => t.length);
  if (!shared) return null;
  const sorted = [...shared].sort((a, b) => a.id - b.id);
  // A firm that chose a variation of the activities starts from it; later jobs
  // take the next one along, so one CV's jobs do not all read the same.
  // Tasks and prior work follow the same choice where that letter exists.
  if (/^[A-E]$/.test(activitySet || '')) {
    const byLetter = [...shared].sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const at = byLetter.findIndex(v => new RegExp(`(activities|tasks|prior work) ${activitySet}$`).test(v.label || ''));
    if (at >= 0) return byLetter[(at + turn) % byLetter.length];
  }
  return sorted[(Number(instituteId) + turn) % sorted.length];
}

/** Lines whose placeholder had nothing to fill are dropped, not printed as {events}. */
const dropUnfilled = (text) => String(text || '').split('\n')
  .filter(l => !/\{(events|clients|years)\}/.test(l)).join('\n');

/** "Adequacy" with nothing written: the person's own record, as prior work. */
function priorWorkOf(experience, showEvents = true) {
  return experience.filter(e => e.organisation || e.position).map(e => {
    const when = [e.from_date, e.is_current ? 'present' : e.to_date].filter(Boolean).join(' – ');
    const n = parseInt(e.events_count, 10);
    const ran = showEvents && n > 0
      ? ': ' + n + ' training event' + (n === 1 ? '' : 's') + (e.clients ? ' for ' + e.clients : '') + '.' : '';
    return '• ' + [e.position, e.organisation].filter(Boolean).join(', ') + (when ? ' (' + when + ')' : '') + ran;
  }).join('\n');
}

function applyVars(body, vars) {
  return String(body || '').replace(/\{(\w+)\}/g, (whole, key) =>
    (vars[key] === undefined || vars[key] === null || vars[key] === '') ? whole : String(vars[key]));
}

/**
 * A bidder's firms, and the name it goes by.
 *
 * The label is derived rather than stored unless somebody sets one: "WLTTI" for
 * a solo bid, "CHRA + IC (JV)" for a joint venture. Deriving it means the name
 * follows the firms if they change, and nobody has to keep the two in step.
 */
const BIDDER_FIRMS_SQL = `
  COALESCE((SELECT json_agg(json_build_object('institute_id', i.id, 'name', i.name,
               'acronym', i.acronym, 'role', bf.role) ORDER BY bf.sort_order, i.name)
              FROM tender_bidder_firms bf JOIN institutes i ON i.id = bf.institute_id
             WHERE bf.bidder_id = b.id), '[]')`;

/**
 * A post's accepted qualifications, as the notice states them.
 *
 * A list of alternatives, any one of which qualifies; each alternative accepts
 * any of its options — a degree on the general ladder or an NSTB level — with
 * its own minimum years, since notices pair "Diploma + 1 year" against
 * "Pre-Diploma + 3 years". Kept only if well formed: an option with no level
 * would read as "anything goes".
 */
const cleanOptions = (alts) => (Array.isArray(alts) ? alts : [])
  .map(a => ({
    any: (Array.isArray(a?.any) ? a.any : [])
      .filter(o => (o?.ladder === 'general' || o?.ladder === 'vocational') && String(o.level || '').trim())
      .map(o => ({ ladder: o.ladder, level: String(o.level).trim(), related: o.related !== false })),
    min_years: Number.isInteger(parseInt(a?.min_years, 10)) ? parseInt(a.min_years, 10) : null,
  }))
  .filter(a => a.any.length);

const derivedLabel = (firms = []) => {
  const names = firms.map(f => f.acronym || f.name).filter(Boolean);
  if (!names.length) return 'No firm yet';
  return names.length === 1 ? names[0] : `${names.join(' + ')} (JV)`;
};

const shapeBidder = (row) => ({
  ...row,
  firms: row.firms || [],
  display_name: (row.label || '').trim() || derivedLabel(row.firms || []),
});

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireTenderAccess);

  // ─── Per-firm CV wording ───────────────────────────────────────────────────

  fastify.get('/cv-variants', async (request) => {
    const { institute_id, field } = request.query;
    const params = [];
    // A firm sees its own wording plus the shared library; never another
    // firm's, which is the whole point of keeping them per firm.
    let where = 'WHERE is_active';
    if (institute_id) { params.push(institute_id); where += ` AND (institute_id IS NULL OR institute_id = $${params.length})`; }
    if (field) { params.push(field); where += ` AND field = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT * FROM cv_text_variants ${where} ORDER BY institute_id NULLS FIRST, field, label`, params);
    return rows;
  });

  fastify.post('/cv-variants', { preHandler: requireWriter }, async (request, reply) => {
    const { institute_id, field, label, person_type, position, body } = request.body || {};
    if (!label?.trim()) return reply.code(400).send({ error: 'A label is required' });
    const { rows } = await pool.query(
      `INSERT INTO cv_text_variants (institute_id, field, label, person_type, position, body)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [institute_id || null, field || 'detailed_tasks', label.trim(),
       person_type || null, position || null, body || '']);
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/cv-variants/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { institute_id, field, label, person_type, position, body } = request.body || {};
    const { rows } = await pool.query(
      `UPDATE cv_text_variants SET institute_id=$1, field=$2, label=$3, person_type=$4, position=$5, body=$6
        WHERE id=$7 RETURNING *`,
      [institute_id || null, field || 'detailed_tasks', label, person_type || null,
       position || null, body || '', request.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/cv-variants/:id', { preHandler: requireWriter }, async (request) => {
    await pool.query('UPDATE cv_text_variants SET is_active = FALSE WHERE id = $1', [request.params.id]);
    return { deactivated: true };
  });

  // ─── Tenders ───────────────────────────────────────────────────────────────

  fastify.get('/', async (request) => {
    // A firm runs several bids in a fiscal year, so the list is narrowed to one
    // firm and one year far more often than it is read whole.
    const { status, q, institute_id, fy, stage } = request.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }
    if (institute_id) {
      params.push(institute_id);
      where += ` AND EXISTS (SELECT 1 FROM tender_bidders b
                              JOIN tender_bidder_firms bf ON bf.bidder_id = b.id
                             WHERE b.tender_id = t.id AND bf.institute_id = $${params.length})`;
    }
    if (fy) { params.push(fy); where += ` AND t.fy = $${params.length}`; }
    if (stage) { params.push(stage); where += ` AND t.stage = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (t.title ILIKE $${params.length} OR t.reference_no ILIKE $${params.length})`;
    }
    const { rows } = await pool.query(`
      SELECT t.*,
             c.full_name AS client_full_name, c.short_name AS client_short_name,
             COALESCE((SELECT json_agg(json_build_object('id', b.id, 'label', b.label,
                          'status', b.status, 'firms', ${BIDDER_FIRMS_SQL})
                          ORDER BY b.sort_order, b.id)
                         FROM tender_bidders b WHERE b.tender_id = t.id), '[]') AS bidders,
             (SELECT COUNT(*)::int FROM tender_people tp WHERE tp.tender_id = t.id) AS proposed_count,
             (SELECT COUNT(*)::int FROM tender_occupations o WHERE o.tender_id = t.id) AS occupation_count,
             p.stage AS parent_stage, p.reference_no AS parent_reference, p.title AS parent_title,
             (SELECT COUNT(*)::int FROM tenders c2 WHERE c2.parent_tender_id = t.id) AS follow_on_count
        FROM tenders t
        LEFT JOIN tenders p ON p.id = t.parent_tender_id
        LEFT JOIN clients c ON c.id = t.client_id
        ${where}
       ORDER BY COALESCE(t.submission_date, '') DESC, t.id DESC`, params);
    return rows.map(r => ({ ...r, bidders: (r.bidders || []).map(shapeBidder) }));
  });

  /**
   * Who is already committed elsewhere.
   *
   * The same trainer cannot be put forward by two firms competing for one
   * notice — an evaluator seeing the same citizenship number on two bids reads
   * it as a fabricated team. Being on a *different* live bid is not forbidden,
   * but it is worth knowing before promising someone twice, so both are
   * returned and the screen decides which to block and which to merely flag.
   *
   * Bids that are over cannot conflict with anything, so they are left out.
   */
  fastify.get('/proposed-elsewhere', async (request) => {
    const { exclude_tender_id } = request.query;
    const params = [];
    let where = "WHERE t.status NOT IN ('Awarded', 'Lost', 'Dropped')";
    if (exclude_tender_id) {
      params.push(exclude_tender_id);
      where += ` AND t.id <> $${params.length}`;
    }
    const { rows } = await pool.query(`
      SELECT tp.person_id, t.id AS tender_id, t.title, t.stage, t.status,
             b.id AS bidder_id, b.label, ${BIDDER_FIRMS_SQL} AS firms
        FROM tender_people tp
        JOIN tenders t ON t.id = tp.tender_id
        LEFT JOIN tender_bidders b ON b.id = tp.bidder_id
        ${where}
       ORDER BY t.id`, params);
    return rows.map(r => ({ ...r, bidder_name: (r.label || '').trim() || derivedLabel(r.firms || []) }));
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const [tender, occs, positions, people, bidders, chain] = await Promise.all([
      pool.query(`SELECT t.*, c.full_name AS client_full_name, c.short_name AS client_short_name
                    FROM tenders t
                    LEFT JOIN clients c ON c.id = t.client_id
                   WHERE t.id = $1`, [id]),
      pool.query(`SELECT o.id, o.name, o.sector, o.level FROM tender_occupations x
                    JOIN occupations o ON o.id = x.occupation_id WHERE x.tender_id = $1
                   ORDER BY o.name`, [id]),
      pool.query(`SELECT pos.*, o.name AS occupation_name FROM tender_positions pos
                    LEFT JOIN occupations o ON o.id = pos.occupation_id
                   WHERE pos.tender_id = $1 ORDER BY pos.sort_order, pos.id`, [id]),
      pool.query(`SELECT tp.*, p.full_name, p.person_type, p.designation, p.profession,
                         o.name AS occupation_name
                    FROM tender_people tp
                    JOIN hr_people p ON p.id = tp.person_id
                    LEFT JOIN occupations o ON o.id = tp.occupation_id
                   WHERE tp.tender_id = $1 ORDER BY tp.bidder_id, tp.sort_order, tp.id`, [id]),
      pool.query(`SELECT b.*, ${BIDDER_FIRMS_SQL} AS firms
                    FROM tender_bidders b
                   WHERE b.tender_id = $1 ORDER BY b.sort_order, b.id`, [id]),
      // Both directions of the chain: what this stage came from, and what came
      // out of it. Shown so a bid reads as one thing across its stages.
      pool.query(`
        SELECT id, title, reference_no, stage, status, submission_date, parent_tender_id
          FROM tenders
         WHERE id = (SELECT parent_tender_id FROM tenders WHERE id = $1)
            OR parent_tender_id = $1
         ORDER BY id`, [id]),
    ]);
    if (!tender.rows.length) return reply.code(404).send({ error: 'Not found' });
    const row = tender.rows[0];
    return {
      ...row,
      occupations: occs.rows,
      positions: positions.rows,
      people: people.rows,
      bidders: bidders.rows.map(shapeBidder),
      came_from: chain.rows.find(c => c.id === row.parent_tender_id) || null,
      led_to: chain.rows.filter(c => c.parent_tender_id === row.id),
    };
  });

  const saveChildren = async (client, tenderId, body) => {
    // Only touched when the caller actually sends them. A step that edits the
    // notice must not wipe the firms a later step assigned.
    if (body.bidders) {
      // Existing bidders are updated in place rather than replaced, so the
      // staff already proposed under one survive an edit to another.
      const sent = body.bidders.filter(b => (b.firms || []).some(f => f.institute_id));
      const keep = sent.map(b => b.id).filter(Boolean);
      const spare = keep.length ? 'AND id <> ALL($2::int[])' : '';
      await client.query(
        `DELETE FROM tender_bidders WHERE tender_id = $1
          ${spare}`,
        keep.length ? [tenderId, keep] : [tenderId]);

      for (let i = 0; i < sent.length; i++) {
        const b = sent[i];
        let bidderId = b.id;
        if (bidderId) {
          await client.query(
            `UPDATE tender_bidders SET label=$1, status=$2, remarks=$3, sort_order=$4
              WHERE id=$5 AND tender_id=$6`,
            [b.label || null, b.status || 'Preparing', b.remarks || null, i, bidderId, tenderId]);
        } else {
          const { rows: [created] } = await client.query(
            `INSERT INTO tender_bidders (tender_id, label, status, remarks, sort_order)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [tenderId, b.label || null, b.status || 'Preparing', b.remarks || null, i]);
          bidderId = created.id;
        }
        await client.query('DELETE FROM tender_bidder_firms WHERE bidder_id = $1', [bidderId]);
        const firms = (b.firms || []).filter(f => f.institute_id);
        for (let j = 0; j < firms.length; j++) {
          await client.query(
            `INSERT INTO tender_bidder_firms (bidder_id, institute_id, role, sort_order)
             VALUES ($1,$2,$3,$4) ON CONFLICT (bidder_id, institute_id)
             DO UPDATE SET role = $3, sort_order = $4`,
            // A solo bidder's only firm is the lead by definition.
            [bidderId, firms[j].institute_id,
             firms.length === 1 ? 'Lead' : (firms[j].role || 'JV Member'), j]);
        }
      }
    }
    /*
     * The posts the notice demands.
     *
     * Updated in place for the same reason the bidders are: tender_people
     * points at these rows, so replacing the list wholesale would drop every
     * slot assignment on the bid each time the notice was edited.
     */
    if (body.positions) {
      const sent = body.positions.filter(p => String(p.title || '').trim());
      const keep = sent.map(p => p.id).filter(Boolean);
      const spare = keep.length ? 'AND id <> ALL($2::int[])' : '';
      await client.query(
        `DELETE FROM tender_positions WHERE tender_id = $1
          ${spare}`,
        keep.length ? [tenderId, keep] : [tenderId]);

      for (let i = 0; i < sent.length; i++) {
        const p = sent[i];
        const vals = [String(p.title).trim(), p.category || 'Key expert',
          Math.max(1, parseInt(p.count, 10) || 1), p.min_education || null,
          Number.isInteger(parseInt(p.min_experience_years, 10))
            ? parseInt(p.min_experience_years, 10) : null,
          p.required_training || null, p.occupation_id || null, p.notes || null, i,
          JSON.stringify(cleanOptions(p.education_options)), String(p.task_role || '').trim() || null];
        if (p.id) {
          await client.query(
            `UPDATE tender_positions SET title=$1, category=$2, count=$3, min_education=$4,
               min_experience_years=$5, required_training=$6, occupation_id=$7, notes=$8, sort_order=$9,
               education_options=$10, task_role=$11
             WHERE id=$12 AND tender_id=$13`, [...vals, p.id, tenderId]);
        } else {
          await client.query(
            `INSERT INTO tender_positions (title, category, count, min_education,
               min_experience_years, required_training, occupation_id, notes, sort_order,
               education_options, task_role, tender_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [...vals, tenderId]);
        }
      }
    }
    if (!body.occupation_ids) return saveTenderPeople(client, tenderId, body);
    await client.query('DELETE FROM tender_occupations WHERE tender_id = $1', [tenderId]);
    const occIds = [...new Set((body.occupation_ids || [])
      .map(n => parseInt(n, 10)).filter(Number.isInteger))];
    if (occIds.length) {
      await client.query(
        `INSERT INTO tender_occupations (tender_id, occupation_id)
         SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`, [tenderId, occIds]);
    }
    return saveTenderPeople(client, tenderId, body);
  };

  /**
   * Replace the proposed staff, for one firm if the caller names one.
   *
   * Scoped that way because the screen edits a single firm's team at a time:
   * replacing the whole tender's staff from one firm's list would silently
   * delete everybody the other firms had put forward.
   */
  const saveTenderPeople = async (client, tenderId, body) => {
    if (body.people) {
      const scope = body.people_bidder_id || null;
      if (scope) {
        await client.query(
          'DELETE FROM tender_people WHERE tender_id = $1 AND bidder_id = $2', [tenderId, scope]);
      } else {
        await client.query('DELETE FROM tender_people WHERE tender_id = $1', [tenderId]);
      }
      // One row per person per role. A person sent twice for the same role — or
      // twice with no role named at all — is one proposal, and the second would
      // otherwise print their CV again in the pack.
      const seen = new Set();
      const people = body.people.filter(p => {
        if (!p.person_id) return false;
        const key = `${p.bidder_id || scope || 0}:${p.person_id}:${p.occupation_id || 0}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      for (let i = 0; i < people.length; i++) {
        const p = people[i];
        await client.query(
          `INSERT INTO tender_people (tender_id, bidder_id, person_id, occupation_id,
             proposed_position, detailed_tasks, key_qualifications,
             tasks_variant_id, quals_variant_id, sort_order, position_id, adequacy, adequacy_variant_id,
             joining_date, joined_institute_id, firm_experience, joining_clients, joining_events)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           ON CONFLICT DO NOTHING`,
          [tenderId, p.bidder_id || scope || null, p.person_id, p.occupation_id || null,
           p.proposed_position || null, p.detailed_tasks || null, p.key_qualifications || null,
           p.tasks_variant_id || null, p.quals_variant_id || null, i, p.position_id || null,
           p.adequacy || null, p.adequacy_variant_id || null,
           String(p.joining_date || '').trim() || null, p.joined_institute_id || null,
           JSON.stringify(cleanFirmExperience(p.firm_experience)),
           String(p.joining_clients || '').trim() || null,
           eventsFor({ from_date: p.joining_date, is_current: true, events_count: p.joining_events })]);
      }
    }
  };

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    if (!request.body?.title?.trim()) return reply.code(400).send({ error: 'A title is required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cols = TENDER_FIELDS.join(',');
      const holders = TENDER_FIELDS.map((_, i) => `$${i + 1}`).join(',');
      const { rows: [t] } = await client.query(
        `INSERT INTO tenders (${cols}, created_by) VALUES (${holders}, $${TENDER_FIELDS.length + 1}) RETURNING *`,
        [...tenderValues(request.body), request.user.id]);
      await saveChildren(client, t.id, request.body);
      await client.query('COMMIT');
      return reply.code(201).send(t);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    if (!request.body?.title?.trim()) return reply.code(400).send({ error: 'A title is required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      /*
       * Which stage this one came from is written by /advance, not by a save.
       *
       * A body that does not mention it keeps it. Writing the column on every
       * save meant any client that sent only the notice's own fields — a status
       * change, a team assignment — silently cut an RFP off from its EOI.
       */
      const keepLineage = !Object.prototype.hasOwnProperty.call(request.body, 'parent_tender_id');
      const fields = keepLineage ? TENDER_FIELDS.filter(f => f !== 'parent_tender_id') : TENDER_FIELDS;
      const values = tenderValues(request.body).filter((_, i) => fields.includes(TENDER_FIELDS[i]));
      const sets = fields.map((f, i) => `${f}=$${i + 1}`).join(',');
      const { rows } = await client.query(
        `UPDATE tenders SET ${sets}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, request.params.id]);
      if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }
      await saveChildren(client, request.params.id, request.body);
      await client.query('COMMIT');
      return rows[0];
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  // Only a superadmin deletes a tender: it takes its bidders and proposed team with it.
  fastify.delete('/:id', { preHandler: requireSuperAdmin }, async (request, reply) => {
    const { rowCount } = await pool.query('DELETE FROM tenders WHERE id = $1', [request.params.id]);
    if (!rowCount) return reply.code(404).send({ error: 'Not found' });
    return { deleted: true };
  });

  /**
   * Carry a shortlisted EOI forward to its RFP.
   *
   * A new row rather than a changed one: the EOI was a submission in its own
   * right, with its own reference and deadline, and overwriting it would lose
   * the record of what was actually sent. What does carry over is the work —
   * the firm, the client, the occupations and the proposed team, wording and
   * all — because at RFP stage that is the starting point, not a blank page.
   *
   * Reference number and dates are deliberately not copied: they belong to the
   * new notice, and a stale deadline carried forward is worse than an empty one.
   */
  /**
   * Start a new bid from an old one.
   *
   * Not a stage: the copy is a separate notice with no parent, for the client
   * who advertises the same training again next year or in the next ward. What
   * describes the work carries over — client, trades, posts, scoring — and what
   * identifies the old notice does not: its reference number and dates would be
   * wrong on the new one and look right. Bidders and their teams are optional,
   * because a similar notice is often answered by a different line-up.
   */
  fastify.post('/:id/copy', { preHandler: requireWriter }, async (request, reply) => {
    const { id } = request.params;
    const { title, include_bidders = true, include_teams = false } = request.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [from] } = await client.query('SELECT * FROM tenders WHERE id = $1', [id]);
      if (!from) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }

      const NOT_COPIED = ['reference_no', 'published_date', 'submission_date', 'submission_time',
        'document_deadline', 'parent_tender_id', 'status'];
      const cols = TENDER_FIELDS.filter(f => !NOT_COPIED.includes(f));
      const vals = cols.map(f => f === 'title' ? (String(title || '').trim() || `${from.title} (copy)`) : from[f]);
      const marks = cols.map((_, i) => '$' + (i + 1)).join(',');
      const { rows: [next] } = await client.query(
        `INSERT INTO tenders (${cols.join(',')}, status, created_by)
         VALUES (${marks}, 'Preparing', $${cols.length + 1})
         RETURNING *`, [...vals, request.user.id]);

      await client.query(
        `INSERT INTO tender_occupations (tender_id, occupation_id)
         SELECT $1, occupation_id FROM tender_occupations WHERE tender_id = $2
         ON CONFLICT DO NOTHING`, [next.id, id]);

      const { rows: oldPositions } = await client.query(
        'SELECT * FROM tender_positions WHERE tender_id = $1 ORDER BY sort_order, id', [id]);
      const positionMap = new Map();
      for (const pos of oldPositions) {
        const { rows: [np] } = await client.query(
          `INSERT INTO tender_positions (tender_id, title, category, count, min_education,
             min_experience_years, required_training, occupation_id, notes, sort_order, education_options, task_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [next.id, pos.title, pos.category, pos.count, pos.min_education,
           pos.min_experience_years, pos.required_training, pos.occupation_id, pos.notes, pos.sort_order,
           JSON.stringify(pos.education_options || []), pos.task_role || null]);
        positionMap.set(pos.id, np.id);
      }

      if (include_bidders) {
        const { rows: bidders } = await client.query(
          'SELECT * FROM tender_bidders WHERE tender_id = $1 ORDER BY sort_order, id', [id]);
        for (const b of bidders) {
          // A new notice has no result yet, whatever the old one's was.
          const { rows: [nb] } = await client.query(
            `INSERT INTO tender_bidders (tender_id, label, status, remarks, sort_order)
             VALUES ($1,$2,'Preparing',$3,$4) RETURNING id`, [next.id, b.label, b.remarks, b.sort_order]);
          await client.query(
            `INSERT INTO tender_bidder_firms (bidder_id, institute_id, role, sort_order)
             SELECT $1, institute_id, role, sort_order FROM tender_bidder_firms WHERE bidder_id = $2
             ON CONFLICT DO NOTHING`, [nb.id, b.id]);
          if (include_teams) {
            await client.query(
              `INSERT INTO tender_people (tender_id, bidder_id, person_id, occupation_id,
                 proposed_position, detailed_tasks, key_qualifications,
                 tasks_variant_id, quals_variant_id, sort_order, position_id, adequacy, adequacy_variant_id,
                 joining_date, joined_institute_id, firm_experience, joining_clients, joining_events)
               SELECT $1, $2, person_id, occupation_id, proposed_position, detailed_tasks,
                      key_qualifications, tasks_variant_id, quals_variant_id, sort_order,
                      (SELECT new_id FROM (SELECT unnest($5::int[]) AS old_id,
                                                  unnest($6::int[]) AS new_id) m
                        WHERE m.old_id = tender_people.position_id), adequacy, adequacy_variant_id,
                 joining_date, joined_institute_id, firm_experience, joining_clients, joining_events
                 FROM tender_people WHERE tender_id = $3 AND bidder_id = $4
               ON CONFLICT DO NOTHING`,
              [next.id, nb.id, id, b.id, [...positionMap.keys()], [...positionMap.values()]]);
          }
        }
      }

      await client.query('COMMIT');
      return reply.code(201).send(next);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.post('/:id/advance', { preHandler: requireWriter }, async (request, reply) => {
    const { id } = request.params;
    const stage = request.body?.stage || 'RFP';
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [from] } = await client.query('SELECT * FROM tenders WHERE id = $1', [id]);
      if (!from) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }

      const { rows: [next] } = await client.query(
        `INSERT INTO tenders (title, client_id, client_name_manual, fy,
           stage, status, authorized_rep, notes, parent_tender_id, created_by,
           project_name, method, office_address, funding_agency, submission_portal,
           client_website, association_allowed)
         VALUES ($1,$2,$3,$4,$5,'Preparing',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [request.body?.title?.trim() || from.title, from.client_id, from.client_name_manual,
         request.body?.fy || from.fy, stage,
         from.authorized_rep, from.notes, from.id, request.user.id,
         // What describes the opportunity carries over. What describes the RFP
         // notice — its reference, dates, weights and pass mark — does not:
         // the RFP is scored separately and a copied weight would look correct.
         from.project_name, from.method, from.office_address, from.funding_agency,
         from.submission_portal, from.client_website, from.association_allowed]);

      await client.query(
        `INSERT INTO tender_occupations (tender_id, occupation_id)
         SELECT $1, occupation_id FROM tender_occupations WHERE tender_id = $2
         ON CONFLICT DO NOTHING`, [next.id, id]);
      /*
       * The posts carry over, and so does who was put in them.
       *
       * The RFP asks for the same team the EOI described, so the slots are
       * copied and each new row remembers which old one it came from — without
       * that map every person would arrive at the next stage unassigned.
       */
      const { rows: oldPositions } = await client.query(
        `SELECT * FROM tender_positions WHERE tender_id = $1 ORDER BY sort_order, id`, [id]);
      const positionMap = new Map();
      for (const pos of oldPositions) {
        const { rows: [np] } = await client.query(
          `INSERT INTO tender_positions (tender_id, title, category, count, min_education,
             min_experience_years, required_training, occupation_id, notes, sort_order, education_options, task_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [next.id, pos.title, pos.category, pos.count, pos.min_education,
           pos.min_experience_years, pos.required_training, pos.occupation_id,
           pos.notes, pos.sort_order, JSON.stringify(pos.education_options || []), pos.task_role || null]);
        positionMap.set(pos.id, np.id);
      }
      /*
       * Only the bidders that got through.
       *
       * An EOI is a shortlisting round, so carrying every bidder forward would
       * put entities into the proposal stage that were told no. Where nothing
       * has been marked shortlisted yet, everyone carries over rather than
       * nobody — an empty RFP stage is a dead end, and the outcome may simply
       * not have been recorded.
       */
      const { rows: short } = await client.query(
        `SELECT id, label, status, remarks, sort_order FROM tender_bidders
          WHERE tender_id = $1 AND status = 'Shortlisted' ORDER BY sort_order, id`, [id]);
      const { rows: carried } = short.length
        ? { rows: short }
        : await client.query(
            `SELECT id, label, status, remarks, sort_order FROM tender_bidders
              WHERE tender_id = $1 ORDER BY sort_order, id`, [id]);

      for (const b of carried) {
        const { rows: [nb] } = await client.query(
          `INSERT INTO tender_bidders (tender_id, label, status, remarks, sort_order)
           VALUES ($1,$2,'Preparing',$3,$4) RETURNING id`,
          [next.id, b.label, b.remarks, b.sort_order]);
        await client.query(
          `INSERT INTO tender_bidder_firms (bidder_id, institute_id, role, sort_order)
           SELECT $1, institute_id, role, sort_order FROM tender_bidder_firms WHERE bidder_id = $2
           ON CONFLICT DO NOTHING`, [nb.id, b.id]);
        await client.query(
          `INSERT INTO tender_people (tender_id, bidder_id, person_id, occupation_id,
             proposed_position, detailed_tasks, key_qualifications,
             tasks_variant_id, quals_variant_id, sort_order, position_id, adequacy, adequacy_variant_id,
             joining_date, joined_institute_id, firm_experience, joining_clients, joining_events)
           SELECT $1, $2, person_id, occupation_id, proposed_position, detailed_tasks,
                  key_qualifications, tasks_variant_id, quals_variant_id, sort_order,
                  (SELECT new_id FROM (SELECT unnest($5::int[]) AS old_id,
                                              unnest($6::int[]) AS new_id) m
                    WHERE m.old_id = tender_people.position_id), adequacy, adequacy_variant_id,
                 joining_date, joined_institute_id, firm_experience, joining_clients, joining_events
             FROM tender_people WHERE tender_id = $3 AND bidder_id = $4
           ON CONFLICT DO NOTHING`,
          [next.id, nb.id, id, b.id, [...positionMap.keys()], [...positionMap.values()]]);
      }

      await client.query('COMMIT');
      return reply.code(201).send(next);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  /**
   * Everything the CV pack needs, already resolved.
   *
   * The two prose sections fall back in a fixed order: text typed for this bid,
   * then the firm's chosen wording for that position, then whatever the person's
   * own record says. Resolved here rather than in the browser so the print
   * sheet, the Word export and the on-screen preview cannot disagree about
   * which of the three won.
   */
  fastify.get('/:id/cv', async (request, reply) => {
    const { id } = request.params;
    // A CV pack is one firm's submission: "Name of Consultant" is the firm, and
    // the prose is its own house wording. Which firm has to be asked for.
    const bidderId = request.query.bidder_id;
    if (!bidderId) return reply.code(400).send({ error: 'bidder_id required' });

    const { rows: [bidder] } = await pool.query(
      `SELECT b.*, ${BIDDER_FIRMS_SQL} AS firms FROM tender_bidders b
        WHERE b.id = $1 AND b.tender_id = $2`, [bidderId, id]);
    if (!bidder) return reply.code(404).send({ error: 'That bidder is not on this tender' });
    const shaped = shapeBidder(bidder);

    const { rows: [row] } = await pool.query('SELECT * FROM tenders WHERE id = $1', [id]);
    /*
     * "Name of Consultant" on the CV is the bidding entity.
     *
     * For a solo bid that is the firm. For a joint venture it is the JV as a
     * whole — naming only the lead would misdescribe who is being proposed to.
     * The authorised representative stays the lead firm's contact, since a JV
     * signs through its lead.
     */
    const lead = shaped.firms.find(f => f.role === 'Lead') || shaped.firms[0] || {};
    const { rows: [leadInst] } = lead.institute_id
      ? await pool.query('SELECT id, contact_person, cv_activities_set, cv_show_events FROM institutes WHERE id = $1', [lead.institute_id])
      : { rows: [{}] };
    // The format this stage of the notice asks for; every bidder and every JV
    // partner uses it. Firms differ only in their wording.
    const format = CV_FORMATS.includes(row.cv_format) ? row.cv_format : defaultCvFormat(row.stage);
    const tender = {
      ...row,
      institute_name: shaped.display_name,
      institute_contact: leadInst?.contact_person || null,
      bidder: shaped,
      cv_format: format,
      lead_institute_id: leadInst?.id || null,
    };

    const { rows: proposed } = await pool.query(`
      SELECT tp.*, o.name AS occupation_name, pos.task_role, pos.category AS post_category FROM tender_people tp
        LEFT JOIN occupations o ON o.id = tp.occupation_id
        LEFT JOIN tender_positions pos ON pos.id = tp.position_id
       WHERE tp.tender_id = $1 AND tp.bidder_id = $2
       ORDER BY tp.sort_order, tp.id`, [id, bidderId]);
    if (!proposed.length) return { tender, format, cvs: [] };

    const ids = proposed.map(p => p.person_id);
    const [people, quals, exp, langs, variants] = await Promise.all([
      pool.query('SELECT * FROM hr_people WHERE id = ANY($1::int[])', [ids]),
      pool.query(`SELECT q.*, o.name AS occupation_name FROM hr_qualifications q
                    LEFT JOIN occupations o ON o.id = q.occupation_id
                   WHERE q.person_id = ANY($1::int[]) ORDER BY q.sort_order, q.id`, [ids]),
      pool.query(`SELECT e.*, o.name AS occupation_name FROM hr_experience e
                    LEFT JOIN occupations o ON o.id = e.occupation_id
                   WHERE e.person_id = ANY($1::int[]) ORDER BY e.sort_order, e.id`, [ids]),
      pool.query(`SELECT * FROM hr_languages WHERE person_id = ANY($1::int[])
                   ORDER BY sort_order, id`, [ids]),
      pool.query('SELECT * FROM cv_text_variants WHERE is_active'),
    ]);
    const byId = new Map(people.rows.map(p => [p.id, p]));
    // Firms named in joining dates and other-firm experience, by id.
    const firmIds = [...new Set(proposed.flatMap(tp => [tp.joined_institute_id || leadInst?.id,
      ...(tp.firm_experience || []).map(f => f.institute_id)]).filter(Boolean))];
    const { rows: firmRowsDb } = firmIds.length
      ? await pool.query(`SELECT id, name, acronym, reg_no, pan, address, phone, mobile, email, contact_person,
                                 contact_designation, letterhead, sign, stamp, letter_top_margin,
                                 letter_lr_padding, letter_bottom_padding
                            FROM institutes WHERE id = ANY($1::int[])`, [firmIds]) : { rows: [] };
    const firmById = new Map(firmRowsDb.map(f => [f.id, f]));
    /*
     * Each of those firms' assignments: when it ran, its client, its trades.
     * A trainer or staff member works one event per assignment, so the events
     * a CV and letter claim with a firm are its assignments during their time.
     */
    const { rows: firmAssignments } = firmIds.length ? await pool.query(`
      SELECT a.id, a.institute_id, a.start_date, a.end_date, a.fiscal_year, a.start_fy, a.end_fy, a.is_ongoing,
             COALESCE(NULLIF(btrim(c.short_name), ''), c.full_name, a.client_name_manual) AS client,
             COALESCE((SELECT array_agg(DISTINCT lower(btrim(o.name))) FROM assignment_occupations ao
                         JOIN occupations o ON o.id = ao.ctevt_occupation_id WHERE ao.assignment_id = a.id), '{}') AS trades
        FROM assignments a LEFT JOIN clients c ON c.id = a.client_id
       WHERE a.institute_id = ANY($1::int[])`, [firmIds]) : { rows: [] };
    const firmName = new Map(firmRowsDb.map(f => [f.id, f.name]));
    const nowMonth = (new Date().getFullYear() + 56) * 12 + new Date().getMonth() + 8;
    const variantById = new Map(variants.rows.map(v => [v.id, v]));
    const forPerson = (rows, pid) => rows.filter(r => r.person_id === pid);

    const cvs = proposed.map(tp => {
      const person = byId.get(tp.person_id);
      if (!person) return null;
      const vars = {
        firm: tender.institute_name || '', client: tender.client_name_manual || '',
        position: tp.proposed_position || person.designation || '',
        staffName: person.full_name,
        // The post's trade, else what their NSTB certificate or profession says.
        occupation: tp.occupation_name
          || forPerson(quals.rows, tp.person_id).find(q => q.stream === 'Vocational' && q.occupation_name)?.occupation_name
          || person.profession || '',
        profession: person.profession || '', tender: tender.title,
      };
      /*
       * Text typed for this bid, then the wording picked for the person, then
       * the lead firm's own wording for this post (in a JV every partner's CV
       * speaks in the lead's words), then the person's default.
       */
      // The post's chosen wording role wins over its title, which notices word every way.
      const firmDefault = (field) => pickFirmVariant(variants.rows, field, leadInst?.id, tp.task_role || vars.position, person.person_type, 0, leadInst?.cv_activities_set);
      /*
       * Employment, newest first: their time with the bidding firm (from the
       * joining date set for this bid), time with other firms of ours the bid
       * claims, and the jobs on their pool record.
       */
      const role = tp.task_role || vars.position;
      const withFirm = tp.joining_date ? [{
        organisation: firmName.get(tp.joined_institute_id || leadInst?.id) || tender.institute_name,
        institute_id: tp.joined_institute_id || leadInst?.id, biddingFirm: true,
        position: vars.position, role, from_date: tp.joining_date, is_current: true, employment_type: 'Full time',
        clients: tp.joining_clients, events_count: tp.joining_events,
      }] : [];
      const otherFirms = (tp.firm_experience || []).map(f => ({
        organisation: f.institute_id ? (firmName.get(f.institute_id) || '') : f.org_name,
        institute_id: f.institute_id || null,
        // A company typed by hand: its letter is generated from what was typed.
        manualFirm: f.institute_id ? null : { name: f.org_name, address: f.org_address,
          contact_person: f.org_signatory, contact_designation: f.org_designation },
        position: f.position || vars.position,
        role: f.position || role, from_date: f.from_date, to_date: f.to_date, is_current: !f.to_date,
        clients: f.clients, events_count: f.events_count,
      }));
      // Their trades, for counting a trainer's assignments: certificates and jobs.
      const trades = new Set([
        ...forPerson(quals.rows, tp.person_id).filter(q => q.stream === 'Vocational' && q.occupation_name)
          .map(q => q.occupation_name.trim().toLowerCase()),
        ...(tp.occupation_name ? [tp.occupation_name.trim().toLowerCase()] : []),
      ]);
      const trainerLike = person.person_type !== 'Support Staff';
      const countFromAssignments = (e) => {
        if (!e.institute_id) return e;
        const from = monthIndex(e.from_date);
        const to = e.is_current ? nowMonth : monthIndex(e.to_date);
        if (from == null || to == null) return e;
        const ran = firmAssignments.filter(a => a.institute_id === e.institute_id
          && overlaps(assignmentSpan(a, nowMonth), [from, to])
          && (!trainerLike || !trades.size || !a.trades.length || a.trades.some(t => trades.has(t))));
        const typed = parseInt(e.events_count, 10);
        const events = Math.min(Number.isInteger(typed) ? typed : ran.length, ran.length, Math.floor((to - from) / 3));
        const clients = String(e.clients || '').trim()
          || [...new Set(ran.map(a => a.client).filter(Boolean))].join(', ');
        return { ...e, events_count: events > 0 ? events : null, clients };
      };
      const startOf = (e) => monthIndex(e.from_date) ?? -1;
      const allJobs = [...withFirm, ...otherFirms].map(countFromAssignments).concat(forPerson(exp.rows, tp.person_id))
        .sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0) || startOf(b) - startOf(a));
      const experience = allJobs.map((e, i) => {
        // What they did there: always the bidding firm's chosen wording for that
        // job's position (never typed per person), opened by the count the
        // experience letter states.
        const v = pickFirmVariant(variants.rows, 'activities', leadInst?.id, e.role || e.position, person.person_type, i, leadInst?.cv_activities_set);
        const did = (v ? applyVars(v.body, { ...vars, position: e.position || vars.position,
          occupation: e.occupation_name || vars.occupation }).replace(/\{occupation\}/g, 'the trade') : '');
        // The firm decides whether its CVs state the number of events.
        const events = leadInst?.cv_show_events === false ? '' : eventsLine(e, person.person_type === 'Support Staff' ? 'Supported' : 'Conducted');
        return { ...e, summary: [events, did].filter(Boolean).join('\n') };
      });
      const events = experience.reduce((n, e) => n + (parseInt(e.events_count, 10) || 0), 0);
      const clients = [...new Set(experience.flatMap(e => String(e.clients || '').split(','))
        .map(c => c.trim()).filter(Boolean))].join(', ');
      // Years actually spent in the jobs listed, not since the first one began.
      const months = experience.reduce((n, e) => {
        const from = monthIndex(e.from_date);
        const to = e.is_current ? nowMonth : monthIndex(e.to_date);
        return from != null && to != null && to > from ? n + (to - from) : n;
      }, 0);
      const years = Math.floor(months / 12);
      // A firm that leaves the number of events off its CVs leaves it off here too.
      Object.assign(vars, { events: leadInst?.cv_show_events === false ? '' : (events || ''), clients, years: years > 0 ? years : '' });
      const resolve = (own, variantId, fallback, field) => {
        if ((own || '').trim()) return own;
        const v = (variantId ? variantById.get(variantId) : null) || firmDefault(field);
        if (v) return dropUnfilled(applyVars(v.body, vars)).replace(/\{occupation\}/g, 'the trade');
        return fallback || '';
      };
      // "Years with TP": from the joining date this bid states, else the pool record.
      const joined = monthIndex(tp.joining_date);
      const yearsWithFirm = joined != null && nowMonth >= joined
        ? `${Math.floor((nowMonth - joined) / 12)} years (since ${tp.joining_date})` : person.years_with_entity;
      return {
        tender_person_id: tp.id,
        person: { ...person, years_with_entity: yearsWithFirm },
        proposed_position: vars.position,
        post_category: tp.post_category || null, task_role: tp.task_role || null,
        occupation_name: tp.occupation_name || '',
        detailed_tasks: resolve(tp.detailed_tasks, tp.tasks_variant_id, '', 'detailed_tasks'),
        key_qualifications: resolve(tp.key_qualifications, tp.quals_variant_id, person.key_qualifications, 'key_qualifications'),
        // The assignments themselves (post, employer, dates), then the firm's
        // wording of what they show, unless text was typed for this bid.
        adequacy: (tp.adequacy || '').trim() ? tp.adequacy
          : [priorWorkOf(experience, leadInst?.cv_show_events !== false), resolve('', tp.adequacy_variant_id, '', 'adequacy')].filter(Boolean).join('\n'),
        education: forPerson(quals.rows, tp.person_id).filter(q => q.kind === 'Academic'),
        trainings: forPerson(quals.rows, tp.person_id).filter(q => q.kind !== 'Academic'),
        experience,
        /*
         * Experience letters, stating exactly what the CV's employment row does
         * — same post, dates, events and clients: the bidding firm's, and one
         * for each company typed by hand. A firm already in our list has issued
         * its own letter on paper, so none is generated for it.
         */
        letters: experience.filter(e => (e.biddingFirm && firmById.has(e.institute_id)) || e.manualFirm).map(e => ({
          firm: e.manualFirm || firmById.get(e.institute_id), position: e.position, occupation: vars.occupation,
          from_date: e.from_date, to_date: e.to_date, is_current: !!e.is_current,
          events_count: e.events_count ?? null, clients: e.clients || '',
          duties: String(e.summary || '').split('\n').filter(l => l.trim() && !/training events?/.test(l)).slice(0, 4),
        })),
        languages: forPerson(langs.rows, tp.person_id),
      };
    }).filter(Boolean);

    return { tender, format, cvs };
  });
}

module.exports = plugin;
module.exports.applyVars = applyVars;
module.exports.pickFirmVariant = pickFirmVariant;
module.exports.dropUnfilled = dropUnfilled;
module.exports.assignmentSpan = assignmentSpan;
module.exports.priorWorkOf = priorWorkOf;
