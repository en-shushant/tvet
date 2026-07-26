// routes/quotations.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // List quotations for a contract (with firm details)
  fastify.get('/', async (request) => {
    const { contract_id } = request.query;
    if (!contract_id) return [];
    const { rows } = await pool.query(`
      SELECT q.*,
        sl.fy AS shortlist_fy, sl.shortlist_date, sl.client_id AS shortlist_client_id,
        i.name AS institute_name, i.acronym AS institute_acronym
      FROM quotations q
      JOIN shortlists sl ON sl.id = q.shortlist_id
      JOIN institutes i  ON i.id  = sl.institute_id
      WHERE q.contract_id = $1
      ORDER BY q.created_at ASC
    `, [contract_id]);
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { contract_id, shortlist_id, quotation_date, quoted_amount,
            status, contract_amount, agreement_doc, remarks } = request.body;
    if (!contract_id || !shortlist_id)
      return reply.code(400).send({ error: 'contract_id and shortlist_id are required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO quotations
        (contract_id, shortlist_id, quotation_date, quoted_amount, status, contract_amount, agreement_doc, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [contract_id, shortlist_id,
       quotation_date || null, quoted_amount || null,
       status || 'Quoted',
       contract_amount || null, agreement_doc || null, remarks || null]
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { quotation_date, quoted_amount, status, contract_amount, agreement_doc, remarks } = request.body;
    const { rows } = await pool.query(
      `UPDATE quotations SET
        quotation_date=$1, quoted_amount=$2, status=$3,
        contract_amount=$4, agreement_doc=$5, remarks=$6, updated_at=NOW()
       WHERE id=$7 RETURNING *`,
      [quotation_date || null, quoted_amount || null, status || 'Quoted',
       contract_amount || null, agreement_doc || null, remarks || null, request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM quotations WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
