// routes/shortlists.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // List — optionally filtered by client_id or institute_id
  fastify.get('/', async (request, reply) => {
    const { client_id, institute_id } = request.query;
    const conditions = [];
    const params = [];
    if (client_id)    { params.push(client_id);    conditions.push(`sl.client_id=$${params.length}`); }
    if (institute_id) { params.push(institute_id); conditions.push(`sl.institute_id=$${params.length}`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const q = `
      SELECT sl.*,
        c.full_name  AS client_name,  c.short_name AS client_short,
        i.name       AS institute_name, i.acronym   AS institute_acronym
      FROM shortlists sl
      LEFT JOIN clients    c ON c.id = sl.client_id
      LEFT JOIN institutes i ON i.id = sl.institute_id
      ${where}
      ORDER BY sl.shortlist_date DESC, sl.id DESC
    `;
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, institute_id, standing_list_name, shortlist_date,
            valid_until, status, remarks } = request.body;
    if (!institute_id || !shortlist_date)
      return reply.code(400).send({ error: 'institute_id and shortlist_date are required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO shortlists
        (client_id, institute_id, standing_list_name, shortlist_date, valid_until, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id||null, institute_id, standing_list_name||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null]
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, institute_id, standing_list_name, shortlist_date,
            valid_until, status, remarks } = request.body;
    const { rows } = await pool.query(
      `UPDATE shortlists SET client_id=$1, institute_id=$2, standing_list_name=$3,
        shortlist_date=$4, valid_until=$5, status=$6, remarks=$7,
        updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [client_id||null, institute_id, standing_list_name||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM shortlists WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
