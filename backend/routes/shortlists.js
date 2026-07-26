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
        c.letterhead       AS client_letterhead,
        i.name        AS institute_name, i.acronym     AS institute_acronym,
        i.address     AS institute_address, i.phone    AS institute_phone,
        i.mobile      AS institute_mobile,
        i.email       AS institute_email,   i.website  AS institute_website,
        i.contact_person AS institute_contact,
        i.reg_no      AS institute_reg_no,  i.pan      AS institute_pan,
        i.logo        AS institute_logo,
        i.name_np     AS institute_name_np,
        i.address_np  AS institute_address_np,
        i.contact_person_np AS institute_contact_np,
        i.letterhead  AS institute_letterhead,
        i.sign        AS institute_sign,     i.stamp    AS institute_stamp,
        i.ocr_registration        AS institute_ocr_registration,
        i.ocr_renewal             AS institute_ocr_renewal,
        i.local_level_registration AS institute_local_level_registration,
        i.local_level_renewal      AS institute_local_level_renewal,
        i.vat_registration  AS institute_vat_registration,
        i.vat_extension     AS institute_vat_extension,
        i.ctevt_affiliation AS institute_ctevt_affiliation,
        i.ctevt_renewal     AS institute_ctevt_renewal,
        i.tax_clearance_doc AS institute_tax_clearance_doc,
        i.letter_top_margin AS institute_letter_top_margin,
        i.letter_lr_padding AS institute_letter_lr_padding,
        i.letter_bottom_padding AS institute_letter_bottom_padding,
        i.service_type AS institute_service_type
      FROM shortlists sl
      LEFT JOIN clients    c ON c.id = sl.client_id
      LEFT JOIN institutes i ON i.id = sl.institute_id
      ${where}
      ORDER BY sl.shortlist_date DESC, sl.id DESC
    `;
    return (await pool.query(q, params)).rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, institute_id, standing_list_name, fy,
            shortlist_date, valid_until, status, remarks, contract_amount } = request.body;
    if (!institute_id || !shortlist_date)
      return reply.code(400).send({ error: 'institute_id and shortlist_date are required' });
    const { rows: [row] } = await pool.query(
      `INSERT INTO shortlists
        (client_id, client_name_manual, institute_id, standing_list_name, fy, shortlist_date, valid_until, status, remarks, contract_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [client_id||null, client_name_manual||null, institute_id, standing_list_name||null, fy||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null, contract_amount||null]
    );
    return reply.code(201).send(row);
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const { client_id, client_name_manual, institute_id, standing_list_name, fy,
            shortlist_date, valid_until, status, remarks, contract_amount } = request.body;
    const { rows } = await pool.query(
      `UPDATE shortlists SET client_id=$1, client_name_manual=$2, institute_id=$3, standing_list_name=$4,
        fy=$5, shortlist_date=$6, valid_until=$7, status=$8, remarks=$9,
        contract_amount=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [client_id||null, client_name_manual||null, institute_id, standing_list_name||null, fy||null, shortlist_date,
       valid_until||null, status||'Active', remarks||null, contract_amount||null, request.params.id]
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
