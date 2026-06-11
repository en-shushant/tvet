// routes/templates.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM assignment_templates WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
  } catch(e) { next(e); }
});

router.post('/', requireWriter, async (req, res, next) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'name and data required' });
    const { rows } = await pool.query(
      'INSERT INTO assignment_templates (user_id,name,data) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, name, JSON.stringify(data)]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM assignment_templates WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
