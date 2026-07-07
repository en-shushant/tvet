// routes/tax.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { institute_id } = request.query;
    const q = institute_id
      ? 'SELECT * FROM tax_clearances WHERE institute_id=$1 ORDER BY fiscal_year DESC'
      : 'SELECT * FROM tax_clearances ORDER BY fiscal_year DESC';
    return (await pool.query(q, institute_id ? [institute_id] : [])).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { institute_id, fiscal_year, turnover, taxable_income, tax_paid,
      cert_date, kar_chuta_no, patra_no, income_statement_date, remarks } = request.body;
    if (!institute_id || !fiscal_year || !turnover || !taxable_income || !tax_paid)
      return reply.code(400).send({ error: 'institute_id, fiscal_year, turnover, taxable_income, tax_paid required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO tax_clearances (institute_id,fiscal_year,turnover,taxable_income,tax_paid,
          cert_date,kar_chuta_no,patra_no,income_statement_date,remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [institute_id,fiscal_year,turnover,taxable_income,tax_paid,cert_date,kar_chuta_no,patra_no,income_statement_date,remarks]
      );
      return reply.code(201).send(rows[0]);
    } catch(e) {
      if (e.code === '23505') return reply.code(409).send({ error: `Tax clearance for fiscal year ${request.body.fiscal_year} already exists. Edit the existing record instead.` });
      throw e;
    }
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { fiscal_year, turnover, taxable_income, tax_paid,
      cert_date, kar_chuta_no, patra_no, income_statement_date, remarks } = request.body;
    const { rows } = await pool.query(
      `UPDATE tax_clearances SET fiscal_year=$1,turnover=$2,taxable_income=$3,tax_paid=$4,
        cert_date=$5,kar_chuta_no=$6,patra_no=$7,income_statement_date=$8,remarks=$9
       WHERE id=$10 RETURNING *`,
      [fiscal_year,turnover,taxable_income,tax_paid,cert_date,kar_chuta_no,patra_no,income_statement_date,remarks,request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM tax_clearances WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
