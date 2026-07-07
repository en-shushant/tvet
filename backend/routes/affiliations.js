// routes/affiliations.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { institute_id } = request.query;
    const q = `SELECT af.*, json_agg(ap.* ORDER BY ap.sort_order) FILTER (WHERE ap.id IS NOT NULL) as programs
      FROM affiliations af LEFT JOIN affiliation_programs ap ON ap.affiliation_id = af.id
      ${institute_id ? 'WHERE af.institute_id=$1' : ''}
      GROUP BY af.id ORDER BY af.affiliation_date DESC`;
    return (await pool.query(q, institute_id ? [institute_id] : [])).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { institute_id, patra_no, chalani_no, affiliation_date, type,
        validity_years, expiry_date, status, remarks, programs = [] } = request.body;
      if (!institute_id || !affiliation_date) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'institute_id and affiliation_date required' });
      }
      const { rows: [aff] } = await client.query(
        `INSERT INTO affiliations (institute_id,patra_no,chalani_no,affiliation_date,type,
          validity_years,expiry_date,status,remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [institute_id,patra_no,chalani_no,affiliation_date,type,validity_years||2,expiry_date,status||'Active',remarks]
      );
      for (let i = 0; i < programs.length; i++) {
        const p = programs[i];
        await client.query(
          `INSERT INTO affiliation_programs (affiliation_id,name,level,duration_hours,seats_per_batch,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [aff.id,p.name,p.level,p.duration||null,p.seats||null,i]
        );
      }
      await client.query('COMMIT');
      return reply.code(201).send(aff);
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { patra_no, chalani_no, affiliation_date, type, validity_years,
        expiry_date, status, remarks, programs = [] } = request.body;
      const { rows } = await client.query(
        `UPDATE affiliations SET patra_no=$1,chalani_no=$2,affiliation_date=$3,type=$4,
          validity_years=$5,expiry_date=$6,status=$7,remarks=$8 WHERE id=$9 RETURNING *`,
        [patra_no,chalani_no,affiliation_date,type,validity_years,expiry_date,status,remarks,request.params.id]
      );
      if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }
      await client.query('DELETE FROM affiliation_programs WHERE affiliation_id=$1', [request.params.id]);
      for (let i = 0; i < programs.length; i++) {
        const p = programs[i];
        await client.query(
          `INSERT INTO affiliation_programs (affiliation_id,name,level,duration_hours,seats_per_batch,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [request.params.id,p.name,p.level,p.duration||null,p.seats||null,i]
        );
      }
      await client.query('COMMIT');
      return rows[0];
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM affiliations WHERE id=$1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
