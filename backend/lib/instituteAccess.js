// lib/instituteAccess.js — which firms a signed-in user may see and change.
//
// The same rules routes/institutes.js applies to the firm list, in one place
// so per-firm records elsewhere (shortlist entries) follow them too:
//   admin, superadmin — every firm
//   editor            — firms assigned to them
//   shortlist         — firms assigned to them or that they created
//   anyone else       — read-only; every firm except shortlisting-only ones
//                       they are not assigned to
const { pool } = require('../db/pool');

const isAdminish = (u) => u?.role === 'admin' || u?.role === 'superadmin';

/** A SQL condition limiting `col` (an institute id) to what `user` may see. Pushes to `params`. */
function visibleInstitutesClause(user, col, params) {
  if (isAdminish(user)) return 'TRUE';
  params.push(user.id);
  const me = `$${params.length}`;
  const assigned = `${col} IN (SELECT institute_id FROM user_institutes WHERE user_id=${me})`;
  if (user.role === 'editor') return assigned;
  if (user.role === 'shortlist') {
    return `(${assigned} OR ${col} IN (SELECT id FROM institutes WHERE created_by=${me}))`;
  }
  return `(${assigned} OR ${col} IN (SELECT id FROM institutes
            WHERE is_shortlisting_only IS NULL OR is_shortlisting_only = false))`;
}

/** Whether `user` may write records for every firm in `ids`. */
async function canWriteInstitutes(user, ids) {
  if (isAdminish(user)) return true;
  if (user?.role !== 'editor' && user?.role !== 'shortlist') return false;
  const clean = [...new Set((ids || []).map(Number).filter(Number.isInteger))];
  if (!clean.length) return true;
  const params = [clean];
  const clause = visibleInstitutesClause(user, 'id', params);
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM institutes WHERE id = ANY($1::int[]) AND ${clause}`, params);
  return rows[0].n === clean.length;
}

module.exports = { visibleInstitutesClause, canWriteInstitutes };
