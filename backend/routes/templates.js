// routes/templates.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT * FROM assignment_templates WHERE user_id=$1 ORDER BY created_at DESC', [request.user.id]
    );
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { name, data } = request.body;
    if (!name || !data) return reply.code(400).send({ error: 'name and data required' });
    const { rows } = await pool.query(
      'INSERT INTO assignment_templates (user_id,name,data) VALUES ($1,$2,$3) RETURNING *',
      [request.user.id, name, JSON.stringify(data)]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.delete('/:id', async (request, reply) => {
    await pool.query('DELETE FROM assignment_templates WHERE id=$1 AND user_id=$2', [request.params.id, request.user.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
