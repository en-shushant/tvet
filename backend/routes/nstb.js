// routes/nstb.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { institute_id, fy } = req.query;
    let q = 'SELECT * FROM nstb_records WHERE 1=1';
    const params = [];
    if (institute_id) { params.push(institute_id); q += ` AND institute_id=$${params.length}`; }
    if (fy) { params.push(fy); q += ` AND fiscal_year=$${params.length}`; }
    q += ' ORDER BY fiscal_year DESC, occupation';
    res.json((await pool.query(q, params)).rows);
  } catch(e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  try {
    const { institute_id, fiscal_year, occupation, level, applied, appeared, pass,
      letter_no, letter_date, letter_type, remarks } = req.body;
    if (!institute_id || !occupation || applied == null || appeared == null || pass == null)
      return res.status(400).json({ error: 'institute_id, occupation, applied, appeared, pass required' });
    const { rows } = await pool.query(
      `INSERT INTO nstb_records (institute_id,fiscal_year,occupation,level,applied,appeared,pass,
        letter_no,letter_date,letter_type,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [institute_id,fiscal_year,occupation,level,applied,appeared,pass,letter_no,letter_date,letter_type,remarks]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  try {
    const { fiscal_year, occupation, level, applied, appeared, pass,
      letter_no, letter_date, letter_type, remarks } = req.body;
    const { rows } = await pool.query(
      `UPDATE nstb_records SET fiscal_year=$1,occupation=$2,level=$3,applied=$4,appeared=$5,pass=$6,
        letter_no=$7,letter_date=$8,letter_type=$9,remarks=$10 WHERE id=$11 RETURNING *`,
      [fiscal_year,occupation,level,applied,appeared,pass,letter_no,letter_date,letter_type,remarks,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM nstb_records WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
