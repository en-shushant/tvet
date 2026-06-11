// routes/clients.js
const router = require('express').Router();
const { pool } = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    res.json((await pool.query('SELECT * FROM clients WHERE is_active=TRUE ORDER BY short_name')).rows);
  } catch(e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { full_name, short_name, type, address, remarks } = req.body;
    if (!full_name || !short_name) return res.status(400).json({ error: 'full_name and short_name required' });
    const { rows } = await pool.query(
      'INSERT INTO clients (full_name,short_name,type,address,remarks) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [full_name,short_name,type,address,remarks]
    );
    res.status(201).json(rows[0]);
  } catch(e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { full_name, short_name, type, address, remarks } = req.body;
    const { rows } = await pool.query(
      'UPDATE clients SET full_name=$1,short_name=$2,type=$3,address=$4,remarks=$5 WHERE id=$6 RETURNING *',
      [full_name,short_name,type,address,remarks,req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM assignments WHERE client_id=$1', [req.params.id]);
    if (parseInt(rows[0].count) > 0) {
      await pool.query('UPDATE clients SET is_active=FALSE WHERE id=$1', [req.params.id]);
      return res.json({ deactivated: true });
    }
    await pool.query('DELETE FROM clients WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

module.exports = router;
