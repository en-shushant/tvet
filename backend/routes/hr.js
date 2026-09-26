// routes/hr.js — the human resource pool
const { pool } = require('../db/pool');
const { sendStoredFile } = require('../lib/safeDownload');
const { authenticate, requireHRAccess, requireAdmin } = require('../middleware/auth');

/**
 * Skill levels as an order, for the optional cap on a qualification rule.
 *
 * 0 for anything unrecognised, including a blank: an occupation that records no
 * level cannot contradict a cap, and treating it as "above" would silently hide
 * every unlevelled trade from every capped rule.
 */
const LEVEL_RANK = (col) => `CASE lower(coalesce(${col}, ''))
  WHEN 'level 1' THEN 1 WHEN 'level 2' THEN 2 WHEN 'level 3' THEN 3
  WHEN 'professional' THEN 4 ELSE 0 END`;

/**
 * Who may train what, derived rather than stored.
 *
 * Four ways an occupation is granted, and they exist because the two examples
 * this was built from behave differently:
 *
 *   sector                 — a Diploma in Civil Engineering covers plumber,
 *                            mason, shuttering carpenter and building painter
 *                            alike, so the rule grants a whole sector.
 *   occupations            — the same idea where a sector is too wide, so the
 *                            rule names the trades explicitly.
 *   certificate_occupation — a Building Electrician Level 2 certificate
 *                            qualifies for Building Electrician and nothing
 *                            else. The trade is on the certificate, not in the
 *                            rule, so one rule covers every trade.
 *   (no rule)              — a trade certificate recorded before anyone wrote a
 *                            rule for it still names its occupation, and should
 *                            not be ignored for want of a rule.
 *
 * Then the human judgements on top: an `add` for someone whose field experience
 * earns them a trade the rules do not grant, a `remove` for someone who must
 * not be put forward for one the rules do. A `remove` wins over every grant,
 * including an `add` — the two together mean somebody changed their mind, and
 * the safer reading of "do not propose this person for this trade" is to obey.
 *
 * Derived on every read so that correcting a rule corrects everyone holding
 * that qualification. Storing the computed list would freeze it at the moment
 * it was written, and nobody would know which rows were stale.
 */
const ELIGIBILITY_CTE = `
  granted AS (
    SELECT q.person_id, o.id AS occupation_id
      FROM hr_qualifications q
      JOIN hr_qualification_rules r ON r.id = q.rule_id AND r.is_active
      JOIN occupations o ON o.is_active AND o.sector = r.sector
     WHERE r.grant_scope = 'sector'
       AND (coalesce(r.max_level,'') = '' OR ${LEVEL_RANK('o.level')} <= ${LEVEL_RANK('r.max_level')})
    UNION
    SELECT q.person_id, ro.occupation_id
      FROM hr_qualifications q
      JOIN hr_qualification_rules r ON r.id = q.rule_id AND r.is_active
      JOIN hr_rule_occupations ro ON ro.rule_id = r.id
     WHERE r.grant_scope = 'occupations' AND coalesce(cardinality(ro.levels), 0) = 0
    UNION
    -- Levels marked on a rule's trade: every occupation of that name at those levels.
    SELECT q.person_id, o2.id
      FROM hr_qualifications q
      JOIN hr_qualification_rules r ON r.id = q.rule_id AND r.is_active
      JOIN hr_rule_occupations ro ON ro.rule_id = r.id AND cardinality(ro.levels) > 0
      JOIN occupations o1 ON o1.id = ro.occupation_id
      JOIN occupations o2 ON o2.is_active AND lower(trim(o2.name)) = lower(trim(o1.name))
                         AND o2.level = ANY(ro.levels)
     WHERE r.grant_scope = 'occupations'
    UNION
    SELECT q.person_id, q.occupation_id
      FROM hr_qualifications q
      JOIN hr_qualification_rules r ON r.id = q.rule_id AND r.is_active
     WHERE r.grant_scope = 'certificate_occupation' AND q.occupation_id IS NOT NULL
    UNION
    SELECT q.person_id, q.occupation_id
      FROM hr_qualifications q
     WHERE q.rule_id IS NULL AND q.occupation_id IS NOT NULL
    UNION
    -- The NSTB ladder: a Plumber Level 2 certificate also teaches Plumber
    -- Level 1, a Level 3 teaches 1 to 3. Same trade name, any level at or below
    -- the certificate's. Only for certificates that name their own trade
    -- (no rule, or "whatever the certificate says"); a Technician
    -- certificate is not a rung and grants only its own occupation, above.
    SELECT q.person_id, o2.id
      FROM hr_qualifications q
      LEFT JOIN hr_qualification_rules r ON r.id = q.rule_id
      JOIN occupations o1 ON o1.id = q.occupation_id
      JOIN occupations o2 ON o2.is_active AND lower(trim(o2.name)) = lower(trim(o1.name))
     WHERE q.occupation_id IS NOT NULL
       AND (q.rule_id IS NULL OR (r.is_active AND r.grant_scope = 'certificate_occupation'))
       AND ${LEVEL_RANK('q.level')} > 0
       AND ${LEVEL_RANK('o2.level')} BETWEEN 1 AND ${LEVEL_RANK('q.level')}
  ),
  with_adds AS (
    SELECT person_id, occupation_id FROM granted
    UNION
    SELECT person_id, occupation_id FROM hr_person_occupations WHERE mode = 'add'
  ),
  eligible AS (
    SELECT w.person_id, w.occupation_id
      FROM with_adds w
     WHERE NOT EXISTS (
       SELECT 1 FROM hr_person_occupations x
        WHERE x.person_id = w.person_id AND x.occupation_id = w.occupation_id AND x.mode = 'remove')
  )`;

