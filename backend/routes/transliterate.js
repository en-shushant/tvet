// routes/transliterate.js — English typing → Nepali suggestions for Nepali fields.
const { authenticate } = require('../middleware/auth');
const { suggest } = require('../lib/transliterate');
const { makeLimiter } = require('../lib/nstbResult');

async function plugin(fastify) {
  fastify.addHook('preHandler', authenticate);
  const limit = makeLimiter({ perUser: 600, overall: 6000, windowMs: 10 * 60 * 1000 });
  fastify.get('/', async (request, reply) => {
    if (!limit(request.user.id)) return reply.code(429).send({ error: 'Too many requests' });
    return { suggestions: await suggest(request.query.q) };
  });
}
module.exports = plugin;
