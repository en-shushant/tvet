const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'tvettrack_dev_secret_change_in_production';

/**
 * Signed out after inactivity.
 *
 * A token lasts 30 days, so on its own it would let anyone holding a forgotten browser or a copied
 * token in for a month. The page signs itself out after 15 idle minutes; this is the server's side
 * of that, so a token that has gone idle is refused even if the page is not there to say so.
 *
 * "Active" means the user's last request. The page sends a small heartbeat while someone is working
 * without hitting the server (writing a letter, say), so activity there keeps them in. A little grace
 * is allowed so the page's own timer, which is the one that speaks, always fires first. The record is
 * kept in memory: a restart forgets it, which only ever lets a request through, never wrongly blocks one.
 * Set IDLE_TIMEOUT_MINUTES=0 to turn it off.
 */
const IDLE_MIN = Number(process.env.IDLE_TIMEOUT_MINUTES ?? 15);
const IDLE_GRACE_MIN = 2;
const lastSeen = new Map();

/** A fresh sign-in is activity: it clears an earlier idle expiry for this user. */
function markActive(userId) { if (userId) lastSeen.set(userId, Date.now()); }

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
  if (IDLE_MIN > 0 && request.user?.id) {
    const now = Date.now();
    const prev = lastSeen.get(request.user.id);
    if (prev && now - prev > (IDLE_MIN + IDLE_GRACE_MIN) * 60000) {
      // Left as it is: the stale record keeps this token out until the user signs in again.
      return reply.code(401).send({ error: 'Signed out after inactivity. Please sign in again.', code: 'idle' });
    }
    lastSeen.set(request.user.id, now);
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

/**
 * Tenders: bids, firms, pricing and who is proposed where. Its own per-user
 * grant, re-read from the database like the pool's so revoking it is instant.
 */
async function requireTenderAccess(request, reply) {
  if (!request.user) return reply.code(401).send({ error: 'No token provided' });
  if (request.user.role === 'superadmin') return;
  const { pool } = require('../db/pool');
  const { rows } = await pool.query(
    'SELECT can_access_tenders FROM users WHERE id = $1 AND is_active IS NOT FALSE', [request.user.id]);
  if (!rows.length || !rows[0].can_access_tenders) {
    return reply.code(403).send({ error: 'You do not have access to tenders.' });
  }
}

function signToken(payload) {
  const { iat, exp, ...clean } = payload; // strip old timestamps so jwt re-issues clean
  return jwt.sign(clean, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { markActive, authenticate, requireAdmin, requireSuperAdmin, requireWriter, requireHRAccess, requireTenderAccess, signToken };
