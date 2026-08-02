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
        c.full_name        AS client_name,        c.short_name       AS client_short,
        c.address          AS client_address,     c.type             AS client_type,
        c.phone            AS client_phone,       c.email            AS client_email,
        c.website          AS client_website,
        c.signatory_name   AS client_signatory_name,
        c.signatory_position AS client_signatory_position,
        c.name_np          AS client_name_np,
        c.address_np       AS client_address_np,
        i.name        AS institute_name, i.acronym     AS institute_acronym,
        i.address     AS institute_address, i.phone    AS institute_phone,
        i.mobile      AS institute_mobile,
        i.email       AS institute_email,   i.website  AS institute_website,
        i.contact_person AS institute_contact,
        i.reg_no      AS institute_reg_no,  i.pan      AS institute_pan,
        i.name_np     AS institute_name_np,
        i.address_np  AS institute_address_np,
        i.contact_person_np AS institute_contact_np,
        -- Deliberately NOT selected: logo, letterhead, sign, stamp and the nine
        -- document URL columns. The list never renders them and repeating them
        -- on every shortlist row made this payload large enough to slow the
        -- page down. LetterOptsModal fetches the full institute on demand.
        i.letter_top_margin AS institute_letter_top_margin,
        i.letter_lr_padding AS institute_letter_lr_padding,
        i.letter_bottom_padding AS institute_letter_bottom_padding,
        i.service_type AS institute_service_type,
        stl.letter_type      AS list_letter_type,
        stl.addressee        AS list_addressee,
        stl.client_name2_manual AS list_client_name2
      FROM shortlists sl
      LEFT JOIN clients       c   ON c.id   = sl.client_id
      LEFT JOIN institutes    i   ON i.id   = sl.institute_id
      LEFT JOIN standing_lists stl ON stl.id = sl.standing_list_id
      ${where}
      ORDER BY sl.shortlist_date DESC, sl.id DESC
    `;
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, institute_id, standing_list_name, fy,
            shortlist_date, valid_until, status, remarks, contract_amount, shortlist_doc,
            letter_type } = request.body;
    if (!institute_id || !shortlist_date)
      return reply.code(400).send({ error: 'institute_id and shortlist_date are required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO shortlists
        (client_id, client_name_manual, institute_id, standing_list_name, fy, shortlist_date, valid_until, status, remarks, contract_amount, shortlist_doc, letter_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [client_id||null, client_name_manual||null, institute_id, standing_list_name||null, fy||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null, contract_amount||null, shortlist_doc||null,
       letter_type||'basic']
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, institute_id, standing_list_name, fy,
            shortlist_date, valid_until, status, remarks, contract_amount, shortlist_doc,
            letter_type } = request.body;
    const { rows } = await pool.query(
      `UPDATE shortlists SET client_id=$1, client_name_manual=$2, institute_id=$3, standing_list_name=$4,
        fy=$5, shortlist_date=$6, valid_until=$7, status=$8, remarks=$9,
        contract_amount=$10, shortlist_doc=$11, letter_type=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [client_id||null, client_name_manual||null, institute_id, standing_list_name||null, fy||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null, contract_amount||null, shortlist_doc||null,
       letter_type||'basic', request.params.id]
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
