// routes/institutes.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let q = `SELECT i.*,
      COALESCE(json_agg(DISTINCT jsonb_build_object('fy', t.fiscal_year, 'turnover', t.turnover)) FILTER (WHERE t.id IS NOT NULL), '[]') as "taxClearance",
      COALESCE(json_agg(DISTINCT jsonb_build_object('fy', n.fiscal_year)) FILTER (WHERE n.id IS NOT NULL), '[]') as nstb,
      COALESCE(json_agg(DISTINCT jsonb_build_object('status', a.status, 'expiryDate', a.expiry_date, 'affiliationDate', a.affiliation_date)) FILTER (WHERE a.id IS NOT NULL), '[]') as affiliation,
      COALESCE('[]'::json, '[]') as experience,
      COALESCE((SELECT SUM(ao.trainees) FROM assignments a2 JOIN assignment_occupations ao ON ao.assignment_id = a2.id WHERE a2.institute_id = i.id), 0) as total_trainees,
      COALESCE((SELECT SUM(ao.skill_test_appeared) FROM assignments a2 JOIN assignment_occupations ao ON ao.assignment_id = a2.id WHERE a2.institute_id = i.id), 0) as total_st_appeared,
      COALESCE((SELECT COUNT(DISTINCT a2.client_id) FROM assignments a2 WHERE a2.institute_id = i.id AND a2.client_id IS NOT NULL), 0) as total_clients,
      COALESCE((SELECT COUNT(*) FROM affiliations af2 JOIN affiliation_programs ap ON ap.affiliation_id = af2.id WHERE af2.institute_id = i.id), 0) as total_aff_programs
      FROM institutes i
      LEFT JOIN tax_clearances t ON t.institute_id = i.id
      LEFT JOIN nstb_records n ON n.institute_id = i.id
      LEFT JOIN affiliations a ON a.institute_id = i.id
      WHERE 1=1`;
    const params = [];
    if (req.user.role === 'editor') {
      params.push(req.user.id);
      q += ` AND i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length})`;
    }
    if (status) { params.push(status); q += ` AND i.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (i.name ILIKE $${params.length} OR i.acronym ILIKE $${params.length} OR i.reg_no ILIKE $${params.length} OR i.pan ILIKE $${params.length})`; }
    q += ' GROUP BY i.id ORDER BY i.name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch(e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const [inst, assignments, nstb, tax, affiliations] = await Promise.all([
      pool.query('SELECT * FROM institutes WHERE id = $1', [id]),
      pool.query(`
        SELECT a.*,
          json_agg(DISTINCT ao.*) FILTER (WHERE ao.id IS NOT NULL) as occupations,
          json_agg(DISTINCT al.*) FILTER (WHERE al.id IS NOT NULL) as locations
        FROM assignments a
        LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
        LEFT JOIN assignment_locations al ON al.assignment_id = a.id
        WHERE a.institute_id = $1
        GROUP BY a.id ORDER BY a.fiscal_year DESC, a.id`, [id]),
      pool.query('SELECT * FROM nstb_records WHERE institute_id = $1 ORDER BY fiscal_year DESC', [id]),
      pool.query('SELECT * FROM tax_clearances WHERE institute_id = $1 ORDER BY fiscal_year DESC', [id]),
      pool.query(`
        SELECT af.*, json_agg(ap.* ORDER BY ap.sort_order) FILTER (WHERE ap.id IS NOT NULL) as programs
        FROM affiliations af
        LEFT JOIN affiliation_programs ap ON ap.affiliation_id = af.id
        WHERE af.institute_id = $1
        GROUP BY af.id ORDER BY af.affiliation_date DESC`, [id]),
    ]);
    if (!inst.rows.length) return res.status(404).json({ error: 'Institute not found' });
    res.json({
      ...inst.rows[0],
      experience: assignments.rows,
      nstb: nstb.rows,
      taxClearance: tax.rows,
      affiliation: affiliations.rows,
    });
  } catch(e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, acronym, reg_no, reg_date, pan, permanent_account_no,
      contact_person, phone, email, address, type, status, renewal_due, remarks, logo, website } = req.body;
    if (!name || !reg_no) return res.status(400).json({ error: 'name and reg_no required' });
    const { rows } = await pool.query(
      `INSERT INTO institutes (name,acronym,reg_no,reg_date,pan,permanent_account_no,
        contact_person,phone,email,address,type,status,renewal_due,remarks,logo,website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [name,acronym,reg_no,reg_date,pan,permanent_account_no,
       contact_person,phone,email,address,type,status||'Active',renewal_due,remarks,logo||null,website||null]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'editor') {
      const { rows: assigned } = await pool.query('SELECT 1 FROM user_institutes WHERE user_id=$1 AND institute_id=$2', [req.user.id, id]);
      if (!assigned.length) return res.status(403).json({ error: 'Not assigned to this institute' });
    }
    const { name, acronym, reg_no, reg_date, pan, permanent_account_no,
      contact_person, phone, email, address, type, status, renewal_due, remarks, logo, website,
      desc_template_id, narrative_template_id, services_template_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE institutes SET name=$1,acronym=$2,reg_no=$3,reg_date=$4,pan=$5,
        permanent_account_no=$6,contact_person=$7,phone=$8,email=$9,address=$10,
        type=$11,status=$12,renewal_due=$13,remarks=$14,logo=$15,website=$16,
        desc_template_id=$17,narrative_template_id=$18,services_template_id=$19
       WHERE id=$20 RETURNING *`,
      [name,acronym,reg_no,reg_date,pan,permanent_account_no,
       contact_person,phone,email,address,type,status,renewal_due,remarks,logo||null,website||null,
       desc_template_id||null,narrative_template_id||null,services_template_id||null,id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM institutes WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
