// routes/assignments.js
const { pool } = require('../db/pool');
const { authenticate, requireWriter, requireAdmin } = require('../middleware/auth');
const { canSeeRestrictedAssignments, assignmentScope } = require('../middleware/visibility');

/**
 * Whether this user must be refused any write to assignment `id`.
 *
 * Answers a boolean rather than sending the refusal itself. An earlier version
 * returned `reply.code(404).send(...)` for the caller to hand back, which is a
 * trap: a Fastify Reply is thenable, so `await guard(...)` resolved it to
 * `undefined`, the `if (blocked)` never fired, and DELETE answered 404 while
 * deleting the row regardless.
 *
 * 404 rather than 403 at the call sites: a non-superadmin cannot see these rows,
 * so the response must not confirm that this one exists.
 */
async function isWriteBlocked(user, id) {
  if (canSeeRestrictedAssignments(user)) return false;
  const { rows } = await pool.query('SELECT is_superadmin_only FROM assignments WHERE id=$1', [id]);
  return !!(rows.length && rows[0].is_superadmin_only);
}

function insertOccupation(client, assignmentId, o, i) {
  return client.query(
    `INSERT INTO assignment_occupations (assignment_id,name_in_letter,ctevt_occupation_id,trainees,
      duration_hours,level,skill_test_provisioned,skill_test_appeared,skill_test_pass,
      employment_provisioned,employment_actual_pct,locations,sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      assignmentId,
      o.name_in_letter || o.nameInLetter || '',
      o.ctevt_occupation_id || o.ctevtOccupationId || null,
      o.trainees || null,
      o.duration || o.duration_hours || null,
      o.level || null,
      !!(o.skill_test_provisioned ?? o.skillTestProvisioned),
      o.skill_test_appeared ?? o.skillTestAppeared ?? null,
      o.skill_test_pass ?? o.skillTestPass ?? null,
      !!(o.employment_provisioned ?? o.employmentProvisioned),
      o.employment_actual_pct ?? o.employmentActual ?? null,
      JSON.stringify(o.locations || []),
      i,
    ]
  );
}

async function plugin(fastify, opts) {
  fastify.addHook('preHandler', authenticate);

  fastify.get('/', async (request, reply) => {
    const { institute_id, fy } = request.query;
    let q = `SELECT a.*, c.short_name as client_short_name, c.full_name as client_full_name, c.type as client_type,
      json_agg(ao.* ORDER BY ao.sort_order) FILTER (WHERE ao.id IS NOT NULL) as occupations,
      json_agg(al.* ORDER BY al.sort_order) FILTER (WHERE al.id IS NOT NULL) as locations
      FROM assignments a
      LEFT JOIN clients c ON c.id = a.client_id
      LEFT JOIN assignment_occupations ao ON ao.assignment_id = a.id
      LEFT JOIN assignment_locations al ON al.assignment_id = a.id
      WHERE 1=1`;
    const params = [];
    if (institute_id) { params.push(institute_id); q += ` AND a.institute_id = $${params.length}`; }
    if (fy) { params.push(fy); q += ` AND a.fiscal_year = $${params.length}`; }
    q += assignmentScope(request.user, 'a');
    q += ' GROUP BY a.id, c.id ORDER BY a.fiscal_year DESC, a.id';
    const { rows } = await pool.query(q, params);
    return rows;
  });

  fastify.post('/', { preHandler: requireWriter }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { institute_id, client_id, client_name_manual, fiscal_year, assignment_name, training_type,
        contract_value, contract_amount, start_date, end_date, start_fy, end_fy,
        remarks, reference_file, reference_file_name, is_gesi, is_residential,
        is_jv, jv_role, jv_partners,
        country, description_of_work, duration_months, total_person_months, own_service_value,
        jv_partner_names, jv_partner_person_months, narrative_description, actual_services_description,
        num_groups, duration_days, staff_count, senior_staff_description,
        is_superadmin_only,
        occupations = [], locations = [] } = request.body;

      // Only a superadmin can mark an assignment restricted. Anyone else
      // sending the flag has it dropped rather than the request refused —
      // an editor's ordinary save must not start failing because a stale
      // client echoed a field back.
      const restricted = canSeeRestrictedAssignments(request.user) && !!is_superadmin_only;

      if (!institute_id || !fiscal_year || !assignment_name) {
        await client.query('ROLLBACK');
        return reply.code(400).send({ error: 'institute_id, fiscal_year, assignment_name required' });
      }

      const { rows: [asgn] } = await client.query(
        `INSERT INTO assignments (institute_id,client_id,client_name_manual,fiscal_year,assignment_name,training_type,
          contract_value,start_date,end_date,start_fy,end_fy,remarks,reference_file,reference_file_name,
          is_gesi,is_residential,is_jv,jv_role,jv_partners,
          country,description_of_work,duration_months,total_person_months,own_service_value,
          jv_partner_names,jv_partner_person_months,narrative_description,actual_services_description,
          num_groups,duration_days,staff_count,senior_staff_description,is_superadmin_only)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
          $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33) RETURNING *`,
        [institute_id, client_id||null, client_name_manual||null, fiscal_year, assignment_name, training_type,
         contract_value||contract_amount||null, start_date||null, end_date||null, start_fy||null, end_fy||null,
         remarks, reference_file||null, reference_file_name||null,
         !!is_gesi, !!is_residential, !!is_jv, is_jv ? (jv_role||'Lead') : null, is_jv ? (jv_partners||null) : null,
         country||'Nepal', description_of_work||null, duration_months||null, total_person_months||null, own_service_value||null,
         jv_partner_names||null, jv_partner_person_months||null, narrative_description||null, actual_services_description||null,
         num_groups||null, duration_days||null, staff_count||null, senior_staff_description||null,
         restricted]
      );

      for (let i = 0; i < occupations.length; i++) {
        await insertOccupation(client, asgn.id, occupations[i], i);
      }

      await client.query('COMMIT');
      return reply.code(201).send(asgn);
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.put('/:id', { preHandler: requireWriter }, async (request, reply) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { id } = request.params;
      if (await isWriteBlocked(request.user, id)) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Not found' });
      }
      const { client_id, client_name_manual, fiscal_year, assignment_name, training_type,
        contract_value, contract_amount, start_date, end_date, start_fy, end_fy,
        remarks, reference_file, reference_file_name, is_gesi, is_residential,
        is_jv, jv_role, jv_partners,
        country, description_of_work, duration_months, total_person_months, own_service_value,
        jv_partner_names, jv_partner_person_months, narrative_description, actual_services_description,
        num_groups, duration_days, staff_count, senior_staff_description,
        is_superadmin_only,
        occupations = [], locations = [] } = request.body;

      // NULL leaves the existing value alone, so an editor saving an ordinary
      // assignment can never flip the flag in either direction.
      const restricted = canSeeRestrictedAssignments(request.user) ? !!is_superadmin_only : null;

      const { rows } = await client.query(
        `UPDATE assignments SET client_id=$1,client_name_manual=$2,fiscal_year=$3,assignment_name=$4,training_type=$5,
          contract_value=$6,start_date=$7,end_date=$8,start_fy=$9,end_fy=$10,remarks=$11,
          reference_file=$12,reference_file_name=$13,is_gesi=$14,is_residential=$15,
          is_jv=$16,jv_role=$17,jv_partners=$18,
          country=$19,description_of_work=$20,duration_months=$21,total_person_months=$22,own_service_value=$23,
          jv_partner_names=$24,jv_partner_person_months=$25,narrative_description=$26,actual_services_description=$27,
          num_groups=$28,duration_days=$29,staff_count=$30,senior_staff_description=$31,
          is_superadmin_only=COALESCE($32, is_superadmin_only)
         WHERE id=$33 RETURNING *`,
        [client_id||null, client_name_manual||null, fiscal_year, assignment_name, training_type,
         contract_value||contract_amount||null, start_date||null, end_date||null, start_fy||null, end_fy||null,
         remarks, reference_file||null, reference_file_name||null,
         !!is_gesi, !!is_residential,
         !!is_jv, is_jv ? (jv_role||'Lead') : null, is_jv ? (jv_partners||null) : null,
         country||'Nepal', description_of_work||null, duration_months||null, total_person_months||null, own_service_value||null,
         jv_partner_names||null, jv_partner_person_months||null, narrative_description||null, actual_services_description||null,
         num_groups||null, duration_days||null, staff_count||null, senior_staff_description||null,
         restricted, id]
      );
      if (!rows.length) { await client.query('ROLLBACK'); return reply.code(404).send({ error: 'Not found' }); }

      await client.query('DELETE FROM assignment_occupations WHERE assignment_id = $1', [id]);
      await client.query('DELETE FROM assignment_locations WHERE assignment_id = $1', [id]);

      for (let i = 0; i < occupations.length; i++) {
        await insertOccupation(client, id, occupations[i], i);
      }

      await client.query('COMMIT');
      return rows[0];
    } catch(e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  });

  fastify.delete('/:id', { preHandler: requireAdmin }, async (request, reply) => {
    if (await isWriteBlocked(request.user, request.params.id)) {
      return reply.code(404).send({ error: 'Not found' });
    }
    await pool.query('DELETE FROM assignments WHERE id = $1', [request.params.id]);
    return { deleted: true };
  });
}

module.exports = plugin;
