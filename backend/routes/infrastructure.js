// routes/infrastructure.js — D1 infrastructure per institute
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/:instituteId', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT * FROM institute_infrastructure WHERE institute_id=$1 ORDER BY sort_order, id',
      [request.params.instituteId]
    );
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { institute_id, particular, description, unit, size, ownership, remark, sort_order } = request.body;
    if (!institute_id || !particular) return reply.code(400).send({ error: 'institute_id and particular required' });
    const { rows } = await pool.query(
      `INSERT INTO institute_infrastructure (institute_id, particular, description, unit, size, ownership, remark, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [institute_id, particular, description || null, unit || null, size || null, ownership || 'Own', remark || null, sort_order || 0]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { particular, description, unit, size, ownership, remark, sort_order } = request.body;
    if (!particular) return reply.code(400).send({ error: 'particular required' });
    const { rows } = await pool.query(
      `UPDATE institute_infrastructure SET particular=$1, description=$2, unit=$3, size=$4, ownership=$5, remark=$6, sort_order=$7
       WHERE id=$8 RETURNING *`,
      [particular, description || null, unit || null, size || null, ownership || 'Own', remark || null, sort_order || 0, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireWriter }, async (request, reply) => {
    await pool.query('DELETE FROM institute_infrastructure WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
