// routes/clients.js
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    return (await pool.query('SELECT * FROM clients WHERE is_active=TRUE ORDER BY short_name')).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks } = request.body;
    if (!full_name || !short_name) return reply.code(400).send({ error: 'full_name and short_name required' });
    const { rows } = await pool.query(
      'INSERT INTO clients (full_name,short_name,type,address,remarks) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [full_name,short_name,type,address,remarks]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks } = request.body;
    const { rows } = await pool.query(
      'UPDATE clients SET full_name=$1,short_name=$2,type=$3,address=$4,remarks=$5 WHERE id=$6 RETURNING *',
      [full_name,short_name,type,address,remarks,request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { rows } = await pool.query('SELECT COUNT(*) FROM assignments WHERE client_id=$1', [request.params.id]);
    if (parseInt(rows[0].count) > 0) {
      await pool.query('UPDATE clients SET is_active=FALSE WHERE id=$1', [request.params.id]);
      return { deactivated: true };
    }
    await pool.query('DELETE FROM clients WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
