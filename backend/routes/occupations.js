// routes/occupations.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { sector, search } = req.query;
    let q = 'SELECT * FROM occupations WHERE is_active=TRUE';
    const params = [];
    if (sector) { params.push(sector); q += ` AND sector=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND name ILIKE $${params.length}`; }
    q += ' ORDER BY sector, name';
    res.json((await pool.query(q, params)).rows);
  } catch(e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  try {
    const { name, sector, duration, level } = req.body;
    if (!name || !sector) return res.status(400).json({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'INSERT INTO occupations (name,sector,duration,level,is_custom) VALUES ($1,$2,$3,$4,TRUE) RETURNING *',
      [name, sector, duration || null, level || null]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  try {
    const { name, sector, duration, level } = req.body;
    if (!name || !sector) return res.status(400).json({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'UPDATE occupations SET name=$1,sector=$2,duration=$3,level=$4 WHERE id=$5 RETURNING *',
      [name, sector, duration || null, level || null, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('UPDATE occupations SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
