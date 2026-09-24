const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tvettrack_dev_secret_change_in_production';

async function authenticate(request, reply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'No token provided' });
  }
  try {
    request.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}

async function requireAdmin(request, reply) {
  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'superadmin')) {
    return reply.code(403).send({ error: 'Admin access required' });
  }
}

async function requireSuperAdmin(request, reply) {
  if (!request.user || request.user.role !== 'superadmin') {
    return reply.code(403).send({ error: 'Superadmin access required' });
  }
}

async function requireWriter(request, reply) {
  const r = request.user?.role;
  if (!r || (r !== 'admin' && r !== 'editor' && r !== 'superadmin' && r !== 'shortlist')) {
    return reply.code(403).send({ error: 'Write access required. Contact your administrator.' });
  }
}

/**
 * Access to the human resource pool.
 *
 * Checked against the database rather than the token. A JWT here lasts 30 days,
 * so a token minted before the permission was revoked would still carry
 * `hr: true` — and this guards citizenship numbers, addresses and CVs, where
 * "revoked but works until they next sign in" is not good enough. The token's
 * copy of the flag exists only so the client knows whether to show the nav
 * item; it is never what authorises a request.
 *
 * A superadmin is admitted without a grant: they administer the grants.
 */
async function requireHRAccess(request, reply) {
  if (!request.user) return reply.code(401).send({ error: 'No token provided' });
  if (request.user.role === 'superadmin') return;
  const { pool } = require('../db/pool');
  const { rows } = await pool.query(
    'SELECT can_access_hr FROM users WHERE id = $1 AND is_active IS NOT FALSE', [request.user.id]);
  if (!rows.length || !rows[0].can_access_hr) {
    return reply.code(403).send({ error: 'You do not have access to the human resource pool.' });
  }
}

function signToken(payload) {
  const { iat, exp, ...clean } = payload; // strip old timestamps so jwt re-issues clean
  return jwt.sign(clean, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireWriter, requireHRAccess, signToken };
