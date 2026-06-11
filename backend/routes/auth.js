// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'user' } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password required' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role]
    );
    res.status(201).json({ user: rows[0], token: signToken(rows[0]) });
  } catch(e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    next(e);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _, ...userOut } = user;
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ user: userOut, token: signToken(tokenPayload) });
  } catch(e) { next(e); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch(e) { next(e); }
});

module.exports = router;
