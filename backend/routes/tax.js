// routes/tax.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { institute_id } = req.query;
    const q = institute_id
      ? 'SELECT * FROM tax_clearances WHERE institute_id=$1 ORDER BY fiscal_year DESC'
      : 'SELECT * FROM tax_clearances ORDER BY fiscal_year DESC';
    res.json((await pool.query(q, institute_id ? [institute_id] : [])).rows);
  } catch(e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  try {
    const { institute_id, fiscal_year, turnover, taxable_income, tax_paid,
      cert_date, kar_chuta_no, patra_no, income_statement_date, remarks } = req.body;
    if (!institute_id || !fiscal_year || !turnover || !taxable_income || !tax_paid)
      return res.status(400).json({ error: 'institute_id, fiscal_year, turnover, taxable_income, tax_paid required' });
    const { rows } = await pool.query(
      `INSERT INTO tax_clearances (institute_id,fiscal_year,turnover,taxable_income,tax_paid,
        cert_date,kar_chuta_no,patra_no,income_statement_date,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [institute_id,fiscal_year,turnover,taxable_income,tax_paid,cert_date,kar_chuta_no,patra_no,income_statement_date,remarks]
    );
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: `Tax clearance for fiscal year ${req.body.fiscal_year} already exists. Edit the existing record instead.` });
    next(e);
  }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  try {
    const { fiscal_year, turnover, taxable_income, tax_paid,
      cert_date, kar_chuta_no, patra_no, income_statement_date, remarks } = req.body;
    const { rows } = await pool.query(
      `UPDATE tax_clearances SET fiscal_year=$1,turnover=$2,taxable_income=$3,tax_paid=$4,
        cert_date=$5,kar_chuta_no=$6,patra_no=$7,income_statement_date=$8,remarks=$9
       WHERE id=$10 RETURNING *`,
      [fiscal_year,turnover,taxable_income,tax_paid,cert_date,kar_chuta_no,patra_no,income_statement_date,remarks,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tax_clearances WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
