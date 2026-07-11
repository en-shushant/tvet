// routes/dashboard.js
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // Returns counts of records added/updated in the last 30 days
  fastify.get('/activity', async (request, reply) => {
    const [assignments, tax, nstb, affiliations, institutes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM assignments WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM tax_clearances WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM nstb_records WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM affiliations WHERE created_at >= NOW() - INTERVAL '30 days'`),
      pool.query(`SELECT COUNT(*) FROM institutes WHERE created_at >= NOW() - INTERVAL '30 days'`),
    ]);
    return {
      assignments: parseInt(assignments.rows[0].count),
      tax: parseInt(tax.rows[0].count),
      nstb: parseInt(nstb.rows[0].count),
      affiliations: parseInt(affiliations.rows[0].count),
      institutes: parseInt(institutes.rows[0].count),
    };
  });
}

module.exports = plugin;
