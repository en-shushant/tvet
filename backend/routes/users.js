// routes/users.js — user management (admin only)
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireSuperAdmin, signToken } = require('../middleware/auth');

router.use(authenticate);

// List all users (non-superadmin callers cannot see superadmin accounts)
router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const query = req.user.role === 'superadmin'
      ? 'SELECT id, name, email, role, is_active, photo, created_at FROM users ORDER BY created_at DESC'
      : "SELECT id, name, email, role, is_active, photo, created_at FROM users WHERE role != 'superadmin' ORDER BY created_at DESC";
    const { rows } = await pool.query(query);
    res.json(rows);
  } catch(e) { next(e); }
});

// Create user
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = 'editor', photo } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
    // Only superadmin can create admin/superadmin users
    if ((role === 'admin' || role === 'superadmin') && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can create admin users' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role, is_active, photo) VALUES ($1,$2,$3,$4,TRUE,$5) RETURNING id, name, email, role, is_active, photo, created_at',
      [name, email, hash, role, photo||null]
    );
    res.status(201).json(rows[0]);
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(e);
  }
});

// Update user
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role, is_active, photo } = req.body;
    // Only superadmin can assign admin/superadmin roles
    if ((role === 'admin' || role === 'superadmin') && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can assign admin roles' });
    }
    let q, params;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      q = 'UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password=$5, photo=$6 WHERE id=$7 RETURNING id, name, email, role, is_active, photo, created_at';
      params = [name, email, role, is_active, hash, photo||null, req.params.id];
    } else {
      q = 'UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, photo=$5 WHERE id=$6 RETURNING id, name, email, role, is_active, photo, created_at';
      params = [name, email, role, is_active, photo||null, req.params.id];
    }
    const { rows } = await pool.query(q, params);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

// Delete user — superadmin only
router.delete('/:id', requireSuperAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ deleted: true });
  } catch(e) { next(e); }
});

const ensureUserInstitutes = async () => {
  await pool.query(`CREATE TABLE IF NOT EXISTS user_institutes (
    user_id UUID NOT NULL,
    institute_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, institute_id)
  )`);
  // fix old table created with wrong user_id type
  await pool.query(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='user_institutes' AND column_name='user_id' AND data_type='integer'
      ) THEN
        DROP TABLE user_institutes;
        CREATE TABLE user_institutes (
          user_id UUID NOT NULL,
          institute_id INTEGER NOT NULL,
          PRIMARY KEY (user_id, institute_id)
        );
      END IF;
    END $$
  `);
};

// Get assigned institutes for a user
router.get('/:id/institutes', requireAdmin, async (req, res, next) => {
  try {
    await ensureUserInstitutes();
    const { rows } = await pool.query(
      'SELECT institute_id FROM user_institutes WHERE user_id=$1', [req.params.id]
    );
    res.json(rows.map(r => r.institute_id));
  } catch(e) { next(e); }
});

// Set assigned institutes for a user (replaces all)
router.put('/:id/institutes', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await ensureUserInstitutes();
    const { institute_ids = [] } = req.body;
    await client.query('BEGIN');
    await client.query('DELETE FROM user_institutes WHERE user_id=$1', [req.params.id]);
    for (const iid of institute_ids) {
      await client.query('INSERT INTO user_institutes (user_id, institute_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, iid]);
    }
    await client.query('COMMIT');
    res.json({ assigned: institute_ids });
  } catch(e) { await client.query('ROLLBACK'); next(e); }
  finally { client.release(); }
});

module.exports = router;
