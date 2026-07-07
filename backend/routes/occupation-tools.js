// routes/occupation-tools.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/counts', async (request, reply) => {
    const { rows } = await pool.query(
      `SELECT occupation_id, level, COUNT(*)::int as count FROM occupation_tools GROUP BY occupation_id, level ORDER BY occupation_id, level`
    );
    return rows;
  });

  fastify.get('/:occupationId/:level', async (request, reply) => {
    const { occupationId, level } = request.params;
    const { rows } = await pool.query(
      'SELECT * FROM occupation_tools WHERE occupation_id=$1 AND level=$2 ORDER BY sort_order, id',
      [occupationId, level]
    );
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { occupation_id, level, name, description, unit, quantity, ownership, type, remarks, sort_order } = request.body;
    if (!occupation_id || !level || !name) return reply.code(400).send({ error: 'occupation_id, level and name required' });
    const { rows } = await pool.query(
      `INSERT INTO occupation_tools (occupation_id, level, name, description, unit, quantity, ownership, type, remarks, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [occupation_id, level, name, description || null, unit || null, quantity || null, ownership || 'Own', type || 'Tool', remarks || null, sort_order || 0]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { name, description, unit, quantity, ownership, type, remarks, sort_order } = request.body;
    if (!name) return reply.code(400).send({ error: 'name required' });
    const { rows } = await pool.query(
      `UPDATE occupation_tools SET name=$1, description=$2, unit=$3, quantity=$4, ownership=$5, type=$6, remarks=$7, sort_order=$8
       WHERE id=$9 RETURNING *`,
      [name, description || null, unit || null, quantity || null, ownership || 'Own', type || 'Tool', remarks || null, sort_order || 0, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireWriter }, async (request, reply) => {
    await pool.query('DELETE FROM occupation_tools WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
