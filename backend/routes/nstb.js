// routes/nstb.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { institute_id, fy } = request.query;
    let q = 'SELECT * FROM nstb_records WHERE 1=1';
    const params = [];
    if (institute_id) { params.push(institute_id); q += ` AND institute_id=$${params.length}`; }
    if (fy) { params.push(fy); q += ` AND fiscal_year=$${params.length}`; }
    q += ' ORDER BY fiscal_year DESC, occupation';
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { institute_id, fiscal_year, occupation, level, applied, appeared, pass,
      letter_no, letter_date, letter_type, remarks } = request.body;
    if (!institute_id || !occupation)
      return reply.code(400).send({ error: 'institute_id and occupation are required' });
    const toInt = v => (v !== '' && v != null) ? parseInt(v) : null;
    const { rows } = await pool.query(
      `INSERT INTO nstb_records (institute_id,fiscal_year,occupation,level,applied,appeared,pass,
        letter_no,letter_date,letter_type,remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [institute_id,fiscal_year,occupation,level||null,toInt(applied),toInt(appeared),toInt(pass),letter_no||null,letter_date||null,letter_type||null,remarks||null]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { fiscal_year, occupation, level, applied, appeared, pass,
      letter_no, letter_date, letter_type, remarks } = request.body;
    const toInt = v => (v !== '' && v != null) ? parseInt(v) : null;
    const { rows } = await pool.query(
      `UPDATE nstb_records SET fiscal_year=$1,occupation=$2,level=$3,applied=$4,appeared=$5,pass=$6,
        letter_no=$7,letter_date=$8,letter_type=$9,remarks=$10 WHERE id=$11 RETURNING *`,
      [fiscal_year,occupation,level||null,toInt(applied),toInt(appeared),toInt(pass),letter_no||null,letter_date||null,letter_type||null,remarks||null,request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM nstb_records WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