/** Columns a person row is written from, in the order the SQL below expects. */
const PERSON_FIELDS = [
  'person_type', 'full_name', 'full_name_np', 'father_name', 'grandfather_name',
  'citizenship_no', 'citizenship_district', 'date_of_birth', 'gender', 'phone', 'email',
  'permanent_address', 'temporary_address', 'designation', 'photo', 'remarks', 'is_active',
  // Asked for by the EOI's Form 5 CV and nowhere else in the app.
  'profession', 'nationality', 'years_with_entity', 'professional_memberships', 'key_qualifications',
];
const personValues = (b) => PERSON_FIELDS.map(f =>
  f === 'is_active' ? (b.is_active !== false)
    : f === 'person_type' ? (b.person_type || 'Trainer')
    : f === 'nationality' ? (b.nationality || 'Nepali')
    : (b[f] ?? null));

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireHRAccess);

  // ─── Qualification rules ───────────────────────────────────────────────────

  fastify.get('/rules', async () => {
    const { rows } = await pool.query(`
      SELECT r.*,
             COALESCE(json_agg(json_build_object('id', o.id, 'name', o.name, 'sector', o.sector, 'level', o.level,
                                        'levels', coalesce(ro.levels, '{}'))
                      ORDER BY o.name) FILTER (WHERE o.id IS NOT NULL), '[]') AS occupations
        FROM hr_qualification_rules r
        LEFT JOIN hr_rule_occupations ro ON ro.rule_id = r.id
        LEFT JOIN occupations o ON o.id = ro.occupation_id AND o.is_active
       WHERE r.is_active
       GROUP BY r.id
       ORDER BY r.kind, r.name`);
    return rows;
  });

  const RULE_LEVELS = ['Level 1', 'Level 2', 'Level 3', 'Professional'];
  const saveRuleOccupations = async (client, ruleId, ids, levelsById = {}) => {
    await client.query('DELETE FROM hr_rule_occupations WHERE rule_id = $1', [ruleId]);
    const clean = [...new Set((ids || []).map(n => parseInt(n, 10)).filter(Number.isInteger))];
    for (const id of clean) {
      const lv = [...new Set((levelsById?.[id] || []).filter(l => RULE_LEVELS.includes(l)))];
      await client.query(
        `INSERT INTO hr_rule_occupations (rule_id, occupation_id, levels)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [ruleId, id, lv.length ? lv : null]);
    }
  };

  fastify.post('/rules', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, kind, grant_scope, sector, max_level, notes, occupation_ids, occupation_levels, qual_level } = request.body || {};
    if (!name?.trim()) return reply.code(400).send({ error: 'A name is required' });
    if (grant_scope === 'sector' && !sector) {
      return reply.code(400).send({ error: 'A sector-wide rule needs a sector' });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: [rule] } = await client.query(
        `INSERT INTO hr_qualification_rules (name, kind, grant_scope, sector, max_level, notes, qual_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [name.trim(), kind || 'Academic', grant_scope || 'occupations',
         sector || null, (kind === 'Skill Test' || qual_level) ? (max_level || null) : null, notes || null, qual_level || null]);
      await saveRuleOccupations(client, rule.id, occupation_ids, occupation_levels);
      await client.query('COMMIT');
      return reply.code(201).send(rule);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.put('/rules/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { name, kind, grant_scope, sector, max_level, notes, occupation_ids, occupation_levels, qual_level } = request.body || {};
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE hr_qualification_rules
            SET name=$1, kind=$2, grant_scope=$3, sector=$4, max_level=$5, notes=$6, qual_level=$8
          WHERE id=$7 RETURNING *`,
        [name, kind || 'Academic', grant_scope || 'occupations',
         sector || null, (kind === 'Skill Test' || qual_level) ? (max_level || null) : null, notes || null, request.params.id, qual_level || null]);
      if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }
      await saveRuleOccupations(client, request.params.id, occupation_ids, occupation_levels);
      await client.query('COMMIT');
      return rows[0];
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  /**
   * Deactivated, not deleted. A rule is referenced by every qualification
   * recorded against it, and deleting one would blank those references — the
   * people would silently lose the occupations it granted with nothing on
   * screen to say why.
   */
  fastify.delete('/rules/:id', { preHandler: requireAdmin }, async (request) => {
    await pool.query('UPDATE hr_qualification_rules SET is_active = FALSE WHERE id = $1', [request.params.id]);
    return { deactivated: true };
  });

  // ─── People ────────────────────────────────────────────────────────────────

  /**
   * The roster, with each person's eligible occupations already resolved.
   *
   * `occupation_ids` narrows to people who can cover *any* of them, which is
   * how a tender's requirement is answered — "who could we put forward for
   * these trades". `require_all` asks the stricter question instead: who covers
   * every one of them single-handed.
   */
  fastify.get('/people', async (request) => {
    const { type, q, occupation_ids, require_all, include_inactive } = request.query;
    const wanted = String(occupation_ids || '').split(',')
      .map(n => parseInt(n, 10)).filter(Number.isInteger);

    const params = [];
    let where = 'WHERE 1=1';
    if (!include_inactive) where += ' AND p.is_active';
    if (type) { params.push(type); where += ` AND p.person_type = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (p.full_name ILIKE $${params.length} OR p.citizenship_no ILIKE $${params.length}
                 OR p.designation ILIKE $${params.length} OR p.phone ILIKE $${params.length})`;
    }
    if (wanted.length) {
      params.push(wanted);
      const n = params.length;
      where += require_all
        ? ` AND (SELECT COUNT(DISTINCT e.occupation_id) FROM eligible e
                  WHERE e.person_id = p.id AND e.occupation_id = ANY($${n}::int[])) = ${wanted.length}`
        : ` AND EXISTS (SELECT 1 FROM eligible e
                         WHERE e.person_id = p.id AND e.occupation_id = ANY($${n}::int[]))`;
    }

    const { rows } = await pool.query(`
      WITH ${ELIGIBILITY_CTE}
      SELECT p.*,
        COALESCE((SELECT json_agg(json_build_object('id', o.id, 'name', o.name, 'sector', o.sector, 'level', o.level)
                                  ORDER BY o.name)
                    FROM eligible e JOIN occupations o ON o.id = e.occupation_id AND o.is_active
                   WHERE e.person_id = p.id), '[]') AS eligible_occupations,
        (SELECT COUNT(*)::int FROM hr_qualifications x WHERE x.person_id = p.id) AS qualification_count,
        -- Enough of each qualification to check someone against a tender's
        -- stated minimums without a second request per candidate.
        COALESCE((SELECT json_agg(json_build_object('kind', x.kind, 'stream', x.stream, 'title', x.title,
                    'education_level', x.education_level, 'level', x.level, 'passed_year', x.passed_year,
                    'occupation_id', x.occupation_id, 'occupation_name', xo.name)
                    ORDER BY x.sort_order, x.id)
                    FROM hr_qualifications x LEFT JOIN occupations xo ON xo.id = x.occupation_id
                   WHERE x.person_id = p.id), '[]') AS qualifications,
        (SELECT COUNT(*)::int FROM hr_experience e WHERE e.person_id = p.id) AS experience_count,
        (SELECT COUNT(*)::int FROM hr_documents d WHERE d.person_id = p.id) AS document_count,
        -- Which kinds are on file, so the roster can say who is missing a CV
        -- or citizenship without opening every record.
        COALESCE((SELECT array_agg(DISTINCT d.doc_type) FROM hr_documents d WHERE d.person_id = p.id), '{}') AS doc_types
        FROM hr_people p
        ${where}
       ORDER BY p.person_type, p.full_name`, params);
    return rows;
  });

  fastify.get('/people/:id', async (request, reply) => {
    const { id } = request.params;
    const [person, quals, exp, docs, elig, languages, overrides] = await Promise.all([
      pool.query('SELECT * FROM hr_people WHERE id = $1', [id]),
      pool.query(`SELECT q.*, o.name AS occupation_name, o.sector AS occupation_sector,
                         r.name AS rule_name, r.grant_scope, r.sector AS rule_sector
                    FROM hr_qualifications q
                    LEFT JOIN occupations o ON o.id = q.occupation_id
                    LEFT JOIN hr_qualification_rules r ON r.id = q.rule_id
                   WHERE q.person_id = $1 ORDER BY q.sort_order, q.id`, [id]),
      pool.query(`SELECT e.*, o.name AS occupation_name FROM hr_experience e
                    LEFT JOIN occupations o ON o.id = e.occupation_id
                   WHERE e.person_id = $1 ORDER BY e.sort_order, e.id`, [id]),
      pool.query(`SELECT id, person_id, qualification_id, experience_id, doc_type, file_name,
                         file_key, file_size, content_type, uploaded_at
                    FROM hr_documents WHERE person_id = $1 ORDER BY uploaded_at DESC`, [id]),
      pool.query(`WITH ${ELIGIBILITY_CTE}
                  SELECT o.id, o.name, o.sector, o.level
                    FROM eligible e JOIN occupations o ON o.id = e.occupation_id AND o.is_active
                   WHERE e.person_id = $1 ORDER BY o.name`, [id]),
      pool.query('SELECT * FROM hr_languages WHERE person_id = $1 ORDER BY sort_order, id', [id]),
      pool.query(`SELECT po.occupation_id, po.mode, po.note, o.name AS occupation_name
                    FROM hr_person_occupations po
                    LEFT JOIN occupations o ON o.id = po.occupation_id
                   WHERE po.person_id = $1`, [id]),
    ]);
    if (!person.rows.length) return reply.code(404).send({ error: 'Not found' });
    return {
      ...person.rows[0],
      qualifications: quals.rows,
      experience: exp.rows,
      documents: docs.rows,
      languages: languages.rows,
      eligible_occupations: elig.rows,
      occupation_overrides: overrides.rows,
    };
  });

  /** Replaces a person's qualifications, experience and overrides wholesale. */
  const saveChildren = async (client, personId, body) => {
    await client.query('DELETE FROM hr_qualifications WHERE person_id = $1', [personId]);
    const quals = body.qualifications || [];
    for (let i = 0; i < quals.length; i++) {
      const q = quals[i];
      await client.query(
        `INSERT INTO hr_qualifications (person_id, kind, rule_id, title, institution, board,
           occupation_id, level, passed_year, duration_hours, division, certificate_no, remarks, sort_order,
           specialisation, duration_text, education_level, stream, start_date, end_date, duration_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [personId, q.kind || 'Academic', q.rule_id || null, q.title || null, q.institution || null,
         q.board || null, q.occupation_id || null, q.level || null, q.passed_year || null,
         q.duration_hours || null, q.division || null, q.certificate_no || null, q.remarks || null, i,
         q.specialisation || null, q.duration_text || null, q.education_level || null,
         // Only academic rows are on a ladder; a training or TOT has no stream.
         (q.kind || 'Academic') === 'Academic' ? (q.stream === 'Vocational' ? 'Vocational' : 'General') : null,
         q.start_date || null, q.end_date || null,
         Number.isInteger(parseInt(q.duration_days, 10)) ? parseInt(q.duration_days, 10) : null]);
    }
    await client.query('DELETE FROM hr_experience WHERE person_id = $1', [personId]);
    const exps = body.experience || [];
    for (let i = 0; i < exps.length; i++) {
      const e = exps[i];
      await client.query(
        `INSERT INTO hr_experience (person_id, organisation, position, occupation_id,
           from_date, to_date, is_current, description, sort_order, country, project_name, reference_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [personId, e.organisation || null, e.position || null, e.occupation_id || null,
         e.from_date || null, e.to_date || null, !!e.is_current, e.description || null, i,
         e.country || null, e.project_name || null, e.reference_text || null]);
    }
    await client.query('DELETE FROM hr_languages WHERE person_id = $1', [personId]);
    const langs = (body.languages || []).filter(l => (l.language || '').trim());
    for (let i = 0; i < langs.length; i++) {
      const l = langs[i];
      await client.query(
        `INSERT INTO hr_languages (person_id, language, speaking, reading, writing, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [personId, l.language.trim(), l.speaking || null, l.reading || null, l.writing || null, i]);
    }
    if (body.occupation_overrides) {
      await client.query('DELETE FROM hr_person_occupations WHERE person_id = $1', [personId]);
      for (const o of body.occupation_overrides) {
        if (!o.occupation_id) continue;
        await client.query(
          `INSERT INTO hr_person_occupations (person_id, occupation_id, mode, note)
           VALUES ($1,$2,$3,$4) ON CONFLICT (person_id, occupation_id) DO UPDATE SET mode=$3, note=$4`,
          [personId, o.occupation_id, o.mode === 'remove' ? 'remove' : 'add', o.note || null]);
      }
    }
  };

  fastify.post('/people', async (request, reply) => {
    if (!request.body?.full_name?.trim()) return reply.code(400).send({ error: 'A name is required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const cols = PERSON_FIELDS.join(',');
      const holders = PERSON_FIELDS.map((_, i) => `$${i + 1}`).join(',');
      const { rows: [p] } = await client.query(
        `INSERT INTO hr_people (${cols}, created_by)
         VALUES (${holders}, $${PERSON_FIELDS.length + 1}) RETURNING *`,
        [...personValues(request.body), request.user.id]);
      await saveChildren(client, p.id, request.body);
      await client.query('COMMIT');
      return reply.code(201).send(p);
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.put('/people/:id', async (request, reply) => {
    if (!request.body?.full_name?.trim()) return reply.code(400).send({ error: 'A name is required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sets = PERSON_FIELDS.map((f, i) => `${f}=$${i + 1}`).join(',');
      const { rows } = await client.query(
        `UPDATE hr_people SET ${sets}, updated_at = NOW()
          WHERE id = $${PERSON_FIELDS.length + 1} RETURNING *`,
        [...personValues(request.body), request.params.id]);
      if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }
      await saveChildren(client, request.params.id, request.body);
      await client.query('COMMIT');
      return rows[0];
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.delete('/people/:id', { preHandler: requireAdmin }, async (request) => {
    await pool.query('DELETE FROM hr_people WHERE id = $1', [request.params.id]);
    return { deleted: true };
  });

  // ─── Documents ─────────────────────────────────────────────────────────────
  //
  // Stored in the database as base64, the same fallback the institute documents
  // route uses when R2 is not configured. Deliberately not sharing that route's
  // bucket path: these are personal records, and keeping their key space
  // separate keeps a mistake in one from exposing the other.

  fastify.post('/people/:id/documents', async (request, reply) => {
    const { doc_type, file_name, file_size, content_type, file_data,
            qualification_id, experience_id } = request.body || {};
    if (!file_name || !file_data) return reply.code(400).send({ error: 'file_name and file_data required' });
    const { rows: [p] } = await pool.query('SELECT id FROM hr_people WHERE id = $1', [request.params.id]);
    if (!p) return reply.code(404).send({ error: 'Person not found' });
    const ext = (file_name.split('.').pop() || 'bin').toLowerCase();
    const key = `db/hr/${request.params.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { rows } = await pool.query(
      `INSERT INTO hr_documents (person_id, qualification_id, experience_id, doc_type,
         file_name, file_key, file_size, content_type, file_data, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, person_id, qualification_id, experience_id, doc_type, file_name,
                 file_key, file_size, content_type, uploaded_at`,
      [request.params.id, qualification_id || null, experience_id || null, doc_type || 'Other',
       file_name, key, file_size || null, content_type || null, file_data, request.user.id]);
    return reply.code(201).send(rows[0]);
  });

  fastify.get('/documents/:id/download', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT file_name, content_type, file_data FROM hr_documents WHERE id = $1', [request.params.id]);
    if (!rows.length || !rows[0].file_data) return reply.code(404).send({ error: 'Not found' });
    return sendStoredFile(reply, rows[0], Buffer.from(rows[0].file_data, 'base64'));
  });

  fastify.delete('/documents/:id', async (request) => {
    await pool.query('DELETE FROM hr_documents WHERE id = $1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
module.exports.ELIGIBILITY_CTE = ELIGIBILITY_CTE;
