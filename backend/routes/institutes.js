// routes/institutes.js
const { pool } = require('../db/pool');
const { authenticate, requireAdmin, requireWriter } = require('../middleware/auth');

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { status, search } = request.query;
    // Heavy blob columns (letterhead, logo, sign, stamp, document URLs) are
    // fetched only on GET /:id — they're not needed for the list and were
    // the main cause of slow list loads (each can be several hundred KB).
    // Correlated subqueries replaced with aggregated CTEs for a single pass.
    let q = `
      WITH asgn_stats AS (
        SELECT a.institute_id,
          SUM(ao.trainees)           AS total_trainees,
          SUM(ao.skill_test_appeared) AS total_st_appeared,
          -- Manual clients count too. Assignments record a client either by id
          -- or as free text in client_name_manual, and counting only the former
          -- made an institute whose clients are all manual read "0 Clients" in
          -- the list while its own page listed them. Prefixed so a client_id of
          -- 5 and a manual client literally named "5" stay distinct.
          COUNT(DISTINCT COALESCE('id:' || a.client_id::text,
                                  'm:'  || NULLIF(a.client_name_manual, ''))) AS total_clients
        FROM assignments a
        JOIN assignment_occupations ao ON ao.assignment_id = a.id
        GROUP BY a.institute_id
      ),
      aff_stats AS (
        SELECT af.institute_id, COUNT(ap.id) AS total_aff_programs
        FROM affiliations af
        JOIN affiliation_programs ap ON ap.affiliation_id = af.id
        GROUP BY af.institute_id
      )
      SELECT
        i.id, i.name, i.acronym, i.reg_no, i.reg_date, i.pan, i.permanent_account_no,
        i.contact_person, i.phone, i.mobile, i.email, i.address, i.type, i.status,
        i.renewal_due, i.remarks, i.website, i.google_map_link, i.latitude, i.longitude,
        i.is_shortlisting_only, i.name_np, i.address_np, i.contact_person_np,
        i.letter_top_margin, i.letter_lr_padding, i.letter_bottom_padding,
        i.service_type, i.created_by, i.created_at,
        i.desc_template_id, i.narrative_template_id, i.services_template_id,
        COALESCE(json_agg(DISTINCT jsonb_build_object('fy', t.fiscal_year, 'turnover', t.turnover)) FILTER (WHERE t.id IS NOT NULL), '[]') AS "taxClearance",
        COALESCE(json_agg(DISTINCT jsonb_build_object('fy', n.fiscal_year)) FILTER (WHERE n.id IS NOT NULL), '[]') AS nstb,
        COALESCE(json_agg(DISTINCT jsonb_build_object('status', a.status, 'expiryDate', a.expiry_date, 'affiliationDate', a.affiliation_date)) FILTER (WHERE a.id IS NOT NULL), '[]') AS affiliation,
        '[]'::json AS experience,
        COALESCE(MAX(s.total_trainees), 0)      AS total_trainees,
        COALESCE(MAX(s.total_st_appeared), 0)   AS total_st_appeared,
        COALESCE(MAX(s.total_clients), 0)        AS total_clients,
        COALESCE(MAX(af.total_aff_programs), 0)  AS total_aff_programs
      FROM institutes i
      LEFT JOIN tax_clearances t    ON t.institute_id = i.id
      LEFT JOIN nstb_records n      ON n.institute_id = i.id
      LEFT JOIN affiliations a      ON a.institute_id = i.id
      LEFT JOIN asgn_stats s        ON s.institute_id = i.id
      LEFT JOIN aff_stats af        ON af.institute_id = i.id
      WHERE 1=1`;
    const params = [];
    if (request.user.role === 'editor') {
      params.push(request.user.id);
      q += ` AND i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length})`;
    }
    if (request.user.role === 'shortlist') {
      params.push(request.user.id);
      q += ` AND (i.created_by=$${params.length} OR i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length}))`;
    }
    // Shortlisting-only firms are visible to admins/superadmins and to users
    // explicitly assigned to those firms; hidden from everyone else.
    if (request.user.role !== 'admin' && request.user.role !== 'superadmin') {
      params.push(request.user.id);
      q += ` AND (i.is_shortlisting_only IS NULL OR i.is_shortlisting_only = false
        OR i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length}))`;
    }
    if (status) { params.push(status); q += ` AND i.status = $${params.length}`; }
    if (search) { params.push(`%${search}%`); q += ` AND (i.name ILIKE $${params.length} OR i.acronym ILIKE $${params.length} OR i.reg_no ILIKE $${params.length} OR i.pan ILIKE $${params.length})`; }
    q += ' GROUP BY i.id ORDER BY i.name';
    const { rows } = await pool.query(q, params);
    return rows;
  });

  // Bulk payload for cross-firm search (Project Compliance). Returns every
  // institute with just the assignment/occupation/turnover data those filters
  // read, in three queries — the caller previously fetched GET /:id once per
  // institute, which was six queries per firm and unbounded in the number of firms.
  // Declared before '/:id' so "compliance" is never parsed as an id.
  fastify.get('/compliance', async (request, reply) => {
    const [insts, assignments, tax] = await Promise.all([
      pool.query('SELECT id, name, acronym, type, status FROM institutes ORDER BY name'),
      pool.query(`
        SELECT a.id, a.institute_id, a.client_id, a.client_name_manual, a.fiscal_year,
               a.assignment_name, a.contract_amount, a.contract_value,
               json_agg(
                 jsonb_build_object(
                   'id', ao.id,
                   'ctevt_occupation_id', ao.ctevt_occupation_id,
                   'name_in_letter', ao.name_in_letter,
                   'trainees', ao.trainees,
                   -- Column is duration_hours; the key stays 'duration' because
                   -- JVGroupPanel.computeInstStats reads occ.duration. Selecting
                   -- ao.duration made this whole endpoint 500 with "column
                   -- ao.duration does not exist", taking Project Compliance down.
                   'duration', ao.duration_hours,
                   'level', ao.level,
                   'locations', ao.locations
                 ) ORDER BY ao.sort_order, ao.id
               ) FILTER (WHERE ao.id IS NOT NULL) AS occupations
        FROM assignments a
        LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
        GROUP BY a.id`),
      pool.query('SELECT institute_id, fiscal_year, turnover FROM tax_clearances'),
    ]);

    const byInst = new Map(insts.rows.map(i => [i.id, { ...i, experience: [], taxClearance: [] }]));
    for (const a of assignments.rows) byInst.get(a.institute_id)?.experience.push(a);
    for (const t of tax.rows) byInst.get(t.institute_id)?.taxClearance.push(t);
    return [...byInst.values()];
  });

  /**
   * Logos only, as a second request.
   *
   * Logos are uploaded through FileReader.readAsDataURL, so this column holds
   * base64 data URIs, not links — they are exactly the blobs the list query
   * strips to keep it fast. Folding them back into the list would undo that,
   * but leaving them out meant an institute only ever showed its logo once its
   * detail page had been visited and merged one in.
   *
   * So: the list paints immediately with initials, this fills the logos in
   * behind it. Same visibility rules as the list — an editor must not be able
   * to enumerate logos for institutes they cannot otherwise see.
   */
  fastify.get('/logos', async (request, reply) => {
    let q = `SELECT i.id, i.logo FROM institutes i WHERE i.logo IS NOT NULL AND i.logo <> ''`;
    const params = [];
    if (request.user.role === 'editor') {
      params.push(request.user.id);
      q += ` AND i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length})`;
    }
    if (request.user.role === 'shortlist') {
      params.push(request.user.id);
      q += ` AND (i.created_by=$${params.length} OR i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length}))`;
    }
    if (request.user.role !== 'admin' && request.user.role !== 'superadmin') {
      params.push(request.user.id);
      q += ` AND (i.is_shortlisting_only IS NULL OR i.is_shortlisting_only = false
        OR i.id IN (SELECT institute_id FROM user_institutes WHERE user_id=$${params.length}))`;
    }
    const { rows } = await pool.query(q, params);
    return rows;
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params;
    const [inst, assignments, nstb, tax, affiliations, infrastructure] = await Promise.all([
      pool.query('SELECT * FROM institutes WHERE id = $1', [id]),
      pool.query(`
        SELECT a.*,
          json_agg(ao.* ORDER BY ao.sort_order, ao.id) FILTER (WHERE ao.id IS NOT NULL) as occupations,
          json_agg(DISTINCT al.*) FILTER (WHERE al.id IS NOT NULL) as locations
        FROM assignments a
        LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
        LEFT JOIN assignment_locations al ON al.assignment_id = a.id
        WHERE a.institute_id = $1
        GROUP BY a.id ORDER BY a.fiscal_year DESC, a.id`, [id]),
      pool.query('SELECT * FROM nstb_records WHERE institute_id = $1 ORDER BY fiscal_year DESC', [id]),
      pool.query('SELECT * FROM tax_clearances WHERE institute_id = $1 ORDER BY fiscal_year DESC', [id]),
      pool.query(`
        SELECT af.*, json_agg(ap.* ORDER BY ap.sort_order) FILTER (WHERE ap.id IS NOT NULL) as programs
        FROM affiliations af
        LEFT JOIN affiliation_programs ap ON ap.affiliation_id = af.id
        WHERE af.institute_id = $1
        GROUP BY af.id ORDER BY af.affiliation_date DESC`, [id]),
      pool.query('SELECT * FROM institute_infrastructure WHERE institute_id = $1 ORDER BY sort_order, id', [id]),
    ]);
    if (!inst.rows.length) return reply.code(404).send({ error: 'Institute not found' });
    return {
      ...inst.rows[0],
      experience: assignments.rows,
      nstb: nstb.rows,
      taxClearance: tax.rows,
      affiliation: affiliations.rows,
      infrastructure: infrastructure.rows,
    };
  });

  fastify.post('/', async (request, reply) => {
    const role = request.user?.role;
    if (!role || (role !== 'admin' && role !== 'superadmin' && role !== 'shortlist')) {
      return reply.code(403).send({ error: 'Access denied' });
    }
    const { name, acronym, reg_no, reg_date, pan, permanent_account_no,
      contact_person, phone, email, address, type, status, renewal_due, remarks, logo, website,
      desc_template_id, narrative_template_id, services_template_id,
      google_map_link, latitude, longitude, is_shortlisting_only,
      letterhead, sign, stamp,
      ocr_registration, ocr_renewal, vat_registration, vat_extension,
      ctevt_affiliation, ctevt_renewal,
      name_np, address_np, contact_person_np,
      tax_clearance_doc, letter_top_margin, letter_lr_padding, letter_bottom_padding, mobile,
      service_type, local_level_registration, local_level_renewal,
      constitution_type, fax, contact_designation, local_agent, org_profile,
      total_staff, professional_staff } = request.body;
    if (!name) return reply.code(400).send({ error: 'name is required' });
    if (!reg_no && !is_shortlisting_only) return reply.code(400).send({ error: 'reg_no is required' });
    if (name.length > 300) return reply.code(400).send({ error: 'name too long (max 300 chars)' });
    if (remarks && remarks.length > 2000) return reply.code(400).send({ error: 'remarks too long (max 2000 chars)' });
    const createdBy = role === 'shortlist' ? request.user.id : null;
    const isShortlistingOnly = role === 'shortlist' ? true : !!is_shortlisting_only;
    const { rows } = await pool.query(
      `INSERT INTO institutes (name,acronym,reg_no,reg_date,pan,permanent_account_no,
        contact_person,phone,mobile,email,address,type,status,renewal_due,remarks,logo,website,
        desc_template_id,narrative_template_id,services_template_id,
        google_map_link,latitude,longitude,is_shortlisting_only,
        letterhead,sign,stamp,ocr_registration,ocr_renewal,vat_registration,vat_extension,
        ctevt_affiliation,ctevt_renewal,name_np,address_np,contact_person_np,tax_clearance_doc,
        letter_top_margin,letter_lr_padding,letter_bottom_padding,
        service_type,local_level_registration,local_level_renewal,created_by,
        constitution_type,fax,contact_designation,local_agent,org_profile,
        total_staff,professional_staff)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46,$47,$48,$49,$50,$51) RETURNING *`,
      [name,acronym,reg_no||null,reg_date,pan,permanent_account_no,
       contact_person,phone,mobile||null,email,address,type,status||'Active',renewal_due,remarks,logo||null,website||null,
       desc_template_id||null,narrative_template_id||null,services_template_id||null,
       google_map_link||null,latitude||null,longitude||null,isShortlistingOnly,
       letterhead||null,sign||null,stamp||null,
       ocr_registration||null,ocr_renewal||null,vat_registration||null,vat_extension||null,
       ctevt_affiliation||null,ctevt_renewal||null,
       name_np||null,address_np||null,contact_person_np||null,tax_clearance_doc||null,
       letter_top_margin||null,letter_lr_padding||null,letter_bottom_padding||null,
       service_type||null,local_level_registration||null,local_level_renewal||null,createdBy,
       constitution_type||null,fax||null,contact_designation||null,local_agent||null,org_profile||null,
       total_staff||null,professional_staff||null]
    );
    return reply.code(201).send(rows[0]);
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params;
    const role = request.user?.role;
    if (!role || (role !== 'admin' && role !== 'superadmin' && role !== 'editor' && role !== 'shortlist')) {
      return reply.code(403).send({ error: 'Write access required. Contact your administrator.' });
    }
    if (role === 'editor') {
      const { rows: assigned } = await pool.query('SELECT 1 FROM user_institutes WHERE user_id=$1 AND institute_id=$2', [request.user.id, id]);
      if (!assigned.length) return reply.code(403).send({ error: 'Not assigned to this institute' });
    }
    if (role === 'shortlist') {
      const { rows: accessible } = await pool.query(
        `SELECT 1 FROM institutes WHERE id=$1 AND (created_by=$2 OR id IN (SELECT institute_id FROM user_institutes WHERE user_id=$2))`,
        [id, request.user.id]
      );
      if (!accessible.length) return reply.code(403).send({ error: 'Not assigned to this institute' });
    }
    const { name, acronym, reg_no, reg_date, pan, permanent_account_no,
      contact_person, phone, email, address, type, status, renewal_due, remarks, logo, website,
      desc_template_id, narrative_template_id, services_template_id,
      google_map_link, latitude, longitude, is_shortlisting_only,
      letterhead, sign, stamp,
      ocr_registration, ocr_renewal, vat_registration, vat_extension,
      ctevt_affiliation, ctevt_renewal,
      name_np, address_np, contact_person_np,
      tax_clearance_doc, letter_top_margin, letter_lr_padding, letter_bottom_padding, mobile,
      service_type, local_level_registration, local_level_renewal,
      constitution_type, fax, contact_designation, local_agent, org_profile,
      total_staff, professional_staff } = request.body;
    const { rows } = await pool.query(
      `UPDATE institutes SET name=$1,acronym=$2,reg_no=$3,reg_date=$4,pan=$5,
        permanent_account_no=$6,contact_person=$7,phone=$8,mobile=$9,email=$10,address=$11,
        type=$12,status=$13,renewal_due=$14,remarks=$15,logo=$16,website=$17,
        desc_template_id=$18,narrative_template_id=$19,services_template_id=$20,
        google_map_link=$21,latitude=$22,longitude=$23,is_shortlisting_only=$24,
        letterhead=$25,sign=$26,stamp=$27,
        ocr_registration=$28,ocr_renewal=$29,vat_registration=$30,vat_extension=$31,
        ctevt_affiliation=$32,ctevt_renewal=$33,
        name_np=$34,address_np=$35,contact_person_np=$36,tax_clearance_doc=$37,
        letter_top_margin=$38,letter_lr_padding=$39,letter_bottom_padding=$40,
        service_type=$41,local_level_registration=$42,local_level_renewal=$43,
        constitution_type=$45,fax=$46,contact_designation=$47,local_agent=$48,
        org_profile=$49,total_staff=$50,professional_staff=$51
       WHERE id=$44 RETURNING *`,
      [name,acronym,reg_no||null,reg_date,pan,permanent_account_no,
       contact_person,phone,mobile||null,email,address,type,status,renewal_due,remarks,logo||null,website||null,
       desc_template_id||null,narrative_template_id||null,services_template_id||null,
       google_map_link||null,latitude||null,longitude||null,!!is_shortlisting_only,
       letterhead||null,sign||null,stamp||null,
       ocr_registration||null,ocr_renewal||null,vat_registration||null,vat_extension||null,
       ctevt_affiliation||null,ctevt_renewal||null,
       name_np||null,address_np||null,contact_person_np||null,tax_clearance_doc||null,
       letter_top_margin||null,letter_lr_padding||null,letter_bottom_padding||null,
       service_type||null,local_level_registration||null,local_level_renewal||null,id,
       constitution_type||null,fax||null,contact_designation||null,local_agent||null,
       org_profile||null,total_staff||null,professional_staff||null]
    );
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    await pool.query('DELETE FROM institutes WHERE id = $1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
