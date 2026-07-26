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

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authenticate, requireAdmin, requireSuperAdmin, requireWriter, signToken };
