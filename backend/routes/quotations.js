// routes/quotations.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
const { visibleInstitutesClause, canWriteInstitutes, isDocUrl } = require('../lib/instituteAccess');

const NOT_YOURS = { error: 'You are not assigned to this firm.' };
/** The firm a shortlist entry (and so its quotations) belongs to. */
const firmOfShortlist = async (id) =>
  (await pool.query('SELECT institute_id FROM shortlists WHERE id=$1', [id])).rows[0]?.institute_id;

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  // List quotations for a contract (with firm details)
  fastify.get('/', async (request) => {
    const { contract_id } = request.query;
    if (!contract_id) return [];
    // A firm's quotes are shown only to people who can see that firm.
    const params = [contract_id];
    const scope = visibleInstitutesClause(request.user, 'sl.institute_id', params);
    const { rows } = await pool.query(`
      SELECT q.*,
        sl.fy AS shortlist_fy, sl.shortlist_date, sl.client_id AS shortlist_client_id,
        i.name AS institute_name, i.acronym AS institute_acronym
      FROM quotations q
      JOIN shortlists sl ON sl.id = q.shortlist_id
      JOIN institutes i  ON i.id  = sl.institute_id
      WHERE q.contract_id = $1 AND ${scope}
      ORDER BY q.created_at ASC
    `, params);
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { contract_id, shortlist_id, quotation_date, quoted_amount,
            status, contract_amount, agreement_doc, remarks } = request.body;
    if (!contract_id || !shortlist_id)
      return reply.code(400).send({ error: 'contract_id and shortlist_id are required' });
    const firm = await firmOfShortlist(shortlist_id);
    if (firm == null) return reply.code(400).send({ error: 'That shortlist entry does not exist' });
    if (!(await canWriteInstitutes(request.user, [firm]))) return reply.code(403).send(NOT_YOURS);
    if (!isDocUrl(agreement_doc)) return reply.code(400).send({ error: 'The document must be an uploaded file or a web address.' });
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
    const { rows: [cur] } = await pool.query('SELECT shortlist_id FROM quotations WHERE id=$1', [request.params.id]);
    if (!cur) return reply.code(404).send({ error: 'Not found' });
    if (!(await canWriteInstitutes(request.user, [await firmOfShortlist(cur.shortlist_id)]))) return reply.code(403).send(NOT_YOURS);
    if (!isDocUrl(agreement_doc)) return reply.code(400).send({ error: 'The document must be an uploaded file or a web address.' });
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
