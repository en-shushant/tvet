// routes/affiliations.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { institute_id } = req.query;
    const q = `SELECT af.*, json_agg(ap.* ORDER BY ap.sort_order) FILTER (WHERE ap.id IS NOT NULL) as programs
      FROM affiliations af LEFT JOIN affiliation_programs ap ON ap.affiliation_id = af.id
      ${institute_id ? 'WHERE af.institute_id=$1' : ''}
      GROUP BY af.id ORDER BY af.affiliation_date DESC`;
    res.json((await pool.query(q, institute_id ? [institute_id] : [])).rows);
  } catch(e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { institute_id, patra_no, chalani_no, affiliation_date, type,
      validity_years, expiry_date, status, remarks, programs = [] } = req.body;
    if (!institute_id || !affiliation_date)
      return res.status(400).json({ error: 'institute_id and affiliation_date required' });
    const { rows: [aff] } = await client.query(
      `INSERT INTO affiliations (institute_id,patra_no,chalani_no,affiliation_date,type,
        validity_years,expiry_date,status,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [institute_id,patra_no,chalani_no,affiliation_date,type,validity_years||2,expiry_date,status||'Active',remarks]
    );
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      await client.query(
        `INSERT INTO affiliation_programs (affiliation_id,name,level,duration_hours,seats_per_batch,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [aff.id,p.name,p.level,p.duration||null,p.seats||null,i]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(aff);
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { patra_no, chalani_no, affiliation_date, type, validity_years,
      expiry_date, status, remarks, programs = [] } = req.body;
    const { rows } = await client.query(
      `UPDATE affiliations SET patra_no=$1,chalani_no=$2,affiliation_date=$3,type=$4,
        validity_years=$5,expiry_date=$6,status=$7,remarks=$8 WHERE id=$9 RETURNING *`,
      [patra_no,chalani_no,affiliation_date,type,validity_years,expiry_date,status,remarks,req.params.id]
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
    await client.query('DELETE FROM affiliation_programs WHERE affiliation_id=$1', [req.params.id]);
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];
      await client.query(
        `INSERT INTO affiliation_programs (affiliation_id,name,level,duration_hours,seats_per_batch,sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [req.params.id,p.name,p.level,p.duration||null,p.seats||null,i]
      );
    }
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM affiliations WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
