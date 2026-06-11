// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');

const CAP_SECRET = process.env.CAP_SECRET_KEY;
const CAP_SITEVERIFY = 'http://185.199.53.214:32769/355cfb251c/siteverify';

async function verifyCapToken(token) {
  if (!token) return { ok: false, reason: 'Please complete the CAPTCHA' };
  if (!CAP_SECRET) {
    // If no secret configured, skip verification (dev mode)
    console.warn('CAP_SECRET_KEY not set — skipping CAPTCHA verification');
    return { ok: true };
  }
  try {
    const res = await fetch(CAP_SITEVERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: CAP_SECRET, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, reason: 'CAPTCHA verification failed' };
    const data = await res.json();
    return data.success ? { ok: true } : { ok: false, reason: 'CAPTCHA verification failed' };
  } catch (e) {
    // Cap server unreachable — fail open with a warning rather than locking users out
    console.error('Cap server unreachable:', e.message);
    return { ok: true };
  }
}

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

    const capResult = await verifyCapToken(req.body['cap-token']);
    if (!capResult.ok) return res.status(400).json({ error: capResult.reason });

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

// Change own password
router.put('/password', authenticate, async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'current_password and new_password required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch(e) { next(e); }
});

module.exports = router;
