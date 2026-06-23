const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');
router.use(authenticate);

router.get('/:occupationId/:level', async (req, res, next) => {
  try {
    const { occupationId, level } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM occupation_tools WHERE occupation_id=$1 AND level=$2 ORDER BY sort_order, id',
      [occupationId, level]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  try {
    const { occupation_id, level, name, description, unit, quantity, ownership, type, remarks, sort_order } = req.body;
    if (!occupation_id || !level || !description) return res.status(400).json({ error: 'occupation_id, level and description required' });
    const { rows } = await pool.query(
      `INSERT INTO occupation_tools (occupation_id, level, name, description, unit, quantity, ownership, type, remarks, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [occupation_id, level, name || null, description, unit || null, quantity || null, ownership || 'Own', type || 'Tool', remarks || null, sort_order || 0]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

router.put('/:id', requireWriter, async (req, res, next) => {
  try {
    const { name, description, unit, quantity, ownership, type, remarks, sort_order } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    const { rows } = await pool.query(
      `UPDATE occupation_tools SET name=$1, description=$2, unit=$3, quantity=$4, ownership=$5, type=$6, remarks=$7, sort_order=$8
       WHERE id=$9 RETURNING *`,
      [name || null, description, unit || null, quantity || null, ownership || 'Own', type || 'Tool', remarks || null, sort_order || 0, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

router.delete('/:id', requireWriter, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM occupation_tools WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch (e) { next(e); }
});

module.exports = router;
