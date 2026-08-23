// routes/dashboard.js
const { pool } = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { assignmentScope } = require('../middleware/visibility');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // Returns counts of records added/updated in the last 30 days
  fastify.get('/activity', async (request, reply) => {
    const [assignments, tax, nstb, affiliations, institutes] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM assignments a WHERE a.created_at >= NOW() - INTERVAL '30 days'${assignmentScope(request.user, 'a')}`),
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

  /**
   * Registry-wide totals for the dashboard.
   *
   * GET /institutes omits assignments entirely (`'[]'::json AS experience`) and
   * carries no district data, so these cannot be derived on the client — the
   * dashboard would have to invent them. Counted here instead.
   */
  fastify.get('/totals', async (request, reply) => {
    const [assignments, clients, districts, byFy] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM assignments a WHERE 1=1${assignmentScope(request.user, 'a')}`),
      // Distinct clients actually engaged, not rows in the clients table.
      pool.query(`SELECT COUNT(DISTINCT a.client_id)::int AS n FROM assignments a WHERE a.client_id IS NOT NULL${assignmentScope(request.user, 'a')}`),
      // Districts live in the per-occupation locations JSONB.
      pool.query(`
        SELECT COUNT(DISTINCT loc->>'district')::int AS n
        FROM assignment_occupations ao
        JOIN assignments a ON a.id = ao.assignment_id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ao.locations, '[]'::jsonb)) AS loc
        WHERE COALESCE(loc->>'district', '') <> ''${assignmentScope(request.user, 'a')}`),
      pool.query(`
        SELECT a.fiscal_year AS fy,
               COUNT(DISTINCT a.id)::int AS assignments,
               COALESCE(SUM(ao.trainees), 0)::int AS trainees
        FROM assignments a
        LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
        WHERE COALESCE(a.fiscal_year, '') <> ''${assignmentScope(request.user, 'a')}
        GROUP BY a.fiscal_year
        ORDER BY a.fiscal_year`),
    ]);
    return {
      assignments: assignments.rows[0].n,
      clients: clients.rows[0].n,
      districts: districts.rows[0].n,
      byFy: byFy.rows,
    };
  });
}

module.exports = plugin;
