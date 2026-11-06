// routes/maintenance.js — turn maintenance mode on and off, and let someone with the code through.
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const M = require('../lib/maintenance');

async function plugin(fastify) {
  // Public: the app asks this before anything else, so it can show the maintenance page.
  fastify.get('/status', async () => M.publicView(await M.load()));

  // Public, and rate limited hard: it is the one place a code can be guessed.
  fastify.post('/bypass', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (request, reply) => {
    const m = await M.load(true);
    if (!m.on) return { pass: null, on: false };
    if (!m.code_hash) return reply.code(403).send({ error: 'No bypass code has been set.' });
    const ok = await M.checkCode(request.body?.code, m.code_hash);
    if (!ok) {
      await new Promise(r => setTimeout(r, 400));
      return reply.code(401).send({ error: 'That code is not right.' });
    }
    return { pass: M.issuePass(m), since: m.since };
  });

  fastify.get('/settings', { preHandler: [authenticate, requireSuperAdmin] }, async () => M.publicView(await M.load(true)));

  /**
   * on / message / code. `generate` makes a code and returns it once; `code` sets one of the
   * superadmin's choosing; `clear_code` removes it. Turning maintenance on starts a new window,
   * which ends any pass given out in an earlier one.
   */
  fastify.put('/settings', { preHandler: [authenticate, requireSuperAdmin] }, async (request, reply) => {
    const b = request.body || {};
    const cur = await M.load(true);
    const patch = {};
    if (typeof b.on === 'boolean') {
      patch.on = b.on;
      if (b.on && !cur.on) patch.since = new Date().toISOString();
    }
    if (typeof b.message === 'string') patch.message = b.message.trim().slice(0, 300);
    let shown = null;
    if (b.generate) { shown = M.generateCode(); patch.code_hash = await M.hashCode(shown); }
    else if (typeof b.code === 'string' && b.code.trim()) {
      if (b.code.trim().length < 6) return reply.code(400).send({ error: 'A bypass code needs at least 6 characters.' });
      patch.code_hash = await M.hashCode(b.code);
    } else if (b.clear_code) patch.code_hash = null;
    if (!Object.keys(patch).length) return reply.code(400).send({ error: 'Nothing to change' });
    const next = await M.save(patch, request.user.id);
    return { ...M.publicView(next), code: shown };
  });
}

module.exports = plugin;
