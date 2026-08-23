/**
 * Restricted assignments — the ones a superadmin marks "Superadmin only" — must
 * be invisible to every other role.
 *
 * "Invisible" is the part worth testing. Hiding the row in the assignments list
 * is the easy half; the assignment also feeds the institute detail payload the
 * report families are built from, the registry totals on the dashboard, and the
 * summary aggregates. A restricted assignment left in any one of those still
 * leaks — as a line in a generated report, or as a trainee count nobody can
 * account for.
 *
 * There is no database in CI, so the SQL is checked statically: every query that
 * reads the assignments table must carry the scope clause. That is a weaker
 * assertion than running the query, but it is the one that catches the failure
 * this guards against — a new read site added later without the filter.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { canSeeRestrictedAssignments, assignmentScope } =
  require('../backend/middleware/visibility.js');

import { expToAPI, normExp } from '../src/utils/api.js';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

describe('the visibility rule', () => {
  it('admits only the superadmin', () => {
    expect(canSeeRestrictedAssignments({ role: 'superadmin' })).toBe(true);
    for (const role of ['admin', 'editor', 'shortlist', 'viewer', 'user']) {
      expect(canSeeRestrictedAssignments({ role }), role).toBe(false);
    }
    // An unauthenticated or malformed request must not be treated as trusted.
    expect(canSeeRestrictedAssignments(undefined)).toBe(false);
    expect(canSeeRestrictedAssignments({})).toBe(false);
  });

  it('adds nothing to a superadmin’s query', () => {
    expect(assignmentScope({ role: 'superadmin' })).toBe('');
  });

  it('filters on the given alias for everyone else', () => {
    expect(assignmentScope({ role: 'admin' }, 'a'))
      .toBe(' AND a.is_superadmin_only IS NOT TRUE');
    expect(assignmentScope({ role: 'editor' }, 'asg'))
      .toBe(' AND asg.is_superadmin_only IS NOT TRUE');
  });

  it('uses IS NOT TRUE, so rows predating the column stay visible', () => {
    // `is_superadmin_only = FALSE` is NULL for a row written before the
    // migration, which would have hidden the entire existing registry.
    expect(assignmentScope({ role: 'admin' })).not.toMatch(/=\s*FALSE/i);
    expect(assignmentScope({ role: 'admin' })).toMatch(/IS NOT TRUE/);
  });
});

describe('every read of the assignments table', () => {
  // route file → how many of its queries touch `FROM assignments`
  const routes = {
    'backend/routes/assignments.js': 1,
    // list totals CTE, /compliance, three detail aggregates, detail assignments
    'backend/routes/institutes.js': 6,
    'backend/routes/summary.js': 1,
    'backend/routes/dashboard.js': 5,
  };

  for (const [file, expected] of Object.entries(routes)) {
    it(`is scoped in ${path.basename(file)}`, () => {
      const source = read(file);
      const scoped = (source.match(/assignmentScope\(request\.user/g) || []).length;
      expect(scoped, `${file} should scope ${expected} assignment reads`).toBe(expected);
    });
  }

  it('imports the shared rule rather than re-deriving it', () => {
    for (const file of Object.keys(routes)) {
      expect(read(file), file).toMatch(/require\('\.\.\/middleware\/visibility'\)/);
    }
  });
});

describe('the write path', () => {
  const source = read('backend/routes/assignments.js');

  it('lets only a superadmin set the flag on create', () => {
    // The POST derives `restricted` by ANDing the role check with the body,
    // so a non-superadmin's flag is dropped rather than trusted.
    expect(source).toMatch(
      /const restricted = canSeeRestrictedAssignments\(request\.user\) && !!is_superadmin_only/);
  });

  it('leaves the flag untouched when a non-superadmin edits', () => {
    // null → COALESCE keeps the stored value, so an editor saving an ordinary
    // assignment can never flip it in either direction.
    expect(source).toMatch(
      /const restricted = canSeeRestrictedAssignments\(request\.user\) \? !!is_superadmin_only : null/);
    expect(source).toMatch(/is_superadmin_only=COALESCE\(\$32, is_superadmin_only\)/);
  });

  it('guards edit and delete of a restricted row', () => {
    const put = source.slice(source.indexOf("fastify.put('/:id'"));
    const del = source.slice(source.indexOf("fastify.delete('/:id'"));
    expect(put).toMatch(/if \(await isWriteBlocked\(request\.user, id\)\)/);
    expect(del).toMatch(/if \(await isWriteBlocked\(request\.user, request\.params\.id\)\)/);
    // Both must answer 404 rather than confirming the row exists.
    expect(put.slice(0, put.indexOf('const { client_id'))).toMatch(/reply\.code\(404\)/);
    expect(del.slice(0, del.indexOf('DELETE FROM'))).toMatch(/reply\.code\(404\)/);
  });

  it('does not route the refusal through an awaited Fastify reply', () => {
    // A Reply is thenable: `await guard(...)` returning `reply.code(404).send()`
    // resolves to undefined, so the caller's `if (blocked)` never fires and the
    // write proceeds behind a 404. The guard must answer a boolean instead.
    const guard = source.slice(source.indexOf('async function isWriteBlocked'),
                               source.indexOf('function insertOccupation'));
    expect(guard).not.toMatch(/reply/);
    expect(guard).toMatch(/return !!\(rows\.length && rows\[0\]\.is_superadmin_only\)/);
  });
});

describe('the flag survives a round trip through the client', () => {
  it('is sent on save', () => {
    expect(expToAPI({ isSuperAdminOnly: true, occupations: [] }, 1).is_superadmin_only).toBe(true);
    expect(expToAPI({ occupations: [] }, 1).is_superadmin_only).toBe(false);
  });

  it('is read back from the server', () => {
    expect(normExp({ is_superadmin_only: true }).isSuperAdminOnly).toBe(true);
    expect(normExp({}).isSuperAdminOnly).toBe(false);
  });

  it('is not lost when an existing restricted assignment is edited', () => {
    // Opening one for edit runs it through normExp and back out through
    // expToAPI. Dropping the flag on either leg would quietly un-restrict it.
    const fromServer = normExp({ id: 7, is_superadmin_only: true, assignment_name: 'X' });
    expect(expToAPI(fromServer, 1).is_superadmin_only).toBe(true);
  });
});
