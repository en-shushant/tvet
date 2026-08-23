// middleware/visibility.js
//
// Assignments a superadmin marks `is_superadmin_only` are invisible to every
// other role. "Invisible" has to mean more than hidden in the assignments list:
// the reports are built from the institute payload, and the dashboard and
// summary totals are counted in SQL, so a restricted assignment left in any one
// of those still leaks — as a row in a generated report, or as a trainee count
// that nobody can account for.
//
// So the rule lives here and is applied at every read of the assignments table,
// rather than being re-decided per route or filtered on the client.

function canSeeRestrictedAssignments(user) {
  return user?.role === 'superadmin';
}

/**
 * SQL to append to a WHERE clause that already holds at least one condition.
 * Returns '' for a superadmin. `alias` is the assignments table's alias in the
 * query being extended.
 *
 * IS NOT TRUE rather than = FALSE: the column was added to an existing table,
 * so rows written before the migration can hold NULL, and `NULL = FALSE` is
 * NULL — which would have hidden every historic assignment from everyone.
 */
function assignmentScope(user, alias = 'a') {
  return canSeeRestrictedAssignments(user) ? '' : ` AND ${alias}.is_superadmin_only IS NOT TRUE`;
}

module.exports = { canSeeRestrictedAssignments, assignmentScope };
