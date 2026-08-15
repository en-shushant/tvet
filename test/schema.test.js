/**
 * Every column a route selects must exist in the schema.
 *
 * The smoke test cannot see this layer. `GET /institutes/compliance` selected
 * ao.duration when the column is duration_hours; it compiled, deployed, and
 * 500'd on every load of Project Compliance until someone opened that screen.
 * Postgres is the only thing that would have objected, and there is no database
 * in CI — so the check is static instead.
 *
 * Tables are read from schema.sql plus the CREATE/ALTER migrations in
 * server.js, because several tables exist only in the latter.
 *
 * Aliases are resolved per query rather than per file: one route file holds many
 * queries and the same letter means different things in each. Where a CTE and
 * the outer query bind the same alias — `a` is assignments inside asgn_stats and
 * affiliations outside it — a column counts as valid if it exists on any table
 * that alias is bound to in that query. That is looser than Postgres, so this
 * will not catch every mistake; it catches the one that keeps happening, which
 * is naming a column no table has at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function loadSchema() {
  const sources = [
    readFileSync(path.join(ROOT, 'backend/db/schema.sql'), 'utf8'),
    readFileSync(path.join(ROOT, 'backend/server.js'), 'utf8'),
  ].join('\n');

  const tables = new Map();
  for (const m of sources.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\((.*?)\n\s*\)/gs)) {
    const cols = tables.get(m[1]) || new Set();
    for (let line of m[2].split('\n')) {
      line = line.trim().replace(/,$/, '');
      if (!line || line.startsWith('--')) continue;
      const token = line.split(/\s+/)[0].replace(/"/g, '');
      if (['PRIMARY', 'FOREIGN', 'UNIQUE', 'CONSTRAINT', 'CHECK'].includes(token.toUpperCase())) continue;
      cols.add(token);
    }
    tables.set(m[1], cols);
  }
  for (const m of sources.matchAll(/ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/g)) {
    if (!tables.has(m[1])) tables.set(m[1], new Set());
    tables.get(m[1]).add(m[2]);
  }
  return tables;
}

/**
 * SQL string literals in a route file.
 *
 * Backticks are paired by scanning, not by regex. A regex cannot tell an
 * opening backtick from a closing one, so it will start at a closer, run across
 * the JavaScript between two literals, and stop at the next opener — silently
 * swallowing the literal that follows. That is not hypothetical: it consumed
 * `GET /institutes/compliance`, which is the exact query this file exists to
 * check, and the test passed with the bug reintroduced.
 *
 * Escaped backticks and nested template literals would still defeat this; there
 * are none in backend/routes, and the "reads a plausible schema" test would not
 * notice if that changed, so it is asserted below instead.
 */
function queriesIn(source) {
  const noJsComments = source.replace(/\/\/[^\n]*/g, '');
  const literals = [];
  for (let i = 0; ; ) {
    const open = noJsComments.indexOf('`', i);
    if (open === -1) break;
    const close = noJsComments.indexOf('`', open + 1);
    if (close === -1) break;
    literals.push(noJsComments.slice(open + 1, close));
    i = close + 1;
  }
  for (const m of noJsComments.matchAll(/'((?:SELECT|INSERT INTO|UPDATE|DELETE FROM)[^']*)'/gi)) {
    literals.push(m[1]);
  }
  return literals
    .filter(q => /\b(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(q))
    .map(q => q.replace(/--[^\n]*/g, ''));
}

const RESERVED = new Set(['ON', 'WHERE', 'SET', 'GROUP', 'ORDER', 'LEFT', 'RIGHT', 'INNER',
  'OUTER', 'JOIN', 'AS', 'USING', 'LIMIT', 'FILTER', 'CROSS', 'FULL', 'NATURAL', 'VALUES']);

describe('backend SQL matches the schema', () => {
  const tables = loadSchema();
  const routeDir = path.join(ROOT, 'backend/routes');
  const files = readdirSync(routeDir).filter(f => f.endsWith('.js'));

  it('no escaped or nested backticks defeat the literal scanner', () => {
    // The scanner pairs backticks in order. Either construct would break that
    // silently, which is how this file previously skipped the one query it was
    // written to check.
    const offenders = files.filter(f => {
      const src = readFileSync(path.join(routeDir, f), 'utf8');
      return /\\`/.test(src) || /\$\{[^}]*`/.test(src);
    });
    expect(offenders, 'these files need a real parser, not the backtick scanner').toEqual([]);
  });

  it('reads a plausible schema', () => {
    expect(tables.size).toBeGreaterThan(10);
    expect(tables.get('assignment_occupations')).toContain('duration_hours');
  });

  for (const file of files) {
    it(`${file} selects only columns that exist`, () => {
      const source = readFileSync(path.join(routeDir, file), 'utf8');
      const problems = [];

      for (const query of queriesIn(source)) {
        const ctes = new Set([...query.matchAll(/(\w+)\s+AS\s*\(/gi)].map(m => m[1]));
        // One alias can map to several tables within a query (CTE vs outer).
        const aliases = new Map();
        // Aliases bound to a CTE are skipped entirely: this does not model CTE
        // output columns, and `af` is both the affiliations table inside
        // aff_stats and the aff_stats CTE outside it. Checking such an alias
        // against the table alone would flag every column the CTE computes.
        const cteAliases = new Set();
        for (const m of query.matchAll(/\b(?:FROM|JOIN)\s+(\w+)\s+(?:AS\s+)?(\w+)\b/gi)) {
          const [, table, alias] = m;
          if (RESERVED.has(alias.toUpperCase())) continue;
          if (ctes.has(table)) { cteAliases.add(alias); continue; }
          if (!tables.has(table)) continue;
          if (!aliases.has(alias)) aliases.set(alias, new Set());
          aliases.get(alias).add(table);
        }
        for (const [alias, boundTables] of aliases) {
          if (cteAliases.has(alias)) continue;
          const valid = new Set([...boundTables].flatMap(t => [...tables.get(t)]));
          for (const m of query.matchAll(new RegExp(`\\b${alias}\\.(\\w+)`, 'g'))) {
            const col = m[1];
            if (col === '*') continue;
            if (!valid.has(col)) {
              problems.push(`${alias}.${col} — no such column on ${[...boundTables].join(' or ')}`);
            }
          }
        }
      }

      expect([...new Set(problems)], `${file}:\n  ${[...new Set(problems)].join('\n  ')}`).toEqual([]);
    });
  }
});
