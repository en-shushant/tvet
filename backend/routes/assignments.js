// routes/assignments.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { institute_id, fy } = req.query;
    let q = `SELECT a.*, c.short_name as client_short_name, c.full_name as client_full_name, c.type as client_type,
      json_agg(ao.* ORDER BY ao.sort_order) FILTER (WHERE ao.id IS NOT NULL) as occupations,
      json_agg(al.* ORDER BY al.sort_order) FILTER (WHERE al.id IS NOT NULL) as locations
      FROM assignments a
      LEFT JOIN clients c ON c.id = a.client_id
      LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
      LEFT JOIN assignment_locations al ON al.assignment_id = a.id
      WHERE 1=1`;
    const params = [];
    if (institute_id) { params.push(institute_id); q += ` AND a.institute_id = $${params.length}`; }
    if (fy) { params.push(fy); q += ` AND a.fiscal_year = $${params.length}`; }
    q += ' GROUP BY a.id, c.id ORDER BY a.fiscal_year DESC, a.id';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch(e) { next(e); }
});

function insertOccupation(client, assignmentId, o, i) {
  return client.query(
    `INSERT INTO assignment_occupations (assignment_id,name_in_letter,ctevt_occupation_id,trainees,
      duration_hours,level,skill_test_provisioned,skill_test_appeared,skill_test_pass,
      employment_provisioned,employment_actual_pct,locations,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      assignmentId,
      o.name_in_letter || o.nameInLetter || '',
      o.ctevt_occupation_id || o.ctevtOccupationId || null,
      o.trainees || null,
      o.duration || o.duration_hours || null,
      o.level || null,
      !!(o.skill_test_provisioned ?? o.skillTestProvisioned),
      o.skill_test_appeared ?? o.skillTestAppeared ?? null,
      o.skill_test_pass ?? o.skillTestPass ?? null,
      !!(o.employment_provisioned ?? o.employmentProvisioned),
      o.employment_actual_pct ?? o.employmentActual ?? null,
      JSON.stringify(o.locations || []),
      i,
    ]
  );
}

router.post('/', requireWriter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { institute_id, client_id, client_name_manual, fiscal_year, assignment_name, training_type,
      contract_value, contract_amount, start_date, end_date, start_fy, end_fy,
      remarks, reference_file, reference_file_name, is_gesi, is_residential,
      is_jv, jv_role, jv_partners,
      occupations = [], locations = [] } = req.body;

    if (!institute_id || !fiscal_year || !assignment_name)
      return res.status(400).json({ error: 'institute_id, fiscal_year, assignment_name required' });

    const { rows: [asgn] } = await client.query(
      `INSERT INTO assignments (institute_id,client_id,client_name_manual,fiscal_year,assignment_name,training_type,
        contract_value,start_date,end_date,start_fy,end_fy,remarks,reference_file,reference_file_name,
        is_gesi,is_residential,is_jv,jv_role,jv_partners)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
      [institute_id, client_id||null, client_name_manual||null, fiscal_year, assignment_name, training_type,
       contract_value||contract_amount||null, start_date||null, end_date||null, start_fy||null, end_fy||null,
       remarks, reference_file||null, reference_file_name||null,
       !!is_gesi, !!is_residential, !!is_jv, is_jv ? (jv_role||'Lead') : null, is_jv ? (jv_partners||null) : null]
    );

    for (let i = 0; i < occupations.length; i++) {
      await insertOccupation(client, asgn.id, occupations[i], i);
    }

    await client.query('COMMIT');
    res.status(201).json(asgn);
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { client_id, client_name_manual, fiscal_year, assignment_name, training_type,
      contract_value, contract_amount, start_date, end_date, start_fy, end_fy,
      remarks, reference_file, reference_file_name, is_gesi, is_residential,
      is_jv, jv_role, jv_partners,
      occupations = [], locations = [] } = req.body;

    const { rows } = await client.query(
      `UPDATE assignments SET client_id=$1,client_name_manual=$2,fiscal_year=$3,assignment_name=$4,training_type=$5,
        contract_value=$6,start_date=$7,end_date=$8,start_fy=$9,end_fy=$10,remarks=$11,
        reference_file=$12,reference_file_name=$13,is_gesi=$14,is_residential=$15,
        is_jv=$16,jv_role=$17,jv_partners=$18
       WHERE id=$19 RETURNING *`,
      [client_id||null, client_name_manual||null, fiscal_year, assignment_name, training_type,
       contract_value||contract_amount||null, start_date||null, end_date||null, start_fy||null, end_fy||null,
       remarks, reference_file||null, reference_file_name||null,
       !!is_gesi, !!is_residential,
       !!is_jv, is_jv ? (jv_role||'Lead') : null, is_jv ? (jv_partners||null) : null, id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }

    await client.query('DELETE FROM assignment_occupations WHERE assignment_id = $1', [id]);
    await client.query('DELETE FROM assignment_locations WHERE assignment_id = $1', [id]);

    for (let i = 0; i < occupations.length; i++) {
      await insertOccupation(client, id, occupations[i], i);
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM assignments WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
