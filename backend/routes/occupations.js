// routes/occupations.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { sector, search } = request.query;
    let q = 'SELECT * FROM occupations WHERE is_active=TRUE';
    const params = [];
    if (sector) { params.push(sector); q += ` AND sector=$${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND name ILIKE $${params.length}`; }
    q += ' ORDER BY sector, name';
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { name, sector, duration, level } = request.body;
    if (!name || !sector) return reply.code(400).send({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'INSERT INTO occupations (name,sector,duration,level,is_custom) VALUES ($1,$2,$3,$4,TRUE) RETURNING *',
      [name, sector, duration || null, level || null]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { name, sector, duration, level } = request.body;
    if (!name || !sector) return reply.code(400).send({ error: 'name and sector required' });
    const { rows } = await pool.query(
      'UPDATE occupations SET name=$1,sector=$2,duration=$3,level=$4 WHERE id=$5 RETURNING *',
      [name, sector, duration || null, level || null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('UPDATE occupations SET is_active=FALSE WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
