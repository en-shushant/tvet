// routes/clients.js
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    return (await pool.query('SELECT * FROM clients WHERE is_active=TRUE ORDER BY short_name')).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks,
            phone, email, website, signatory_name, signatory_position, letterhead,
            name_np, address_np, includes_ojt } = request.body;
    if (!full_name || !short_name) return reply.code(400).send({ error: 'full_name and short_name required' });
    const { rows } = await pool.query(
      `INSERT INTO clients (full_name,short_name,type,address,remarks,
        phone,email,website,signatory_name,signatory_position,letterhead,
        name_np,address_np,includes_ojt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [full_name,short_name,type,address,remarks,
       phone||null,email||null,website||null,signatory_name||null,signatory_position||null,letterhead||null,
       name_np||null,address_np||null,!!includes_ojt]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { full_name, short_name, type, address, remarks,
            phone, email, website, signatory_name, signatory_position, letterhead,
            name_np, address_np, includes_ojt } = request.body;
    const { rows } = await pool.query(
      `UPDATE clients SET full_name=$1,short_name=$2,type=$3,address=$4,remarks=$5,
        phone=$6,email=$7,website=$8,signatory_name=$9,signatory_position=$10,letterhead=$11,
        name_np=$12,address_np=$13,includes_ojt=$15
       WHERE id=$14 RETURNING *`,
      [full_name,short_name,type,address,remarks,
       phone||null,email||null,website||null,signatory_name||null,signatory_position||null,letterhead||null,
       name_np||null,address_np||null,
       request.params.id,!!includes_ojt]
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
