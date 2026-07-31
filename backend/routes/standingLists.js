// routes/standingLists.js
//
// A standing list is created first (organisation + FY + name), then firms are
// assigned to it. Each assigned firm becomes a row in `shortlists` carrying
// standing_list_id. Older shortlist rows have standing_list_id NULL and are
// untouched by anything here.
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

async function plugin(fastify) {
  fastify.addHook('preHandler', authenticate);

  // List every standing list with its organisation and a firm count
  fastify.get('/', async () => {
    const { rows } = await pool.query(`
      SELECT sl.*,
             COALESCE(f.firm_count, 0)::int AS firm_count
      FROM standing_lists sl
      LEFT JOIN (
        SELECT standing_list_id, COUNT(*) AS firm_count
        FROM shortlists
        WHERE standing_list_id IS NOT NULL
        GROUP BY standing_list_id
      ) f ON f.standing_list_id = sl.id
      ORDER BY sl.list_date DESC NULLS LAST, sl.id DESC
    `);
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { client_name_manual, client_address_manual, name, fy,
            list_date, valid_until, status, remarks } = request.body;
    if (!client_name_manual) {
      return reply.code(400).send({ error: 'An organisation name is required' });
    }
    const { rows: [row] } = await pool.query(
      `INSERT INTO standing_lists
        (client_name_manual, client_address_manual, name, fy, list_date, valid_until, status, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [client_name_manual, client_address_manual || null, name || null, fy || null,
       list_date || null, valid_until || null, status || 'Active', remarks || null]
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { client_name_manual, client_address_manual, name, fy,
            list_date, valid_until, status, remarks } = request.body;
    const { rows } = await pool.query(
      `UPDATE standing_lists SET
         client_name_manual=$1, client_address_manual=$2, name=$3, fy=$4,
         list_date=$5, valid_until=$6, status=$7, remarks=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [client_name_manual || null, client_address_manual || null, name || null, fy || null,
       list_date || null, valid_until || null, status || 'Active', remarks || null,
       request.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  // Deleting a list also removes its firm entries (ON DELETE CASCADE), so make
  // the caller acknowledge that explicitly rather than silently discarding them.
  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params;
    const { rows: [{ count }] } = await pool.query(
      'SELECT COUNT(*)::int AS count FROM shortlists WHERE standing_list_id=$1', [id]
    );
    if (count > 0 && String(request.query.force) !== '1') {
      return reply.code(409).send({
        error: 'has_firms',
        count,
        message: `This list still has ${count} assigned firm${count === 1 ? '' : 's'}.`,
      });
    }
    const { rowCount } = await pool.query('DELETE FROM standing_lists WHERE id=$1', [id]);
    if (!rowCount) return reply.code(404).send({ error: 'Not found' });
    return { deleted: true, removedFirms: count };
  });

  // Assign firms in bulk. Firms already on the list are skipped, so re-saving
  // the same selection is harmless.
  fastify.post('/:id/firms', { preHandler: requireWriter }, async (request, reply) => {
    const { id } = request.params;
    const ids = Array.isArray(request.body?.institute_ids) ? request.body.institute_ids : [];
    if (!ids.length) return reply.code(400).send({ error: 'institute_ids is required' });

    const { rows: [list] } = await pool.query('SELECT * FROM standing_lists WHERE id=$1', [id]);
    if (!list) return reply.code(404).send({ error: 'Standing list not found' });

    // Firm entries inherit the list's organisation / FY / name / dates
    const { rows } = await pool.query(
      `INSERT INTO shortlists
        (standing_list_id, client_name_manual, client_address_manual, institute_id,
         standing_list_name, fy, shortlist_date, valid_until, status)
       SELECT $1, $2, $3, x.institute_id, $4, $5, $6, $7, $8
       FROM unnest($9::int[]) AS x(institute_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM shortlists s
         WHERE s.standing_list_id = $1 AND s.institute_id = x.institute_id
       )
       RETURNING *`,
      [id, list.client_name_manual, list.client_address_manual, list.name, list.fy,
       list.list_date || new Date(), list.valid_until, list.status || 'Active',
       ids.map(Number).filter(Boolean)]
    );
    return reply.code(201).send({ added: rows.length, rows });
  });

  // Remove a single firm from a list
  fastify.delete('/:id/firms/:instituteId', { preHandler: requireWriter }, async (request, reply) => {
    const { id, instituteId } = request.params;
    const { rowCount } = await pool.query(
      'DELETE FROM shortlists WHERE standing_list_id=$1 AND institute_id=$2', [id, instituteId]
    );
    if (!rowCount) return reply.code(404).send({ error: 'Not found' });
    return { deleted: true };
  });
}

module.exports = plugin;
