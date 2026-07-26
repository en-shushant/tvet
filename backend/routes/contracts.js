// routes/contracts.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // List contracts, optionally filtered by client_id and/or fy
  // Returns each contract with quotation summary counts
  fastify.get('/', async (request) => {
    const { client_id, fy } = request.query;
    const conditions = [];
    const params = [];
    if (client_id) { params.push(client_id); conditions.push(`c.client_id=$${params.length}`); }
    if (fy)        { params.push(fy);        conditions.push(`c.fy=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const q = `
      SELECT c.*,
        cl.full_name AS client_name, cl.short_name AS client_short,
        COUNT(q.id)::int                                          AS quotation_count,
        COUNT(q.id) FILTER (WHERE q.status='Awarded')::int        AS awarded_count,
        COUNT(q.id) FILTER (WHERE q.status='Rejected')::int       AS rejected_count
      FROM contracts c
      LEFT JOIN clients cl ON cl.id = c.client_id
      LEFT JOIN quotations q ON q.contract_id = c.id
      ${where}
      GROUP BY c.id, cl.full_name, cl.short_name
      ORDER BY c.fy DESC, c.created_at DESC
    `;
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, fy, title, description } = request.body;
    if (!fy || !title)
      return reply.code(400).send({ error: 'fy and title are required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO contracts (client_id, client_name_manual, fy, title, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [client_id || null, client_name_manual || null, fy, title, description || null]
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, fy, title, description } = request.body;
    const { rows } = await pool.query(
      `UPDATE contracts SET client_id=$1, client_name_manual=$2, fy=$3, title=$4, description=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [client_id || null, client_name_manual || null, fy, title, description || null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM contracts WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
