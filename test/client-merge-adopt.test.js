/**
 * Merging duplicate clients, and taking typed-in names into master data.
 *
 * These are two halves of one problem. The registry holds "PCTVET", "P-CTVET"
 * and "Province CTVET" as separate clients because each was typed on a
 * different day, and it holds client names as free text on assignments that
 * were never picked from the list at all. Adding every typed name blindly would
 * manufacture more of the duplicates the merge exists to remove, so the two
 * have to agree on when two names are the same client.
 *
 * There is no database in CI, so the SQL is read statically. What that catches
 * is the failure this guards against: a table that references clients being
 * left out of one operation but not the other, which loses the link silently
 * rather than erroring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(import.meta.dirname, '../backend/routes/clients.js'), 'utf8');

/** The body of a route handler, from its registration to the next one. */
function handler(method, route) {
  const start = source.indexOf(`fastify.${method}('${route}'`);
  expect(start, `no handler for ${method.toUpperCase()} ${route}`).toBeGreaterThan(-1);
  const rest = source.slice(start + 1);
  const next = rest.search(/fastify\.(get|post|put|delete)\(/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

/** Tables the schema says carry a client reference. */
const REFERENCING_TABLES = ['assignments', 'shortlists', 'standing_lists', 'contracts', 'institute_documents'];

describe('the tables that reference a client', () => {
  it('are declared in one place', () => {
    const block = source.slice(source.indexOf('const CLIENT_REFS = ['),
                               source.indexOf('];', source.indexOf('const CLIENT_REFS')));
    for (const t of REFERENCING_TABLES) expect(block, `${t} missing`).toContain(t);
  });

  it('includes institute_documents, which has no foreign key to catch the omission', () => {
    // The other four are declared REFERENCES clients(id); this one is a plain
    // integer column, so leaving it out would fail silently rather than loudly.
    const block = source.slice(source.indexOf('const CLIENT_REFS = ['),
                               source.indexOf('];', source.indexOf('const CLIENT_REFS')));
    expect(block).toContain('institute_documents');
  });

  it('are read from that one list by both merge and adopt', () => {
    // Neither may hard-code its own list, or the two drift apart.
    expect(handler('post', '/merge')).toMatch(/for \(const r of await existingRefs\(\)\)/);
    expect(handler('post', '/adopt')).toMatch(/for \(const r of await existingRefs\(\)\)/);
  });

  it('are filtered to the ones that exist', () => {
    // institute_documents is created on the first request to the documents
    // route rather than at boot, so on an install where nobody has opened
    // Documents it is simply absent — and naming it made every one of these
    // endpoints fail with "relation does not exist".
    expect(source).toMatch(/to_regclass/);
    for (const route of ['/usage', '/unlinked']) {
      expect(handler('get', route), route).toMatch(/await existingRefs\(\)/);
    }
  });
});

describe('when two typed names count as the same client', () => {
  const norm = source.slice(source.indexOf('const NORM ='), source.indexOf('\n', source.indexOf('const NORM =')));

  it('ignores case and surrounding whitespace', () => {
    expect(norm).toContain('lower(');
    expect(norm).toContain('btrim(');
  });

  it('collapses runs of internal whitespace', () => {
    // Not cosmetic: this database already carries occupation names with
    // doubled internal spaces from exactly this, and btrim/lower alone would
    // leave "Dept  of Roads" and "Dept of Roads" as two clients forever.
    expect(norm).toMatch(/regexp_replace/);
    expect(norm).toMatch(/\\\\s\+/);
  });

  it('treats a NULL name as empty rather than propagating it', () => {
    expect(norm).toContain('coalesce(');
  });

  it('is the same rule everywhere it matters', () => {
    // Grouping typed names, matching them to master data, and repointing rows
    // must agree, or a name can group one way and relink another.
    for (const route of [handler('get', '/unlinked'), handler('post', '/adopt')]) {
      expect(route).toMatch(/\$\{NORM\(/);
    }
  });
});

describe('listing the names that are not in master data', () => {
  const unlinked = handler('get', '/unlinked');

  it('only looks at records that are not already linked', () => {
    expect(unlinked).toMatch(/client_id IS NULL/);
  });

  it('skips blank names', () => {
    expect(unlinked).toMatch(/btrim\(coalesce\(\$\{?r?\.?manual|<> ''/);
  });

  it('reports whether the name already exists in master data', () => {
    // The distinction that stops this screen from creating duplicates: a name
    // that already exists wants linking, not a second copy.
    expect(unlinked).toMatch(/match_id/);
    expect(unlinked).toMatch(/is_active = TRUE/);
  });

  it('matches at most one client per name', () => {
    // A registry that already holds the same client twice would otherwise
    // match both and list the typed name once per duplicate — in exactly the
    // registry this screen exists to tidy up.
    expect(unlinked).toMatch(/LEFT JOIN LATERAL/);
    expect(unlinked).toMatch(/LIMIT 1/);
  });

  it('proposes the best spelling, not the first alphabetically', () => {
    // This name becomes the master record unless someone edits it, so picking
    // the all-lowercase double-spaced variant creates the next duplicate.
    expect(unlinked).toMatch(/ORDER BY COUNT\(\*\) DESC, \(t\.name = lower\(t\.name\)\), length\(t\.name\)/);
  });
});

describe('adopting a typed name', () => {
  const adopt = handler('post', '/adopt');

  it('relinks the records as well as creating the client', () => {
    // Creating the row alone would be the worst outcome: master data gains an
    // entry, the assignments carry on as free text, nothing joins, and the
    // name still shows up as unlinked.
    expect(adopt).toMatch(/UPDATE \$\{r\.table\} SET client_id = \$1, \$\{r\.manual\} = NULL/);
  });

  it('links to an existing client instead of duplicating it', () => {
    expect(adopt).toMatch(/dupe\[0\] \|\|/);
  });

  it('requires a short name when creating', () => {
    expect(adopt).toMatch(/short_name required/);
  });

  it('runs in one transaction', () => {
    // A create that commits without its relink leaves the exact half-done
    // state this endpoint exists to avoid.
    expect(adopt).toMatch(/BEGIN/);
    expect(adopt).toMatch(/ROLLBACK/);
    expect(adopt).toMatch(/COMMIT/);
  });

  it('is open to writers, not just admins', () => {
    expect(source).toMatch(/fastify\.post\('\/adopt', \{ preHandler: requireWriter \}/);
  });
});

describe('merging clients', () => {
  const merge = handler('post', '/merge');

  it('is admin-only', () => {
    expect(source).toMatch(/fastify\.post\('\/merge', \{ preHandler: requireAdmin \}/);
  });

  it('deactivates the sources rather than deleting them', () => {
    // The client_id foreign keys are ON DELETE SET NULL, so deleting a source
    // would silently orphan its assignments instead of failing. Deactivating
    // also makes a mistaken merge reversible without a backup.
    expect(merge).toMatch(/UPDATE clients SET is_active = FALSE/);
    expect(merge).not.toMatch(/DELETE FROM clients/);
  });

  it('repoints every reference before deactivating', () => {
    const repoint = merge.indexOf('SET client_id = $1');
    const deactivate = merge.indexOf('is_active = FALSE');
    expect(repoint).toBeGreaterThan(-1);
    expect(repoint).toBeLessThan(deactivate);
  });

  it('refuses to merge a client into itself', () => {
    expect(merge).toMatch(/n !== targetId/);
  });

  it('rejects a missing target rather than deactivating the sources anyway', () => {
    expect(merge).toMatch(/Target client not found/);
  });

  it('runs in one transaction', () => {
    expect(merge).toMatch(/BEGIN/);
    expect(merge).toMatch(/ROLLBACK/);
    expect(merge).toMatch(/COMMIT/);
  });

  it('reports what moved, so the confirmation can be specific', () => {
    expect(merge).toMatch(/movedTotal/);
  });
});
