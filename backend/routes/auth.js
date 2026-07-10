// routes/auth.js
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');

const CAP_SECRET = process.env.CAP_SECRET_KEY;
const CAP_SITEVERIFY = 'http://185.199.53.214:32769/355cfb251c/siteverify';

async function verifyCapToken(token) {
  if (!token) return { ok: false, reason: 'Please complete the CAPTCHA' };
  if (!CAP_SECRET) {
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
    console.error('Cap server unreachable:', e.message);
    return { ok: true };
  }
}

async function plugin(fastify, opts) {
  fastify.post('/register', async (request, reply) => {
    const { name, email, password, role = 'user' } = request.body;
    if (!name || !email || !password) return reply.code(400).send({ error: 'name, email and password required' });
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
        [name, email, hash, role]
      );
      return reply.code(201).send({ user: rows[0], token: signToken(rows[0]) });
    } catch(e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Email already registered' });
      throw e;
    }
  });

  fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' });
    const capResult = await verifyCapToken(request.body['cap-token']);
    if (!capResult.ok) return reply.code(400).send({ error: capResult.reason });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return reply.code(401).send({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return reply.code(401).send({ error: 'Invalid credentials' });
    const { password: _, ...userOut } = user;
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    return { user: userOut, token: signToken(tokenPayload) };
  });

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1', [request.user.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });
    return rows[0];
  });

  fastify.put('/password', { preHandler: authenticate }, async (request, reply) => {
    const { current_password, new_password } = request.body;
    if (!current_password || !new_password) return reply.code(400).send({ error: 'current_password and new_password required' });
    if (new_password.length < 6) return reply.code(400).send({ error: 'New password must be at least 6 characters' });
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [request.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) return reply.code(401).send({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, request.user.id]);
    return { success: true };
  });
}

module.exports = plugin;
