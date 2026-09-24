// routes/auth.js
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');

async function verifyTurnstileToken(token, remoteip) {
  /*
   * No secret configured means this instance does not do CAPTCHA at all —
   * a local build or a self-hosted copy without a Cloudflare account.
   *
   * The token check used to come first, which made that half-true: the server
   * announced it was skipping verification and then refused the login anyway
   * for want of a token it had just decided not to check. The widget only
   * renders on the domain its site key is registered against, so on any other
   * host there was no token to send and no way in at all.
   *
   * Production sets the secret, so both the token and the verification stay
   * required there.
   */
  if (!process.env.TURNSTILE_SECRET) {
    console.warn('TURNSTILE_SECRET not set — CAPTCHA disabled on this instance');
    return { ok: true };
  }
  if (!token) return { ok: false, reason: 'Please complete the CAPTCHA verification.' };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET,
        response: token,
        remoteip: remoteip || '',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, reason: 'CAPTCHA verification failed' };
    const result = await r.json();
    return result.success ? { ok: true } : { ok: false, reason: 'CAPTCHA verification failed' };
  } catch (e) {
    console.error('Turnstile siteverify unreachable:', e.message);
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
    const remoteip = request.headers['x-forwarded-for']?.split(',')[0].trim() || request.ip;
    const capResult = await verifyTurnstileToken(request.body['cf-turnstile-response'], remoteip);
    if (!capResult.ok) return reply.code(400).send({ error: capResult.reason });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return reply.code(401).send({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return reply.code(401).send({ error: 'Invalid credentials' });
    const { password: _, ...userOut } = user;
    // `hr` rides along so the client knows whether to show the pool in the nav.
    // It never authorises anything: requireHRAccess re-reads the database, so
    // revoking access takes effect at once rather than when this token expires.
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role,
                           hr: !!user.can_access_hr };
    return { user: userOut, token: signToken(tokenPayload) };
  });

  fastify.post('/refresh', { preHandler: authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, can_access_hr AS hr FROM users WHERE id = $1', [request.user.id]
    );
    if (!rows.length) return reply.code(401).send({ error: 'User not found' });
    return { token: signToken(rows[0]) };
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
